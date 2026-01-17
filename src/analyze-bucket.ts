#!/usr/bin/env npx tsx

import { readFile, writeFile, readdir } from 'fs/promises';
import path from 'path';

interface Tweet {
  id: string;
  text: string;
  date: string | null;
  topics: string[];
  isRetweet: boolean;
  isReply: boolean;
  engagement: { likes: number; retweets: number; replies: number };
}

interface ScrapedData {
  handle: string;
  name: string;
  scrapedAt: string;
  tweetCount: number;
  tweets: Tweet[];
}

interface ThemeEntry {
  topic: string;
  mentions: number;
  experts: Record<string, string[]>;
  sentiment: string;
  keyTweets: { expert: string; text: string; engagement: number }[];
}

interface TimelineEntry {
  date: string;
  events: string[];
  expertTakes: { expert: string; take: string }[];
}

interface Analysis {
  bucket: string;
  analyzedAt: string;
  totalTweets: number;
  experts: { handle: string; name: string; tweetCount: number }[];
  themes: ThemeEntry[];
  timeline: TimelineEntry[];
  topEngagement: { expert: string; text: string; likes: number; date: string }[];
  keyQuotes: { expert: string; quote: string; topic: string }[];
}

const KEY_THEMES = [
  { keyword: 'trump', label: 'Trump/US Policy' },
  { keyword: 'strike', label: 'Military Strike' },
  { keyword: 'regime', label: 'Regime Change' },
  { keyword: 'protest', label: 'Protests' },
  { keyword: 'nuclear', label: 'Nuclear Program' },
  { keyword: 'sanction', label: 'Sanctions' },
  { keyword: 'irgc', label: 'IRGC' },
  { keyword: 'khamenei', label: 'Supreme Leader' },
  { keyword: 'negotiate', label: 'Negotiations' },
  { keyword: 'collapse', label: 'Regime Collapse' }
];

function extractKeyQuotes(tweets: Tweet[], handle: string): { quote: string; topic: string }[] {
  const quotes: { quote: string; topic: string }[] = [];

  for (const tweet of tweets) {
    if (tweet.isRetweet) continue;
    if (tweet.text.length < 50) continue;

    // Look for opinion indicators
    const opinionIndicators = [
      'I think', 'I believe', 'My view', 'In my opinion',
      'The key', 'What matters', 'The real', 'The truth',
      'will', 'won\'t', 'should', 'must', 'unlikely', 'likely'
    ];

    const hasOpinion = opinionIndicators.some(ind =>
      tweet.text.toLowerCase().includes(ind.toLowerCase())
    );

    if (hasOpinion && tweet.engagement.likes > 10) {
      const mainTopic = tweet.topics[0] || 'iran';
      quotes.push({
        quote: tweet.text.slice(0, 280),
        topic: mainTopic
      });
    }
  }

  return quotes.slice(0, 10);
}

function groupByDate(tweets: Tweet[]): Map<string, Tweet[]> {
  const grouped = new Map<string, Tweet[]>();

  for (const tweet of tweets) {
    if (!tweet.date) continue;
    const dateKey = tweet.date.split('T')[0];
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(tweet);
  }

  return grouped;
}

