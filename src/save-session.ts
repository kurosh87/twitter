#!/usr/bin/env npx tsx

import { launchBrowser, saveCookies, closeBrowser } from './utils/browser.js';
import { isLoggedIn } from './utils/x-selectors.js';
import { sleep } from './utils/wait.js';
import * as readline from 'readline';

async function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  console.log('=== Faytuks X Session Saver ===\n');
  console.log('This will open a browser window for you to log into X/Twitter.');
  console.log('After logging in, press Enter in this terminal to save your session.\n');

  const session = await launchBrowser(false);
  const { page, context } = session;

  try {
    console.log('Opening X.com...');
    await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('\n===========================================');
    console.log('Browser opened! Please log in to X/Twitter.');
    console.log('===========================================\n');

    await waitForEnter('Press Enter after you have logged in successfully...');

    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2000);

    if (await isLoggedIn(page)) {
      console.log('\n✓ Login detected successfully!');
      await saveCookies(context);
      console.log('\nSession saved. You can now use post-tweets.ts to post.');
    } else {
      console.log('\n✗ Could not verify login. Please try again.');
      console.log('Make sure you are fully logged in and can see your home feed.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    console.log('\nClosing browser...');
    await closeBrowser(session);
  }
}

main().catch(console.error);
