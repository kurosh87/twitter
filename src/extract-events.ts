#!/usr/bin/env npx tsx

import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { generateWithClaude } from './lib/ai';
import { buildExtractionPrompt } from './prompts/extraction';
import { updateKnowledge, type ExtractionResult } from './knowledge/updater';

interface ScrapedTweet {
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
  tweets: ScrapedTweet[];
}

async function loadTweetsFromBucket(
  bucketName: string,
  hoursBack: number = 24
): Promise<{ author: string; text: string }[]> {
  const bucketDir = path.join(process.cwd(), 'buckets', bucketName);
  if (!existsSync(bucketDir)) {
    console.warn(`Bucket not found: ${bucketName}`);
    return [];
  }

  const files = await readdir(bucketDir);
  const tweetFiles = files.filter((f) => f.endsWith('-tweets.json'));

  const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
  const tweets: { author: string; text: string }[] = [];

  for (const file of tweetFiles) {
    try {
      const data: ScrapedData = JSON.parse(
        await readFile(path.join(bucketDir, file), 'utf-8')
      );

      for (const tweet of data.tweets) {
        if (tweet.isRetweet) continue;

        const tweetDate = tweet.date ? new Date(tweet.date).getTime() : Date.now();
        if (tweetDate > cutoff) {
          tweets.push({
            author: data.handle,
            text: tweet.text,
          });
        }
      }
    } catch (error) {
      console.warn(`Error loading ${file}:`, error);
    }
  }

  return tweets;
}

async function extractEventsFromTweets(
  tweets: { author: string; text: string }[],
  model: 'opus' | 'sonnet' = 'sonnet'
): Promise<ExtractionResult> {
  if (tweets.length === 0) {
    return {
      events: [],
      newFacts: [],
      extractedAt: new Date().toISOString(),
    };
  }

  const batchSize = 30;
  const allEvents: ExtractionResult['events'] = [];
  const allFacts: ExtractionResult['newFacts'] = [];

  for (let i = 0; i < tweets.length; i += batchSize) {
    const batch = tweets.slice(i, i + batchSize);
    console.log(`  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tweets.length / batchSize)}...`);

    const prompt = buildExtractionPrompt(batch);

    try {
      const response = await generateWithClaude(
        'You are an OSINT event extraction system. Output only valid JSON.',
        prompt,
        model
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.events) allEvents.push(...parsed.events);
        if (parsed.newFacts) allFacts.push(...parsed.newFacts);
      }
    } catch (error) {
      console.error(`  Error extracting from batch:`, error);
    }
  }

  return {
    events: allEvents,
    newFacts: allFacts,
    extractedAt: new Date().toISOString(),
  };
}

async function main() {
  const args = process.argv.slice(2);
  let buckets = ['commentary', 'geopolitics'];
  let hoursBack = 24;
  let model: 'opus' | 'sonnet' = 'sonnet';
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--bucket':
      case '-b':
        buckets = [args[++i]];
        break;
      case '--buckets':
        buckets = args[++i].split(',');
        break;
      case '--hours':
      case '-h':
        hoursBack = parseInt(args[++i], 10);
        break;
      case '--opus':
        model = 'opus';
        break;
      case '--dry-run':
        dryRun = true;
        break;
    }
  }

  console.log('=== Event Extraction ===');
  console.log(`Buckets: ${buckets.join(', ')}`);
  console.log(`Hours back: ${hoursBack}`);
  console.log(`Model: ${model}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  let allTweets: { author: string; text: string }[] = [];

  for (const bucket of buckets) {
    console.log(`Loading tweets from ${bucket}...`);
    const tweets = await loadTweetsFromBucket(bucket, hoursBack);
    console.log(`  Found ${tweets.length} tweets`);
    allTweets = allTweets.concat(tweets);
  }

  if (allTweets.length === 0) {
    console.log('No tweets found to process.');
    return;
  }

  console.log(`\nTotal tweets to process: ${allTweets.length}`);
  console.log('Extracting events...\n');

  const extraction = await extractEventsFromTweets(allTweets, model);

  console.log(`\n=== Extraction Results ===`);
  console.log(`Events extracted: ${extraction.events.length}`);
  console.log(`Facts extracted: ${extraction.newFacts.length}`);

  if (extraction.events.length > 0) {
    console.log('\nEvents:');
    for (const event of extraction.events.slice(0, 5)) {
      console.log(`  - [${event.category}] ${event.title}`);
    }
    if (extraction.events.length > 5) {
      console.log(`  ... and ${extraction.events.length - 5} more`);
    }
  }

  if (extraction.newFacts.length > 0) {
    console.log('\nFacts:');
    for (const fact of extraction.newFacts.slice(0, 5)) {
      console.log(`  - [${fact.confidence}] ${fact.statement.slice(0, 80)}...`);
    }
    if (extraction.newFacts.length > 5) {
      console.log(`  ... and ${extraction.newFacts.length - 5} more`);
    }
  }

  if (!dryRun) {
    console.log('\nUpdating knowledge base...');
    const stats = await updateKnowledge(extraction);
    console.log(`  Events added: ${stats.eventsAdded}`);
    console.log(`  Events merged: ${stats.eventsMerged}`);
    console.log(`  Facts added: ${stats.factsAdded}`);
    console.log(`  Facts merged: ${stats.factsMerged}`);
  } else {
    console.log('\n[DRY RUN] Would update knowledge base');
  }

  console.log('\n=== Done ===');
}

export { loadTweetsFromBucket, extractEventsFromTweets };

main().catch(console.error);
