#!/usr/bin/env npx tsx

import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { generateDrafts, type DraftTweet } from './lib/ai';
import {
  IRAN_DEEP_HISTORY,
  TWEET_GUIDANCE
} from './iran-context';
import { buildFactsContext, trackFactUsage, getContextStats, validateAndFilterDrafts } from './facts-engine';

interface Tweet {
  id: string;
  text: string;
  date: string | null;
  topics: string[];
  isRetweet: boolean;
  retweetedFrom: string | null;
  engagement: { likes: number; retweets: number; replies: number };
}

interface ScrapedData {
  handle: string;
  name: string;
  scrapedAt: string;
  tweetCount: number;
  tweets: Tweet[];
}

interface Analysis {
  bucket: string;
  analyzedAt: string;
  totalTweets: number;
  experts: { handle: string; name: string; tweetCount: number }[];
  themes: {
    topic: string;
    mentions: number;
    experts: Record<string, string[]>;
    keyTweets: { expert: string; text: string; engagement: number }[];
  }[];
  topEngagement: { expert: string; text: string; likes: number; date: string }[];
}

async function buildSystemPrompt(): Promise<{
  prompt: string;
  includedFactIds: string[];
  includedNarrativeIds: string[];
}> {
  const { context: factsContext, includedFactIds, includedNarrativeIds } = await buildFactsContext({
    maxFactsPerNarrative: 4,
    includeActors: true
  });

  const prompt = `You are a bilingual (English/Persian) OSINT analyst for Faytuks Network.

${IRAN_DEEP_HISTORY}

## VERIFIED INTELLIGENCE

${factsContext}

${TWEET_GUIDANCE}

## YOUR TASK

Synthesize the expert tweets below into 3-5 powerful, original tweets.
Draw on the verified intelligence above - reference specific dates, events, quotes.
Use both English AND Persian (Farsi) for each tweet.
Make them feel CURRENT and INFORMED.

OUTPUT FORMAT - JSON array:
[
  {
    "theme": "Breaking" | "Massacre" | "Resistance" | "History" | "Western Silence",
    "english": "Tweet text under 280 chars #IranRevolution2026",
    "persian": "متن توییت فارسی #جاویدشاه",
    "sources": ["@handle1", "@handle2"],
    "hashtags": ["#IranRevolution2026"],
    "narrativeId": "massacre_ongoing"
  }
]`;

  return { prompt, includedFactIds, includedNarrativeIds };
}

async function loadBucketData(bucketName: string): Promise<{
  analysis: Analysis | null;
  recentTweets: Tweet[];
}> {
  const bucketDir = path.join(process.cwd(), 'buckets', bucketName);

  // Load analysis
  const analysisPath = path.join(bucketDir, 'analysis.json');
  let analysis: Analysis | null = null;
  if (existsSync(analysisPath)) {
    analysis = JSON.parse(await readFile(analysisPath, 'utf-8'));
  }

  // Load recent tweets from all account files
  const recentTweets: Tweet[] = [];
  const files = await readdir(bucketDir);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // Last 24 hours

  for (const file of files) {
    if (!file.endsWith('-tweets.json')) continue;
    const data: ScrapedData = JSON.parse(
      await readFile(path.join(bucketDir, file), 'utf-8')
    );

    for (const tweet of data.tweets) {
      if (tweet.date && new Date(tweet.date).getTime() > cutoff) {
        recentTweets.push(tweet);
      }
    }
  }

  return { analysis, recentTweets };
}

