#!/usr/bin/env npx tsx

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

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
  timeline: {
    date: string;
    expertTakes: { expert: string; take: string }[];
  }[];
  keyQuotes: { expert: string; quote: string; topic: string }[];
}

interface BreakingNews {
  text: string;
  date: string;
}

interface SynthesizedOutput {
  generatedAt: string;
  breakingNews: string | null;
  synthesis: {
    topic: string;
    expertConsensus: string;
    expertPositions: { expert: string; position: string }[];
    confidence: 'high' | 'medium' | 'low';
  }[];
  draftTweets: {
    english: string;
    persian: string;
    theme: string;
    basedOn: string[];
  }[];
}

const PERSIAN_TRANSLATIONS: Record<string, string> = {
  'experts': 'کارشناسان',
  'analysts': 'تحلیلگران',
  'Iran': 'ایران',
  'regime': 'رژیم',
  'protests': 'اعتراضات',
  'Trump': 'ترامپ',
  'strike': 'حمله',
  'IRGC': 'سپاه',
  'collapse': 'فروپاشی',
  'uncertainty': 'عدم قطعیت',
  'divided': 'اختلاف نظر',
  'consensus': 'اجماع',
  'Analysis': 'تحلیل',
  'Key point': 'نکته کلیدی',
  'Watch for': 'نشانه‌ها'
};

function translateToPersian(english: string): string {
  let persian = english;

  // Apply translations
  for (const [en, fa] of Object.entries(PERSIAN_TRANSLATIONS)) {
    persian = persian.replace(new RegExp(en, 'gi'), fa);
  }

  return persian;
}

