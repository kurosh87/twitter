#!/usr/bin/env npx tsx

import { launchBrowser, closeBrowser, hasAuthFile, takeScreenshot } from './utils/browser.js';
import { selectors, findElement, isLoggedIn, detectRateLimit, detectCaptcha } from './utils/x-selectors.js';
import { typeWithHumanDelay, humanDelay, countdownTimer, sleep, randomDelay } from './utils/wait.js';
import { existsSync } from 'fs';
import { readFile, writeFile, readdir, rename, mkdir } from 'fs/promises';
import path from 'path';
import * as readline from 'readline';

interface DraftTweet {
  id: string;
  generatedAt: string;
  theme: string;
  english: string;
  persian: string;
  sources: string[];
  hashtags: string[];
}

const DRAFTS_DIR = path.join(process.cwd(), 'drafts');
const APPROVED_DIR = path.join(DRAFTS_DIR, 'approved');
const POSTED_DIR = path.join(DRAFTS_DIR, 'posted');

interface PostOptions {
  english: string;
  persian: string;
  delay: number;
  confirm: boolean;
  dryRun: boolean;
  media: string[];
  fromQueue: boolean;
  queueLimit: number;
}

function parseArgs(): PostOptions {
  const args = process.argv.slice(2);
  const options: PostOptions = {
    english: '',
    persian: '',
    delay: 120,
    confirm: false,
    dryRun: false,
    media: [],
    fromQueue: false,
    queueLimit: 1
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--english':
      case '-e':
        options.english = args[++i] || '';
        break;
      case '--persian':
      case '-p':
        options.persian = args[++i] || '';
        break;
      case '--delay':
      case '-d':
        options.delay = parseInt(args[++i] || '120', 10);
        break;
      case '--confirm':
      case '-c':
        options.confirm = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--from-queue':
      case '-q':
        options.fromQueue = true;
        break;
      case '--limit':
      case '-l':
        options.queueLimit = parseInt(args[++i] || '1', 10);
        break;
      case '--media':
      case '-m':
        const mediaPath = args[++i] || '';
        if (mediaPath && existsSync(mediaPath)) {
          options.media.push(path.resolve(mediaPath));
        } else if (mediaPath) {
          console.warn(`Warning: Media file not found: ${mediaPath}`);
        }
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Faytuks X Tweet Poster

Usage: npx tsx src/post-tweets.ts [options]

Options:
  --english, -e <text>   English tweet text (required unless --from-queue)
  --persian, -p <text>   Persian tweet text (required unless --from-queue)
  --delay, -d <seconds>  Delay between posts (default: 120)
  --media, -m <path>     Media file to attach (can use multiple times)
  --confirm, -c          Pause for manual review before each post
  --dry-run              Navigate but don't actually post
  --from-queue, -q       Post from approved drafts queue
  --limit, -l <count>    Max drafts to post from queue (default: 1)
  --help, -h             Show this help message

Examples:
  # Text only
  npx tsx src/post-tweets.ts \\
    -e "🇮🇷 BREAKING: News here" \\
    -p "🇮🇷 فوری: خبر اینجا"

  # With media
  npx tsx src/post-tweets.ts \\
    -e "BREAKING: Protests in Tehran" \\
    -p "فوری: اعتراضات در تهران" \\
    -m media/photo1.jpg \\
    -m media/video.mp4

  # From queue (post next approved draft)
  npx tsx src/post-tweets.ts --from-queue

  # From queue with dry run
  npx tsx src/post-tweets.ts --from-queue --dry-run --limit 3
`);
}

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

async function uploadMedia(page: Awaited<ReturnType<typeof launchBrowser>>['page'], mediaFiles: string[]): Promise<boolean> {
  if (mediaFiles.length === 0) return true;

  console.log(`Uploading ${mediaFiles.length} media file(s)...`);

  const fileInput = await page.$('input[type="file"][accept*="image"],input[type="file"][accept*="video"]');
  if (!fileInput) {
    const mediaButton = await findElement(page, [
      '[data-testid="fileInput"]',
      '[aria-label="Add photos or video"]',
      'input[type="file"]'
    ], 5000);

    if (!mediaButton) {
      console.warn('Could not find media upload input');
      return false;
    }
  }

  const input = await page.$('input[type="file"]');
  if (input) {
    await input.setInputFiles(mediaFiles);
    await sleep(2000);

    // Wait for upload to complete
    for (let i = 0; i < 30; i++) {
      const uploading = await page.$('[data-testid="attachments"] [role="progressbar"]');
      if (!uploading) break;
      await sleep(500);
    }

    console.log('✓ Media uploaded');
    return true;
  }

  return false;
}

async function postTweet(
  page: Awaited<ReturnType<typeof launchBrowser>>['page'],
  text: string,
  label: string,
  options: PostOptions,
  includeMedia: boolean = false
): Promise<boolean> {
  console.log(`\n--- Posting ${label} tweet ---`);

  if (await detectCaptcha(page)) {
    console.log('⚠ CAPTCHA detected! Please solve it manually in the browser.');
    await waitForEnter('Press Enter after solving the CAPTCHA...');
  }

  if (await detectRateLimit(page)) {
    console.log('⚠ Rate limit detected. Waiting 15 minutes...');
    await countdownTimer(900, 'Rate limit cooldown');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  }

  const composeButton = await findElement(page, selectors.composeButton, 15000);
  if (!composeButton) {
    console.error('✗ Could not find compose button');
    return false;
  }

  await humanDelay(500);
  await composeButton.click();
  await humanDelay(1000);

  // Upload media first if this is the English tweet
  if (includeMedia && options.media.length > 0) {
    await uploadMedia(page, options.media);
  }

  const tweetInput = await findElement(page, selectors.tweetInput, 10000);
  if (!tweetInput) {
    console.error('✗ Could not find tweet input');
    return false;
  }

  console.log(`Typing tweet (${text.length} chars)...`);
  await typeWithHumanDelay(tweetInput, text);
  await humanDelay(500);

  await takeScreenshot(page, `${label}-preview`);

  if (options.confirm) {
    console.log('\n--- PREVIEW ---');
    console.log(text);
    if (includeMedia && options.media.length > 0) {
      console.log(`Media: ${options.media.length} file(s)`);
    }
    console.log('---------------\n');
    await waitForEnter('Press Enter to post (or Ctrl+C to cancel)...');
  }

  if (options.dryRun) {
    console.log('✓ [DRY RUN] Would have posted tweet');
    await page.keyboard.press('Escape');
    await humanDelay(500);
    return true;
  }

  const postButton = await findElement(page, selectors.postButton, 10000);
  if (!postButton) {
    console.error('✗ Could not find post button');
    return false;
  }

  await humanDelay(randomDelay(300, 800));
  await postButton.click();

  await sleep(3000);

  if (await detectRateLimit(page)) {
    console.log('✗ Rate limited after posting attempt');
    return false;
  }

  await takeScreenshot(page, `${label}-posted`);
  console.log(`✓ ${label} tweet posted successfully!`);

  return true;
}

async function loadApprovedDrafts(): Promise<{ filename: string; draft: DraftTweet }[]> {
  await mkdir(APPROVED_DIR, { recursive: true });
  await mkdir(POSTED_DIR, { recursive: true });

  if (!existsSync(APPROVED_DIR)) return [];

  const files = await readdir(APPROVED_DIR);
  const drafts: { filename: string; draft: DraftTweet }[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await readFile(path.join(APPROVED_DIR, file), 'utf-8');
      drafts.push({ filename: file, draft: JSON.parse(content) });
    } catch (error) {
      console.warn(`Error loading ${file}:`, error);
    }
  }

  return drafts.sort((a, b) => a.draft.id.localeCompare(b.draft.id));
}

async function markAsPosted(filename: string, draft: DraftTweet): Promise<void> {
  const postedDraft = {
    ...draft,
    postedAt: new Date().toISOString()
  };

  await writeFile(
    path.join(POSTED_DIR, filename),
    JSON.stringify(postedDraft, null, 2)
  );

  await rename(
    path.join(APPROVED_DIR, filename),
    path.join(POSTED_DIR, filename)
  ).catch(() => {});
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.fromQueue) {
    await runQueueMode(options);
  } else {
    await runManualMode(options);
  }
}

async function runManualMode(options: PostOptions): Promise<void> {
  if (!options.english || !options.persian) {
    console.error('Error: Both --english and --persian are required');
    printHelp();
    process.exit(1);
  }

  if (!hasAuthFile()) {
    console.error('Error: No auth.json found. Run save-session.ts first to log in.');
    process.exit(1);
  }

  console.log('=== Faytuks X Tweet Poster ===\n');
  console.log('Mode:', options.dryRun ? 'DRY RUN' : 'LIVE');
  console.log('Confirm:', options.confirm ? 'Yes' : 'No');
  console.log('Delay between posts:', options.delay, 'seconds');
  if (options.media.length > 0) {
    console.log('Media files:', options.media.length);
  }
  console.log('');

  const session = await launchBrowser(false);
  const { page } = session;

  try {
    console.log('Loading X.com...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2000);

    if (!(await isLoggedIn(page))) {
      console.error('✗ Not logged in. Please run save-session.ts to refresh your login.');
      await closeBrowser(session);
      process.exit(1);
    }

    console.log('✓ Logged in successfully');
    await takeScreenshot(page, 'initial');

    const englishSuccess = await postTweet(page, options.english, 'english', options, true);

    if (!englishSuccess) {
      console.error('✗ Failed to post English tweet. Aborting.');
      await closeBrowser(session);
      process.exit(1);
    }

    console.log(`\nWaiting ${options.delay} seconds before Persian tweet...`);
    await countdownTimer(options.delay, 'Delay');

    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await humanDelay(2000);

    const persianSuccess = await postTweet(page, options.persian, 'persian', options, true);

    if (!persianSuccess) {
      console.error('✗ Failed to post Persian tweet.');
    }

    await takeScreenshot(page, 'final');

    console.log('\n=== Summary ===');
    console.log('English tweet:', englishSuccess ? '✓ Posted' : '✗ Failed');
    console.log('Persian tweet:', persianSuccess ? '✓ Posted' : '✗ Failed');

  } catch (error) {
    console.error('Error:', error);
    await takeScreenshot(page, 'error');
  } finally {
    console.log('\nClosing browser...');
    await closeBrowser(session);
  }
}

async function runQueueMode(options: PostOptions): Promise<void> {
  console.log('=== Faytuks X Tweet Poster (Queue Mode) ===\n');

  const drafts = await loadApprovedDrafts();

  if (drafts.length === 0) {
    console.log('No approved drafts in queue.');
    console.log('Run `npm run review` to approve pending drafts first.');
    return;
  }

  const toPost = drafts.slice(0, options.queueLimit);
  console.log(`Approved drafts: ${drafts.length}`);
  console.log(`Will post: ${toPost.length}`);
  console.log('Mode:', options.dryRun ? 'DRY RUN' : 'LIVE');
  console.log('');

  if (!hasAuthFile()) {
    console.error('Error: No auth.json found. Run save-session.ts first to log in.');
    process.exit(1);
  }

  const session = await launchBrowser(false);
  const { page } = session;

  let posted = 0;
  let failed = 0;

  try {
    console.log('Loading X.com...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2000);

    if (!(await isLoggedIn(page))) {
      console.error('✗ Not logged in. Please run save-session.ts to refresh your login.');
      await closeBrowser(session);
      process.exit(1);
    }

    console.log('✓ Logged in successfully\n');

    for (let i = 0; i < toPost.length; i++) {
      const { filename, draft } = toPost[i];

      console.log('═'.repeat(50));
      console.log(`Draft ${i + 1}/${toPost.length}: ${draft.id} [${draft.theme}]`);
      console.log('═'.repeat(50));

      const draftOptions: PostOptions = {
        ...options,
        english: draft.english,
        persian: draft.persian,
      };

      const englishSuccess = await postTweet(page, draft.english, 'english', draftOptions, true);

      if (!englishSuccess) {
        console.error('✗ Failed to post English tweet');
        failed++;
        continue;
      }

      console.log(`\nWaiting ${options.delay} seconds before Persian tweet...`);
      await countdownTimer(options.delay, 'Delay');

      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await humanDelay(2000);

      const persianSuccess = await postTweet(page, draft.persian, 'persian', draftOptions, true);

      if (englishSuccess && persianSuccess) {
        if (!options.dryRun) {
          await markAsPosted(filename, draft);
          console.log(`✓ Moved to posted/`);
        }
        posted++;
      } else {
        failed++;
      }

      if (i < toPost.length - 1) {
        console.log(`\nWaiting 60 seconds before next draft...`);
        await countdownTimer(60, 'Between drafts');
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await humanDelay(2000);
      }
    }

    console.log('\n' + '═'.repeat(50));
    console.log('QUEUE SUMMARY');
    console.log('═'.repeat(50));
    console.log(`Posted: ${posted}`);
    console.log(`Failed: ${failed}`);
    console.log(`Remaining in queue: ${drafts.length - posted}`);

  } catch (error) {
    console.error('Error:', error);
    await takeScreenshot(page, 'error');
  } finally {
    console.log('\nClosing browser...');
    await closeBrowser(session);
  }
}

main().catch(console.error);
