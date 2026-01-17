#!/usr/bin/env npx tsx

import { chromium } from 'playwright';
import { readFile, mkdir } from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import path from 'path';
import https from 'https';

const MEDIA_DIR = 'media';

async function downloadFile(url: string, filename: string): Promise<string | null> {
  await mkdir(MEDIA_DIR, { recursive: true });
  const filepath = path.join(MEDIA_DIR, filename);

  return new Promise((resolve) => {
    const file = createWriteStream(filepath);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirect = response.headers.location;
        if (redirect) {
          downloadFile(redirect, filename).then(resolve);
          return;
        }
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', () => resolve(null));
  });
}

async function main() {
  const authFile = 'auth/faytuks.json';
  if (!existsSync(authFile)) {
    console.error('No auth. Run: npm run login faytuks');
    process.exit(1);
  }

  const cookies = JSON.parse(await readFile(authFile, 'utf-8'));

  console.log('=== Downloading Media from @FaytuksNetwork ===\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    await page.goto('https://x.com/FaytuksNetwork/media', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('Loading media tab...');
    await page.waitForTimeout(5000);

    // Scroll a bit to load more
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(2000);
    }

    // Extract media URLs
    const media = await page.evaluate(() => {
      const results: { type: string; url: string; tweet: string }[] = [];

      // Images
      document.querySelectorAll('img[src*="pbs.twimg.com/media"]').forEach((img: any) => {
        const article = img.closest('article');
        const tweetText = article?.querySelector('[data-testid="tweetText"]')?.textContent || '';
        results.push({
          type: 'image',
          url: img.src.replace(/&name=\w+/, '&name=large'),
          tweet: tweetText.slice(0, 100)
        });
      });

      // Videos - get poster/thumbnail
      document.querySelectorAll('video').forEach((vid: any) => {
        const article = vid.closest('article');
        const tweetText = article?.querySelector('[data-testid="tweetText"]')?.textContent || '';
        if (vid.poster) {
          results.push({
            type: 'video_thumb',
            url: vid.poster,
            tweet: tweetText.slice(0, 100)
          });
        }
        if (vid.src) {
          results.push({
            type: 'video',
            url: vid.src,
            tweet: tweetText.slice(0, 100)
          });
        }
      });

      return results;
    });

    console.log(`Found ${media.length} media items\n`);

    // Download first 5
    let downloaded = 0;
    for (const item of media.slice(0, 5)) {
      const ext = item.type === 'video' ? 'mp4' : 'jpg';
      const filename = `faytuks-${Date.now()}-${downloaded}.${ext}`;

      console.log(`[${item.type}] ${item.tweet.slice(0, 50)}...`);
      const result = await downloadFile(item.url, filename);

      if (result) {
        console.log(`  ✓ Downloaded: ${filename}\n`);
        downloaded++;
      } else {
        console.log(`  ✗ Failed\n`);
      }

      await page.waitForTimeout(500);
    }

    console.log(`\n=== Downloaded ${downloaded} files to media/ ===`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

main();
