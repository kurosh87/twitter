#!/usr/bin/env npx tsx

import { launchBrowser, closeBrowser, hasAuthFile } from './utils/browser.js';
import { sleep } from './utils/wait.js';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const IRAN_KEYWORDS = [
  'iran', 'iranian', 'tehran', 'irgc', 'khamenei', 'persian gulf',
  'quds force', 'hezbollah', 'houthi', 'basij', 'ایران'
];

const SEEN_FILE = 'seen-tweets.json';
const CHECK_INTERVAL = 3 * 60 * 1000; // 3 minutes

function isIranRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return IRAN_KEYWORDS.some(kw => lower.includes(kw));
}

async function loadSeen(): Promise<Set<string>> {
  if (!existsSync(SEEN_FILE)) return new Set();
  const data = JSON.parse(await readFile(SEEN_FILE, 'utf-8'));
  return new Set(data);
}

async function saveSeen(seen: Set<string>): Promise<void> {
  await writeFile(SEEN_FILE, JSON.stringify([...seen], null, 2));
}

async function checkForNewTweets(seen: Set<string>): Promise<string[]> {
  if (!hasAuthFile()) {
    console.error('No auth.json - run save-session first');
    process.exit(1);
  }

  const session = await launchBrowser(true); // headless for monitoring
  const { page } = session;
  const newIranTweets: string[] = [];

  try {
    await page.goto('https://x.com/FaytuksNetwork', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await sleep(5000);

    const tweets = await page.evaluate(() => {
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      const results: string[] = [];
      articles.forEach((article, i) => {
        if (i >= 20) return;
        const textEl = article.querySelector('[data-testid="tweetText"]');
        if (textEl?.textContent) {
          results.push(textEl.textContent);
        }
      });
      return results;
    });

    for (const tweet of tweets) {
      const hash = tweet.slice(0, 100);
      if (seen.has(hash)) continue;

      seen.add(hash);

      if (isIranRelated(tweet)) {
        newIranTweets.push(tweet);
      }
    }

    await saveSeen(seen);

  } finally {
    await closeBrowser(session);
  }

  return newIranTweets;
}

async function main() {
  console.log('=== Faytuks Iran Tweet Monitor ===\n');
  console.log('Checking @FaytuksNetwork every 3 minutes for new Iran tweets...');
  console.log('Press Ctrl+C to stop\n');

  const seen = await loadSeen();
  console.log(`Loaded ${seen.size} previously seen tweets\n`);

  while (true) {
    const now = new Date().toLocaleTimeString();
    console.log(`[${now}] Checking for new tweets...`);

    try {
      const newTweets = await checkForNewTweets(seen);

      if (newTweets.length > 0) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🚨 ${newTweets.length} NEW IRAN TWEET(S) FOUND!`);
        console.log('='.repeat(60));

        for (const tweet of newTweets) {
          console.log(`\n📝 ENGLISH:\n${tweet}\n`);
          console.log(`📝 DRAFT PERSIAN: [Use Claude to translate]\n`);
          console.log('-'.repeat(40));
        }

        // Play sound alert (macOS)
        const { exec } = await import('child_process');
        exec('afplay /System/Library/Sounds/Glass.aiff');

      } else {
        console.log(`[${now}] No new Iran tweets\n`);
      }
    } catch (error) {
      console.error('Error checking tweets:', error);
    }

    await sleep(CHECK_INTERVAL);
  }
}

main().catch(console.error);
