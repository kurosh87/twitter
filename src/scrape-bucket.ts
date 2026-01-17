#!/usr/bin/env npx tsx

import { chromium, type Page } from 'playwright';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

interface Account {
  handle: string;
  name: string;
  focus: string;
}

interface Bucket {
  description: string;
  accounts: Account[];
  topics: string[];
}

interface BucketsConfig {
  buckets: Record<string, Bucket>;
  defaults: {
    scrapeWeeks: number;
    checkIntervalMinutes: number;
    maxTweetsPerAccount: number;
  };
}

interface Tweet {
  id: string;
  text: string;
  date: string | null;
  topics: string[];
  isRetweet: boolean;
  isReply: boolean;
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

async function loadConfig(): Promise<BucketsConfig> {
  const configPath = path.join(process.cwd(), 'buckets.json');
  return JSON.parse(await readFile(configPath, 'utf-8'));
}

async function loadAuth(): Promise<any[] | null> {
  const authFile = path.join(process.cwd(), 'auth/faytuks.json');
  if (!existsSync(authFile)) return null;
  return JSON.parse(await readFile(authFile, 'utf-8'));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractTopics(text: string, topicList: string[]): string[] {
  const lower = text.toLowerCase();
  return topicList.filter(topic => lower.includes(topic.toLowerCase()));
}

async function scrapeAccount(
  page: Page,
  handle: string,
  name: string,
  topics: string[],
  maxWeeksAgo: number,
  maxTweets: number
): Promise<ScrapedData> {
  console.log(`\n=== Scraping @${handle} (${name}) ===`);

  await page.goto(`https://x.com/${handle}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // Wait for tweets to load - try multiple strategies
  let tweetsFound = false;
  for (let attempt = 0; attempt < 5 && !tweetsFound; attempt++) {
    await sleep(2000);

    // Try to find any tweet articles
    const articleCount = await page.evaluate(() =>
      document.querySelectorAll('article[data-testid="tweet"]').length
    );

    if (articleCount > 0) {
      tweetsFound = true;
      console.log(`  Found ${articleCount} tweet articles`);
    } else {
      // Scroll to trigger lazy loading
      await page.evaluate(() => window.scrollBy(0, 300));
      console.log(`  Waiting for tweets (attempt ${attempt + 1}/5)...`);
    }
  }

  if (!tweetsFound) {
    console.log('  Warning: No tweet articles found after waiting, continuing anyway...');
  }

  const cutoffDate = Date.now() - (maxWeeksAgo * 7 * 24 * 60 * 60 * 1000);
  const tweets: Tweet[] = [];
  const seenTexts = new Set<string>();
  let scrollCount = 0;
  let noNewTweets = 0;

  console.log(`Scrolling (${maxWeeksAgo} weeks, max ${maxTweets} tweets)...`);

  while (noNewTweets < 8 && tweets.length < maxTweets && scrollCount < 150) {
    const extracted = await page.evaluate(() => {
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      const results: {
        text: string;
        time: string | null;
        isRetweet: boolean;
        isReply: boolean;
        retweetedFrom: string | null;
        likes: string;
        retweets: string;
        replies: string;
      }[] = [];

      articles.forEach(article => {
        // Get ALL text content from the tweet, including retweets
        const allTextEls = article.querySelectorAll('[data-testid="tweetText"]');
        let text = '';
        allTextEls.forEach(el => {
          if (el.textContent) {
            text += (text ? '\n' : '') + el.textContent;
          }
        });

        // Also try getting text from any span/div if tweetText fails
        if (!text) {
          const spans = article.querySelectorAll('div[lang] span');
          spans.forEach(span => {
            if (span.textContent && span.textContent.length > 20) {
              text += (text ? '\n' : '') + span.textContent;
            }
          });
        }

        const timeEl = article.querySelector('time');

        // Check for retweet indicator
        const socialContext = article.querySelector('[data-testid="socialContext"]');
        const isRetweet = !!socialContext;
        let retweetedFrom: string | null = null;

        if (isRetweet && socialContext) {
          const rtText = socialContext.textContent || '';
          const match = rtText.match(/@?(\w+)\s+reposted/i) || rtText.match(/(\w+)\s+retweeted/i);
          if (match) {
            retweetedFrom = match[1];
          }
          // Get the original author from the tweet
          const userLink = article.querySelector('a[href*="/status/"]');
          if (userLink) {
            const href = userLink.getAttribute('href') || '';
            const userMatch = href.match(/\/(\w+)\/status/);
            if (userMatch) {
              retweetedFrom = userMatch[1];
            }
          }
        }

        const isReply = !!article.querySelector('[data-testid="tweet"] [data-testid="tweet"]');

        const likeBtn = article.querySelector('[data-testid="like"]');
        const retweetBtn = article.querySelector('[data-testid="retweet"]');
        const replyBtn = article.querySelector('[data-testid="reply"]');

        if (text && text.length > 10) {
          results.push({
            text,
            time: timeEl?.getAttribute('datetime') || null,
            isRetweet,
            isReply,
            retweetedFrom,
            likes: likeBtn?.getAttribute('aria-label') || '0',
            retweets: retweetBtn?.getAttribute('aria-label') || '0',
            replies: replyBtn?.getAttribute('aria-label') || '0'
          });
        }
      });
      return results;
    });

    let foundNew = false;
    for (const item of extracted) {
      const textKey = item.text.slice(0, 100);
      if (seenTexts.has(textKey)) continue;
      seenTexts.add(textKey);
      foundNew = true;

      // Check if too old
      if (item.time) {
        const tweetDate = new Date(item.time).getTime();
        if (tweetDate < cutoffDate) {
          console.log(`  Reached ${maxWeeksAgo}-week cutoff`);
          noNewTweets = 10;
          break;
        }
      }

      // Parse engagement numbers
      const parseNum = (s: string): number => {
        const match = s.match(/(\d[\d,]*)/);
        if (!match) return 0;
        return parseInt(match[1].replace(/,/g, ''), 10);
      };

      tweets.push({
        id: `${handle}-${tweets.length}`,
        text: item.text,
        date: item.time,
        topics: extractTopics(item.text, topics),
        isRetweet: item.isRetweet,
        isReply: item.isReply,
        retweetedFrom: item.retweetedFrom,
        engagement: {
          likes: parseNum(item.likes),
          retweets: parseNum(item.retweets),
          replies: parseNum(item.replies)
        }
      });
    }

    if (!foundNew) {
      noNewTweets++;
    } else {
      noNewTweets = 0;
    }

    await page.evaluate(() => window.scrollBy(0, 1500));
    await sleep(2000);
    scrollCount++;

    if (scrollCount % 10 === 0) {
      console.log(`  ...${tweets.length} tweets collected (scroll ${scrollCount})`);
    }
  }

  console.log(`✓ Scraped ${tweets.length} tweets from @${handle}`);

  return {
    handle,
    name,
    scrapedAt: new Date().toISOString(),
    tweetCount: tweets.length,
    tweets
  };
}

async function main() {
  const args = process.argv.slice(2);

  let bucketName = 'geopolitics';
  let weeks = 3;
  let singleAccount: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bucket' || args[i] === '-b') bucketName = args[++i];
    if (args[i] === '--weeks' || args[i] === '-w') weeks = parseInt(args[++i], 10);
    if (args[i] === '--account' || args[i] === '-a') singleAccount = args[++i]?.replace('@', '');
  }

  const config = await loadConfig();
  const bucket = config.buckets[bucketName];

  if (!bucket) {
    console.error(`Bucket "${bucketName}" not found. Available: ${Object.keys(config.buckets).join(', ')}`);
    process.exit(1);
  }

  const cookies = await loadAuth();
  if (!cookies) {
    console.error('No auth. Run: npm run login faytuks');
    process.exit(1);
  }

  console.log(`=== Scraping Bucket: ${bucketName} ===`);
  console.log(`Description: ${bucket.description}`);
  console.log(`Weeks: ${weeks}`);
  console.log(`Accounts: ${bucket.accounts.length}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  await context.addCookies(cookies);
  const page = await context.newPage();

  const bucketDir = path.join(process.cwd(), 'buckets', bucketName);
  await mkdir(bucketDir, { recursive: true });

  const accountsToScrape = singleAccount
    ? bucket.accounts.filter(a => a.handle.toLowerCase() === singleAccount.toLowerCase())
    : bucket.accounts;

  if (accountsToScrape.length === 0) {
    console.error(`Account "${singleAccount}" not found in bucket`);
    process.exit(1);
  }

  for (const account of accountsToScrape) {
    try {
      const data = await scrapeAccount(
        page,
        account.handle,
        account.name,
        bucket.topics,
        weeks,
        config.defaults.maxTweetsPerAccount
      );

      const filename = `${account.handle.toLowerCase()}-tweets.json`;
      await writeFile(
        path.join(bucketDir, filename),
        JSON.stringify(data, null, 2)
      );
      console.log(`  Saved to buckets/${bucketName}/${filename}`);

      // Brief pause between accounts
      await sleep(3000);
    } catch (error) {
      console.error(`Error scraping @${account.handle}:`, error);
    }
  }

  await browser.close();

  console.log(`\n=== Done ===`);
  console.log(`Data saved to buckets/${bucketName}/`);
}

main().catch(console.error);
