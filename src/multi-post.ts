#!/usr/bin/env npx tsx

import { chromium, type BrowserContext, type Page } from 'playwright';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import * as readline from 'readline';

interface Account {
  id: string;
  handle: string;
  type: 'osint' | 'personal';
  description: string;
  authFile: string;
  style: {
    prefixes: string[];
    useEmojis: boolean;
    sourceAttribution: boolean;
  };
}

interface Config {
  accounts: Account[];
  defaults: {
    delayBetweenPosts: number;
    maxTweetAge: number;
    checkInterval: number;
  };
}

interface PostJob {
  accountId: string;
  english: string;
  persian: string;
  media?: string[];
}

const selectors = {
  composeButton: [
    '[data-testid="SideNav_NewTweet_Button"]',
    '[aria-label="Post"]',
    'a[href="/compose/tweet"]'
  ],
  tweetInput: [
    '[data-testid="tweetTextarea_0"]',
    '[aria-label="Post text"]',
    '.public-DraftEditor-content'
  ],
  postButton: [
    '[data-testid="tweetButtonInline"]',
    '[data-testid="tweetButton"]'
  ],
  profileIndicator: [
    '[data-testid="SideNav_AccountSwitcher_Button"]'
  ]
};

async function loadConfig(): Promise<Config> {
  const configPath = path.join(process.cwd(), 'accounts.json');
  return JSON.parse(await readFile(configPath, 'utf-8'));
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findElement(page: Page, selectorList: string[], timeout = 10000) {
  for (const selector of selectorList) {
    try {
      const el = await page.waitForSelector(selector, { timeout: timeout / selectorList.length });
      if (el) return el;
    } catch {}
  }
  return null;
}

async function typeWithDelay(element: any, text: string): Promise<void> {
  for (const char of text) {
    await element.type(char, { delay: Math.random() * 100 + 50 });
  }
}

async function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

class MultiAccountPoster {
  private config: Config;
  private dryRun: boolean;
  private confirm: boolean;

  constructor(config: Config, dryRun = false, confirm = false) {
    this.config = config;
    this.dryRun = dryRun;
    this.confirm = confirm;
  }

  async getAccount(accountId: string): Promise<Account | undefined> {
    return this.config.accounts.find(a => a.id === accountId);
  }

  async loadCookies(authFile: string): Promise<any[] | null> {
    const fullPath = path.join(process.cwd(), authFile);
    if (!existsSync(fullPath)) return null;
    return JSON.parse(await readFile(fullPath, 'utf-8'));
  }

  async saveCookies(authFile: string, cookies: any[]): Promise<void> {
    const fullPath = path.join(process.cwd(), authFile);
    await writeFile(fullPath, JSON.stringify(cookies, null, 2));
  }

  async loginAccount(accountId: string): Promise<void> {
    const account = await this.getAccount(accountId);
    if (!account) throw new Error(`Account not found: ${accountId}`);

    console.log(`\n=== Login for ${account.handle} ===\n`);

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    const page = await context.newPage();

    await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log(`Browser opened. Please log in to ${account.handle}`);
    await waitForEnter('Press Enter after logging in...');

    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
    await sleep(2000);

    const cookies = await context.cookies();
    await this.saveCookies(account.authFile, cookies);
    console.log(`✓ Cookies saved to ${account.authFile}`);

    await browser.close();
  }

  async postToAccount(job: PostJob): Promise<{ english: boolean; persian: boolean }> {
    const account = await this.getAccount(job.accountId);
    if (!account) throw new Error(`Account not found: ${job.accountId}`);

    const cookies = await this.loadCookies(account.authFile);
    if (!cookies) {
      console.error(`No auth for ${account.handle}. Run: npm run login -- ${account.id}`);
      return { english: false, persian: false };
    }

    console.log(`\n=== Posting to ${account.handle} (${account.type}) ===`);
    console.log(`Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE'}`);

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    await context.addCookies(cookies);
    const page = await context.newPage();

    let englishSuccess = false;
    let persianSuccess = false;

    try {
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(3000);

      // Verify logged in
      const profile = await findElement(page, selectors.profileIndicator, 10000);
      if (!profile) {
        console.error('✗ Not logged in');
        await browser.close();
        return { english: false, persian: false };
      }
      console.log('✓ Logged in');

      // Post English
      englishSuccess = await this.postSingleTweet(page, job.english, 'English', job.media);

      if (englishSuccess && !this.dryRun) {
        console.log(`\nWaiting ${this.config.defaults.delayBetweenPosts}s...`);
        await sleep(this.config.defaults.delayBetweenPosts * 1000);
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
        await sleep(2000);
      }

      // Post Persian
      persianSuccess = await this.postSingleTweet(page, job.persian, 'Persian', job.media);

    } catch (error) {
      console.error('Error:', error);
    } finally {
      await browser.close();
    }

    return { english: englishSuccess, persian: persianSuccess };
  }

  private async postSingleTweet(page: Page, text: string, label: string, media?: string[]): Promise<boolean> {
    console.log(`\n--- ${label} Tweet ---`);

    const composeBtn = await findElement(page, selectors.composeButton, 15000);
    if (!composeBtn) {
      console.error('✗ Compose button not found');
      return false;
    }

    await sleep(500);
    await composeBtn.click();
    await sleep(1000);

    // Upload media if provided
    if (media && media.length > 0) {
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        const fullPaths = media.map(m => path.resolve(m));
        await fileInput.setInputFiles(fullPaths);
        await sleep(3000);
        console.log(`✓ Media uploaded (${media.length} files)`);
      }
    }

    const tweetInput = await findElement(page, selectors.tweetInput, 10000);
    if (!tweetInput) {
      console.error('✗ Tweet input not found');
      return false;
    }

    console.log(`Typing (${text.length} chars)...`);
    await typeWithDelay(tweetInput, text);
    await sleep(500);

    if (this.confirm) {
      console.log('\n--- PREVIEW ---');
      console.log(text);
      console.log('---------------');
      await waitForEnter('Press Enter to post (Ctrl+C to cancel)...');
    }

    if (this.dryRun) {
      console.log('✓ [DRY RUN] Would post');
      await page.keyboard.press('Escape');
      await sleep(500);
      return true;
    }

    const postBtn = await findElement(page, selectors.postButton, 10000);
    if (!postBtn) {
      console.error('✗ Post button not found');
      return false;
    }

    await sleep(Math.random() * 500 + 300);
    await postBtn.click();
    await sleep(3000);

    console.log(`✓ ${label} posted!`);
    return true;
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const config = await loadConfig();

  if (args[0] === 'login') {
    const accountId = args[1];
    if (!accountId) {
      console.log('Usage: npm run multi -- login <account-id>');
      console.log('\nAvailable accounts:');
      config.accounts.forEach(a => console.log(`  ${a.id} - ${a.handle} (${a.type})`));
      return;
    }
    const poster = new MultiAccountPoster(config);
    await poster.loginAccount(accountId);
    return;
  }

  if (args[0] === 'post') {
    const accountId = args[1];
    const english = args.find((a, i) => args[i - 1] === '-e' || args[i - 1] === '--english');
    const persian = args.find((a, i) => args[i - 1] === '-p' || args[i - 1] === '--persian');
    const dryRun = args.includes('--dry-run');
    const confirm = args.includes('--confirm') || args.includes('-c');

    const mediaArgs: string[] = [];
    args.forEach((a, i) => {
      if ((args[i - 1] === '-m' || args[i - 1] === '--media') && existsSync(a)) {
        mediaArgs.push(a);
      }
    });

    if (!accountId || !english || !persian) {
      console.log('Usage: npm run multi -- post <account-id> -e "english" -p "persian" [-m media] [--dry-run] [-c]');
      return;
    }

    const poster = new MultiAccountPoster(config, dryRun, confirm);
    const result = await poster.postToAccount({
      accountId,
      english,
      persian,
      media: mediaArgs.length > 0 ? mediaArgs : undefined
    });

    console.log('\n=== Result ===');
    console.log('English:', result.english ? '✓' : '✗');
    console.log('Persian:', result.persian ? '✓' : '✗');
    return;
  }

  if (args[0] === 'list') {
    console.log('\n=== Configured Accounts ===\n');
    for (const account of config.accounts) {
      const hasAuth = existsSync(path.join(process.cwd(), account.authFile));
      console.log(`${account.id}`);
      console.log(`  Handle: ${account.handle}`);
      console.log(`  Type: ${account.type}`);
      console.log(`  Auth: ${hasAuth ? '✓ logged in' : '✗ needs login'}`);
      console.log('');
    }
    return;
  }

  // Help
  console.log(`
Faytuks Multi-Account Poster

Commands:
  npm run multi -- list                     List all accounts
  npm run multi -- login <account-id>       Login to an account
  npm run multi -- post <account-id> ...    Post to an account

Post options:
  -e, --english <text>   English tweet
  -p, --persian <text>   Persian tweet
  -m, --media <file>     Media file (can repeat)
  --dry-run              Don't actually post
  -c, --confirm          Confirm before posting

Examples:
  npm run multi -- login faytuks
  npm run multi -- post faytuks -e "BREAKING: News" -p "فوری: خبر" --dry-run
  npm run multi -- post personal1 -e "Hello" -p "سلام" -m photo.jpg -c
`);
}

main().catch(console.error);