function generateSynthesis(analysis: Analysis, breakingNews: BreakingNews | null): SynthesizedOutput {
  const synthesis: SynthesizedOutput['synthesis'] = [];
  const draftTweets: SynthesizedOutput['draftTweets'] = [];

  // Analyze each major theme
  for (const theme of analysis.themes.slice(0, 5)) {
    const expertCount = Object.keys(theme.experts).length;
    const expertPositions: { expert: string; position: string }[] = [];

    // Extract positions from each expert
    for (const [expert, quotes] of Object.entries(theme.experts)) {
      if (quotes.length > 0) {
        expertPositions.push({
          expert,
          position: quotes[0].slice(0, 150)
        });
      }
    }

    // Determine consensus
    let consensus = 'Experts have varying views';
    let confidence: 'high' | 'medium' | 'low' = 'medium';

    if (expertCount >= 3) {
      confidence = 'high';
      consensus = `${expertCount} experts agree on the importance of ${theme.topic.toLowerCase()}`;
    } else if (expertCount === 2) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    synthesis.push({
      topic: theme.topic,
      expertConsensus: consensus,
      expertPositions,
      confidence
    });

    // Generate draft tweets for top themes
    if (theme.mentions > 20 && theme.keyTweets.length >= 2) {
      const topTweet = theme.keyTweets[0];

      // English draft
      const englishDraft = `Analysis: ${theme.topic} - Iran policy experts note ${consensus.toLowerCase()}. ${
        breakingNews ? `Amid reports: "${breakingNews.text.slice(0, 80)}..."` : ''
      }`.slice(0, 280);

      // Persian draft
      const persianDraft = translateToPersian(
        `تحلیل: ${theme.topic} - کارشناسان سیاست ایران ${consensus.toLowerCase()}. ${
          breakingNews ? `در پی گزارش‌ها: "${breakingNews.text.slice(0, 60)}..."` : ''
        }`
      ).slice(0, 280);

      draftTweets.push({
        english: englishDraft,
        persian: persianDraft,
        theme: theme.topic,
        basedOn: theme.keyTweets.slice(0, 3).map(t => `@${t.expert}`)
      });
    }
  }

  // Generate synthesis based on breaking news if available
  if (breakingNews) {
    const relevantThemes = analysis.themes.filter(t =>
      breakingNews.text.toLowerCase().includes(t.topic.toLowerCase().split(' ')[0])
    );

    if (relevantThemes.length > 0) {
      const theme = relevantThemes[0];
      const experts = Object.keys(theme.experts);

      const englishBreaking = `BREAKING context: ${breakingNews.text.slice(0, 100)}... Expert analysis from ${experts.length} Iran watchers suggests ${theme.keyTweets[0]?.text.slice(0, 80) || 'ongoing developments'}`.slice(0, 280);

      const persianBreaking = `فوری - زمینه: ${breakingNews.text.slice(0, 80)}... تحلیل ${experts.length} کارشناس ایران نشان می‌دهد ${theme.keyTweets[0]?.text.slice(0, 60) || 'تحولات ادامه دارد'}`.slice(0, 280);

      draftTweets.unshift({
        english: englishBreaking,
        persian: persianBreaking,
        theme: 'Breaking + Analysis',
        basedOn: experts.map(e => `@${e}`)
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    breakingNews: breakingNews?.text || null,
    synthesis,
    draftTweets
  };
}

async function loadBreakingNews(): Promise<BreakingNews | null> {
  const faytuksPath = path.join(process.cwd(), 'iran-tweets.json');
  if (!existsSync(faytuksPath)) return null;

  try {
    const data = JSON.parse(await readFile(faytuksPath, 'utf-8'));
    if (data.tweets && data.tweets.length > 0) {
      const latest = data.tweets[0];
      return {
        text: latest.text,
        date: latest.date || new Date().toISOString()
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function main() {
  const args = process.argv.slice(2);
  let bucketName = 'geopolitics';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bucket' || args[i] === '-b') bucketName = args[++i];
  }

  console.log(`=== Synthesizing from Bucket: ${bucketName} ===\n`);

  // Load analysis
  const analysisPath = path.join(process.cwd(), 'buckets', bucketName, 'analysis.json');
  if (!existsSync(analysisPath)) {
    console.error(`No analysis found. Run: npm run analyze -- --bucket ${bucketName}`);
    process.exit(1);
  }

  const analysis: Analysis = JSON.parse(await readFile(analysisPath, 'utf-8'));
  console.log(`Loaded analysis: ${analysis.totalTweets} tweets from ${analysis.experts.length} experts`);

  // Load breaking news
  const breakingNews = await loadBreakingNews();
  if (breakingNews) {
    console.log(`Breaking news: "${breakingNews.text.slice(0, 80)}..."`);
  } else {
    console.log('No breaking news loaded (run scrape-iran-tweets.ts first)');
  }

  // Generate synthesis
  console.log('\nGenerating synthesis...');
  const output = generateSynthesis(analysis, breakingNews);

  // Save output
  const outputPath = path.join(process.cwd(), 'buckets', bucketName, 'synthesis.json');
  await writeFile(outputPath, JSON.stringify(output, null, 2));

  // Print results
  console.log(`\n${'='.repeat(60)}`);
  console.log('SYNTHESIS RESULTS');
  console.log('='.repeat(60));

  console.log('\n--- Expert Consensus by Theme ---\n');
  for (const s of output.synthesis) {
    console.log(`${s.topic} [${s.confidence}]`);
    console.log(`  Consensus: ${s.expertConsensus}`);
    console.log(`  Experts: ${s.expertPositions.map(p => p.expert).join(', ')}`);
    console.log('');
  }

  console.log('\n--- Draft Tweets ---\n');
  for (const draft of output.draftTweets) {
    console.log(`Theme: ${draft.theme}`);
    console.log(`Based on: ${draft.basedOn.join(', ')}`);
    console.log(`\nENGLISH:\n${draft.english}`);
    console.log(`\nPERSIAN:\n${draft.persian}`);
    console.log('\n' + '-'.repeat(40) + '\n');
  }

  console.log(`\nSaved to: ${outputPath}`);
}

main().catch(console.error);
