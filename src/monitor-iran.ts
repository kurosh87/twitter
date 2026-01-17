#!/usr/bin/env npx tsx

import { launchBrowser, closeBrowser, hasAuthFile, takeScreenshot } from './utils/browser.js';
import { sleep } from './utils/wait.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const IRAN_KEYWORDS = [
  'iran', 'iranian', 'tehran', 'irgc', 'khamenei', 'persian gulf',
  'quds force', 'hezbollah', 'houthi', 'basij', 'ایران', 'raisi',
  'ahvaz', 'mashhad', 'isfahan', 'shiraz', 'tabriz', 'protest'
];

const SEEN_FILE = 'seen-iran-tweets.json';
const MEDIA_DIR = 'media';
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const CHECK_INTERVAL = 3 * 60 * 1000; // 3 minutes

interface TweetData {
  text: string;
  time: string | null;
  mediaUrls: string[];
  tweetUrl: string | null;
}

interface SeenData {
  hashes: string[];
  processed: { text: string; persian: string; mediaFiles: string[]; timestamp: string }[];
}

function isIranRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return IRAN_KEYWORDS.some(kw => lower.includes(kw));
}

function isWithinOneHour(isoTime: string | null): boolean {
  if (!isoTime) return true; // if no time, assume it's recent
  const tweetTime = new Date(isoTime).getTime();
  const now = Date.now();
  return (now - tweetTime) < MAX_AGE_MS;
}

async function loadSeen(): Promise<SeenData> {
  if (!existsSync(SEEN_FILE)) {
    return { hashes: [], processed: [] };
  }
  return JSON.parse(await readFile(SEEN_FILE, 'utf-8'));
}

async function saveSeen(seen: SeenData): Promise<void> {
  await writeFile(SEEN_FILE, JSON.stringify(seen, null, 2));
}

async function downloadMedia(url: string, filename: string): Promise<string | null> {
  await mkdir(MEDIA_DIR, { recursive: true });
  const filepath = path.join(MEDIA_DIR, filename);

  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = createWriteStream(filepath);

    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadMedia(redirectUrl, filename).then(resolve);
          return;
        }
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`  Downloaded: ${filename}`);
        resolve(filepath);
      });
    }).on('error', (err) => {
      console.error(`  Failed to download ${url}:`, err.message);
      resolve(null);
    });
  });
}

async function extractTweets(page: any): Promise<TweetData[]> {
  return await page.evaluate(() => {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    const results: TweetData[] = [];

    articles.forEach((article, i) => {
      if (i >= 15) return;

      const textEl = article.querySelector('[data-testid="tweetText"]');
      const timeEl = article.querySelector('time');
      const linkEl = article.querySelector('a[href*="/status/"]');

      // Get media URLs
      const mediaUrls: string[] = [];
      article.querySelectorAll('img[src*="pbs.twimg.com/media"]').forEach((img: any) => {
        mediaUrls.push(img.src);
      });
      article.querySelectorAll('video source, video[src]').forEach((vid: any) => {
        const src = vid.src || vid.getAttribute('src');
        if (src) mediaUrls.push(src);
      });

      if (textEl?.textContent) {
        results.push({
          text: textEl.textContent,
          time: timeEl?.getAttribute('datetime') || null,
          mediaUrls,
          tweetUrl: linkEl?.getAttribute('href') || null
        });
      }
    });

    return results;
  });
}

