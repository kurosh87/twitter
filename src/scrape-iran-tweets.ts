#!/usr/bin/env npx tsx

import { launchBrowser, closeBrowser, hasAuthFile } from './utils/browser.js';
import { sleep } from './utils/wait.js';
import { writeFile } from 'fs/promises';

const IRAN_KEYWORDS = [
  'iran', 'iranian', 'tehran', 'irgc', 'khamenei', 'raisi', 'persian gulf',
  'strait of hormuz', 'quds force', 'hezbollah', 'houthi', 'proxy', 'ایران'
];

function isIranRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return IRAN_KEYWORDS.some(kw => lower.includes(kw));
}

async function main() {
  if (!hasAuthFile()) {
    console.error('No auth.json - run save-session first');
    process.exit(1);
  }

  const session = await launchBrowser(false);
  const { page } = session;
  const iranTweets: { text: string; date?: string }[] = [];
  const seenTexts = new Set<string>();

  try {
    console.log('Loading @FaytuksNetwork...');
    await page.goto('https://x.com/FaytuksNetwork', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(4000);

    const threeWeeksAgo = Date.now() - (21 * 24 * 60 * 60 * 1000);
    let scrollCount = 0;
    let noNewTweets = 0;

    console.log('Scrolling through timeline (3 weeks)...\n');

    while (noNewTweets < 5 && scrollCount < 100) {
      const tweets = await page.evaluate(() => {
        const articles = document.querySelectorAll('article[data-testid="tweet"]');
        const results: { text: string; time?: string }[] = [];

        articles.forEach(article => {
          const textEl = article.querySelector('[data-testid="tweetText"]');
          const timeEl = article.querySelector('time');
          if (textEl?.textContent) {
            results.push({
              text: textEl.textContent,
              time: timeEl?.getAttribute('datetime') || undefined
            });
          }
        });
        return results;
      });

      let foundNew = false;
      for (const tweet of tweets) {
        if (seenTexts.has(tweet.text)) continue;
        seenTexts.add(tweet.text);
        foundNew = true;

        if (tweet.time) {
          const tweetDate = new Date(tweet.time).getTime();
          if (tweetDate < threeWeeksAgo) {
            console.log(`Reached tweets older than 3 weeks. Stopping.`);
            noNewTweets = 10;
            break;
          }
        }

        if (isIranRelated(tweet.text)) {
          iranTweets.push({ text: tweet.text, date: tweet.time });
          console.log(`[${iranTweets.length}] ${tweet.text.slice(0, 80)}...`);
        }
      }

      if (!foundNew) {
        noNewTweets++;
      } else {
        noNewTweets = 0;
      }

      await page.evaluate(() => window.scrollBy(0, 2000));
      await sleep(1500);
      scrollCount++;

      if (scrollCount % 10 === 0) {
        console.log(`  ...scrolled ${scrollCount} times, found ${iranTweets.length} Iran tweets`);
      }
    }

    console.log(`\n=== Found ${iranTweets.length} Iran-related tweets ===\n`);

    const output = {
      account: '@FaytuksNetwork',
      scraped: new Date().toISOString(),
      period: '3 weeks',
      count: iranTweets.length,
      tweets: iranTweets
    };

    await writeFile('iran-tweets.json', JSON.stringify(output, null, 2));
    console.log('Saved to iran-tweets.json');

    console.log('\n--- SAMPLE TWEETS ---\n');
    iranTweets.slice(0, 10).forEach((t, i) => {
      console.log(`${i + 1}. ${t.text}\n`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closeBrowser(session);
  }
}

main();