async function main() {
  const args = process.argv.slice(2);
  let bucketName = 'geopolitics';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bucket' || args[i] === '-b') bucketName = args[++i];
  }

  const bucketDir = path.join(process.cwd(), 'buckets', bucketName);

  console.log(`=== Analyzing Bucket: ${bucketName} ===\n`);

  // Load all expert data
  const files = await readdir(bucketDir);
  const tweetFiles = files.filter(f => f.endsWith('-tweets.json'));

  const allData: ScrapedData[] = [];
  for (const file of tweetFiles) {
    const data: ScrapedData = JSON.parse(
      await readFile(path.join(bucketDir, file), 'utf-8')
    );
    if (data.tweetCount > 0) {
      allData.push(data);
      console.log(`Loaded @${data.handle}: ${data.tweetCount} tweets`);
    }
  }

  if (allData.length === 0) {
    console.error('No tweet data found');
    process.exit(1);
  }

  // Analyze themes
  console.log('\nAnalyzing themes...');
  const themes: ThemeEntry[] = [];

  for (const theme of KEY_THEMES) {
    const entry: ThemeEntry = {
      topic: theme.label,
      mentions: 0,
      experts: {},
      sentiment: 'neutral',
      keyTweets: []
    };

    for (const expert of allData) {
      const matching = expert.tweets.filter(t =>
        t.text.toLowerCase().includes(theme.keyword) && !t.isRetweet
      );

      if (matching.length > 0) {
        entry.mentions += matching.length;
        entry.experts[expert.handle] = matching.slice(0, 3).map(t => t.text.slice(0, 150));

        // Get highest engagement tweet for this theme
        const topTweet = matching.sort((a, b) =>
          b.engagement.likes - a.engagement.likes
        )[0];

        if (topTweet) {
          entry.keyTweets.push({
            expert: expert.handle,
            text: topTweet.text.slice(0, 200),
            engagement: topTweet.engagement.likes
          });
        }
      }
    }

    if (entry.mentions > 0) {
      themes.push(entry);
    }
  }

  themes.sort((a, b) => b.mentions - a.mentions);

  // Build timeline
  console.log('Building timeline...');
  const allTweets: (Tweet & { expert: string })[] = [];
  for (const expert of allData) {
    for (const tweet of expert.tweets) {
      allTweets.push({ ...tweet, expert: expert.handle });
    }
  }

  const byDate = groupByDate(allTweets as Tweet[]);
  const timeline: TimelineEntry[] = [];

  const sortedDates = [...byDate.keys()].sort().reverse().slice(0, 14);
  for (const date of sortedDates) {
    const dayTweets = byDate.get(date)!;
    const topTweets = dayTweets
      .filter(t => !t.isRetweet)
      .sort((a, b) => b.engagement.likes - a.engagement.likes)
      .slice(0, 5);

    if (topTweets.length > 0) {
      timeline.push({
        date,
        events: topTweets.map(t => t.text.slice(0, 100)),
        expertTakes: topTweets.map(t => ({
          expert: (t as any).expert || 'unknown',
          take: t.text.slice(0, 150)
        }))
      });
    }
  }

  // Top engagement
  console.log('Finding top engagement...');
  const topEngagement = allTweets
    .filter(t => !t.isRetweet)
    .sort((a, b) => b.engagement.likes - a.engagement.likes)
    .slice(0, 20)
    .map(t => ({
      expert: t.expert,
      text: t.text.slice(0, 200),
      likes: t.engagement.likes,
      date: t.date || 'unknown'
    }));

  // Key quotes
  console.log('Extracting key quotes...');
  const keyQuotes: { expert: string; quote: string; topic: string }[] = [];
  for (const expert of allData) {
    const quotes = extractKeyQuotes(expert.tweets, expert.handle);
    for (const q of quotes) {
      keyQuotes.push({ expert: expert.handle, ...q });
    }
  }

  // Build analysis
  const analysis: Analysis = {
    bucket: bucketName,
    analyzedAt: new Date().toISOString(),
    totalTweets: allData.reduce((sum, d) => sum + d.tweetCount, 0),
    experts: allData.map(d => ({
      handle: d.handle,
      name: d.name,
      tweetCount: d.tweetCount
    })),
    themes,
    timeline,
    topEngagement,
    keyQuotes: keyQuotes.slice(0, 30)
  };

  // Save analysis
  const outputPath = path.join(bucketDir, 'analysis.json');
  await writeFile(outputPath, JSON.stringify(analysis, null, 2));

  console.log(`\n=== Analysis Complete ===`);
  console.log(`Total tweets analyzed: ${analysis.totalTweets}`);
  console.log(`Themes found: ${themes.length}`);
  console.log(`Timeline entries: ${timeline.length}`);
  console.log(`Key quotes: ${keyQuotes.length}`);
  console.log(`\nSaved to: ${outputPath}`);

  // Print summary
  console.log('\n--- Top Themes ---');
  for (const theme of themes.slice(0, 5)) {
    console.log(`${theme.topic}: ${theme.mentions} mentions (${Object.keys(theme.experts).length} experts)`);
  }
}

main().catch(console.error);