function buildContext(
  buckets: string[],
  allData: Map<string, { analysis: Analysis | null; recentTweets: Tweet[] }>
): string {
  let context = '# EXPERT DISCOURSE SUMMARY\n\n';

  for (const bucket of buckets) {
    const data = allData.get(bucket);
    if (!data) continue;

    context += `## Bucket: ${bucket}\n\n`;

    if (data.analysis) {
      context += `### Themes (${data.analysis.totalTweets} total tweets):\n`;
      for (const theme of data.analysis.themes.slice(0, 5)) {
        context += `- **${theme.topic}**: ${theme.mentions} mentions\n`;
        for (const kt of theme.keyTweets.slice(0, 2)) {
          context += `  - @${kt.expert}: "${kt.text.slice(0, 150)}..." (${kt.engagement} engagement)\n`;
        }
      }
      context += '\n';

      context += `### Top Viral Tweets:\n`;
      for (const t of data.analysis.topEngagement.slice(0, 5)) {
        context += `- @${t.expert} (${t.likes} likes): "${t.text.slice(0, 150)}..."\n`;
      }
      context += '\n';
    }

    if (data.recentTweets.length > 0) {
      context += `### Recent Tweets (last 24h): ${data.recentTweets.length} tweets\n`;
      const sorted = data.recentTweets.sort((a, b) =>
        (b.engagement?.likes || 0) - (a.engagement?.likes || 0)
      );
      for (const t of sorted.slice(0, 10)) {
        context += `- "${t.text.slice(0, 200)}..." (${t.engagement?.likes || 0} likes)\n`;
      }
      context += '\n';
    }
  }

  context += `\n# CURRENT DATE: ${new Date().toISOString().slice(0, 10)}\n`;
  context += `Generate timely, relevant draft tweets based on the above expert discourse.\n`;

  return context;
}

async function saveDrafts(drafts: DraftTweet[]): Promise<void> {
  const pendingDir = path.join(process.cwd(), 'drafts', 'pending');
  await mkdir(pendingDir, { recursive: true });

  for (const draft of drafts) {
    const filename = `${draft.id}.json`;
    await writeFile(
      path.join(pendingDir, filename),
      JSON.stringify(draft, null, 2)
    );
    console.log(`  Saved: drafts/pending/${filename}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let buckets = ['commentary', 'geopolitics'];
  let model: 'opus' | 'sonnet' = 'opus';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bucket' || args[i] === '-b') {
      buckets = [args[++i]];
    }
    if (args[i] === '--buckets') {
      buckets = args[++i].split(',');
    }
    if (args[i] === '--sonnet') {
      model = 'sonnet';
    }
  }

  console.log(`=== LLM Synthesis ===`);
  console.log(`Buckets: ${buckets.join(', ')}`);
  console.log(`Model: Claude ${model}`);
  console.log('');

  const stats = await getContextStats();
  console.log(`Facts Engine: ${stats.totalFacts} facts (${stats.unusedFacts} unused), ${stats.activeNarratives} active narratives`);
  console.log('');

  const allData = new Map<string, { analysis: Analysis | null; recentTweets: Tweet[] }>();
  for (const bucket of buckets) {
    console.log(`Loading ${bucket}...`);
    const data = await loadBucketData(bucket);
    allData.set(bucket, data);
    console.log(`  Analysis: ${data.analysis ? 'loaded' : 'not found'}`);
    console.log(`  Recent tweets: ${data.recentTweets.length}`);
  }

  const bucketContext = buildContext(buckets, allData);
  console.log(`\nBucket context: ${bucketContext.length} chars`);

  const { prompt: systemPrompt, includedFactIds, includedNarrativeIds } = await buildSystemPrompt();
  console.log(`Facts context: ${includedFactIds.length} facts from ${includedNarrativeIds.length} narratives`);

  console.log(`\nGenerating drafts with Claude ${model}...`);
  const rawDrafts = await generateDrafts(systemPrompt, bucketContext, model);

  if (rawDrafts.length === 0) {
    console.log('No drafts generated.');
    return;
  }

  const { valid: drafts, warnings } = await validateAndFilterDrafts(rawDrafts);

  if (warnings.length > 0) {
    console.log('\n⚠ Validation Warnings:');
    for (const warning of warnings) {
      console.log(`  ${warning}`);
    }
  }

  console.log(`\nGenerated ${drafts.length} drafts:\n`);

  for (const draft of drafts) {
    console.log(`━━━ ${draft.theme.toUpperCase()} ━━━`);
    console.log(`EN: ${draft.english}`);
    console.log(`FA: ${draft.persian}`);
    console.log(`Sources: ${draft.sources.join(', ')}`);
    const narrativeId = (draft as any).narrativeId || includedNarrativeIds[0] || 'unknown';
    console.log(`Narrative: ${narrativeId}`);
    console.log('');

    await trackFactUsage(includedFactIds, narrativeId, draft.id, draft.theme);
  }

  await saveDrafts(drafts);

  const updatedStats = await getContextStats();
  console.log(`\n=== Done ===`);
  console.log(`Usage updated: ${updatedStats.usedFacts}/${updatedStats.totalFacts} facts now used`);
}

main().catch(console.error);