function generatePersianDraft(english: string): string {
  // Basic translation patterns - user will refine
  let persian = english;

  // Prefix translations
  persian = persian.replace(/^BREAKING:/i, 'فوری:');
  persian = persian.replace(/^NEW:/i, 'تازه:');
  persian = persian.replace(/^UPDATE:/i, 'به‌روزرسانی:');
  persian = persian.replace(/^WATCH:/i, 'ویدیو:');

  // Common entities
  persian = persian.replace(/\bIran\b/gi, 'ایران');
  persian = persian.replace(/\bTehran\b/gi, 'تهران');
  persian = persian.replace(/\bIRGC\b/g, 'سپاه');
  persian = persian.replace(/\bprotesters?\b/gi, 'معترضان');
  persian = persian.replace(/\bTrump\b/g, 'ترامپ');
  persian = persian.replace(/\bKhamenei\b/gi, 'خامنه‌ای');

  return `[DRAFT - NEEDS REVIEW]\n${persian}`;
}

async function main() {
  console.log('=== Faytuks Iran Tweet Monitor ===\n');
  console.log('Settings:');
  console.log('  - Max tweet age: 1 hour');
  console.log('  - Check interval: 3 minutes');
  console.log('  - Downloads media: Yes');
  console.log('  - Iran keywords filter: Active\n');
  console.log('Press Ctrl+C to stop\n');

  if (!hasAuthFile()) {
    console.error('No auth.json - run: npm run save-session');
    process.exit(1);
  }

  const seen = await loadSeen();
  console.log(`Loaded ${seen.hashes.length} previously seen tweets\n`);

  while (true) {
    const now = new Date().toLocaleTimeString();
    console.log(`[${now}] Checking @FaytuksNetwork...`);

    const session = await launchBrowser(true); // headless
    const { page } = session;

    try {
      await page.goto('https://x.com/FaytuksNetwork', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      await sleep(5000);

      const tweets = await extractTweets(page);
      const newIranTweets: TweetData[] = [];

      for (const tweet of tweets) {
        const hash = tweet.text.slice(0, 100);

        if (seen.hashes.includes(hash)) continue;
        if (!isWithinOneHour(tweet.time)) {
          console.log(`  Skipping old tweet (>1hr): ${tweet.text.slice(0, 50)}...`);
          continue;
        }
        if (!isIranRelated(tweet.text)) continue;

        seen.hashes.push(hash);
        newIranTweets.push(tweet);
      }

      if (newIranTweets.length > 0) {
        console.log(`\n${'🚨'.repeat(20)}`);
        console.log(`\n${newIranTweets.length} NEW IRAN TWEET(S) - UNDER 1 HOUR OLD\n`);

        for (const tweet of newIranTweets) {
          console.log('═'.repeat(60));
          console.log('\n📝 ENGLISH:');
          console.log(tweet.text);
          console.log(`\n⏰ Time: ${tweet.time || 'unknown'}`);

          // Download media
          const mediaFiles: string[] = [];
          if (tweet.mediaUrls.length > 0) {
            console.log(`\n📎 Media (${tweet.mediaUrls.length} files):`);
            for (let i = 0; i < tweet.mediaUrls.length; i++) {
              const url = tweet.mediaUrls[i];
              const ext = url.includes('.mp4') ? 'mp4' : 'jpg';
              const filename = `${Date.now()}-${i}.${ext}`;
              const filepath = await downloadMedia(url, filename);
              if (filepath) mediaFiles.push(filepath);
            }
          }

          // Generate Persian draft
          const persian = generatePersianDraft(tweet.text);
          console.log('\n📝 PERSIAN DRAFT:');
          console.log(persian);

          // Save to processed
          seen.processed.push({
            text: tweet.text,
            persian,
            mediaFiles,
            timestamp: new Date().toISOString()
          });

          console.log('\n' + '─'.repeat(60));
        }

        // Play alert sound
        const { exec } = await import('child_process');
        exec('afplay /System/Library/Sounds/Glass.aiff');

        await saveSeen(seen);
      } else {
        console.log(`  No new Iran tweets under 1 hour old\n`);
      }

    } catch (error) {
      console.error('Error:', error);
    } finally {
      await closeBrowser(session);
    }

    console.log(`Next check in 3 minutes...\n`);
    await sleep(CHECK_INTERVAL);
  }
}

main().catch(console.error);
