#!/usr/bin/env npx tsx

import { chromium } from 'playwright';
import { readFile } from 'fs/promises';

async function main() {
  const cookies = JSON.parse(await readFile('auth/faytuks.json', 'utf-8'));
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();

  const handles = ['Realneo101', 'SGhasseminejad', '__Injaneb96', 'DNA_shadowx', 'MiddleEast_24'];

  for (const handle of handles) {
    console.log(`\nChecking @${handle}...`);
    await page.goto(`https://x.com/${handle}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

    const title = await page.title();
    const tweetCount = await page.evaluate(() => {
      return document.querySelectorAll('article[data-testid="tweet"]').length;
    });
    const isProtected = await page.evaluate(() => {
      return document.body.innerText.includes('protected') || document.body.innerText.includes('These posts are protected');
    });
    const notFound = await page.evaluate(() => {
      return document.body.innerText.includes("This account doesn't exist") || document.body.innerText.includes('Hmm...this page doesn');
    });

    console.log(`  Title: ${title.slice(0, 60)}`);
    console.log(`  Tweets visible: ${tweetCount}`);
    console.log(`  Protected: ${isProtected}`);
    console.log(`  Not found: ${notFound}`);
  }

  await browser.close();
}

main();
