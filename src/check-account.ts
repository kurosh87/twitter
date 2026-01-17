#!/usr/bin/env npx tsx

import { launchBrowser, closeBrowser, hasAuthFile } from './utils/browser.js';
import { sleep } from './utils/wait.js';

const account = process.argv[2] || 'FaytuksNetwork';

async function main() {
  if (!hasAuthFile()) {
    console.error('No auth.json - run save-session first');
    process.exit(1);
  }

  const session = await launchBrowser(false);
  const { page } = session;

  try {
    console.log(`Checking @${account}...`);
    await page.goto(`https://x.com/${account}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(5000);

    const tweets = await page.evaluate(() => {
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      const results: string[] = [];
      articles.forEach((article, i) => {
        if (i >= 10) return;
        const textEl = article.querySelector('[data-testid="tweetText"]');
        if (textEl) {
          results.push(textEl.textContent || '');
        }
      });
      return results;
    });

    console.log(`\n=== Recent posts from @${account} ===\n`);
    tweets.forEach((tweet, i) => {
      console.log(`${i + 1}. ${tweet}\n`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await closeBrowser(session);
  }
}

main();
