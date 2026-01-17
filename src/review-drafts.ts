#!/usr/bin/env npx tsx

import { readFile, writeFile, readdir, rename, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
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
  factIds?: string[];
  narrativeId?: string;
}

const DRAFTS_DIR = path.join(process.cwd(), 'drafts');
const PENDING_DIR = path.join(DRAFTS_DIR, 'pending');
const APPROVED_DIR = path.join(DRAFTS_DIR, 'approved');
const REJECTED_DIR = path.join(DRAFTS_DIR, 'rejected');

async function ensureDirectories(): Promise<void> {
  await mkdir(PENDING_DIR, { recursive: true });
  await mkdir(APPROVED_DIR, { recursive: true });
  await mkdir(REJECTED_DIR, { recursive: true });
}

async function loadPendingDrafts(): Promise<{ filename: string; draft: DraftTweet }[]> {
  if (!existsSync(PENDING_DIR)) return [];

  const files = await readdir(PENDING_DIR);
  const drafts: { filename: string; draft: DraftTweet }[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await readFile(path.join(PENDING_DIR, file), 'utf-8');
      drafts.push({ filename: file, draft: JSON.parse(content) });
    } catch (error) {
      console.warn(`Error loading ${file}:`, error);
    }
  }

  return drafts.sort((a, b) => a.draft.id.localeCompare(b.draft.id));
}

function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function promptMultiline(rl: readline.Interface, label: string, current: string): Promise<string> {
  console.log(`\nCurrent ${label}:`);
  console.log(`  ${current}`);
  console.log(`\nEnter new ${label} (or press Enter to keep current):`);

  return new Promise((resolve) => {
    rl.question('> ', (answer) => {
      resolve(answer.trim() || current);
    });
  });
}

function displayDraft(draft: DraftTweet, index: number, total: number): void {
  console.log('\n' + '═'.repeat(60));
  console.log(`Draft ${index + 1}/${total} — ${draft.id}`);
  console.log('═'.repeat(60));

  console.log(`\n📌 Theme: ${draft.theme}`);
  if (draft.narrativeId) {
    console.log(`📖 Narrative: ${draft.narrativeId}`);
  }

  console.log(`\n🇬🇧 English (${draft.english.length}/280 chars):`);
  console.log(`   ${draft.english}`);

  console.log(`\n🇮🇷 Persian (${draft.persian.length}/280 chars):`);
  console.log(`   ${draft.persian}`);

  console.log(`\n📰 Sources: ${draft.sources.join(', ') || 'none'}`);
  console.log(`#️⃣ Hashtags: ${draft.hashtags.join(' ') || 'none'}`);

  if (draft.factIds && draft.factIds.length > 0) {
    console.log(`📋 Facts: ${draft.factIds.join(', ')}`);
  }

  console.log(`\n⏰ Generated: ${draft.generatedAt}`);
}

async function reviewDraft(
  rl: readline.Interface,
  draft: DraftTweet,
  filename: string,
  index: number,
  total: number
): Promise<'approved' | 'rejected' | 'skipped' | 'edited' | 'quit'> {
  displayDraft(draft, index, total);

  console.log('\n' + '─'.repeat(60));
  console.log('[A]pprove  [E]dit  [R]eject  [S]kip  [Q]uit');

  const action = await prompt(rl, '\nAction: ');

  switch (action) {
    case 'a':
    case 'approve':
      await rename(
        path.join(PENDING_DIR, filename),
        path.join(APPROVED_DIR, filename)
      );
      console.log('✓ Approved → drafts/approved/');
      return 'approved';

    case 'e':
    case 'edit':
      const editedDraft = { ...draft };
      editedDraft.english = await promptMultiline(rl, 'English', draft.english);
      editedDraft.persian = await promptMultiline(rl, 'Persian', draft.persian);

      await writeFile(
        path.join(PENDING_DIR, filename),
        JSON.stringify(editedDraft, null, 2)
      );
      console.log('✓ Edited and saved. Review again to approve.');
      return 'edited';

    case 'r':
    case 'reject':
      await rename(
        path.join(PENDING_DIR, filename),
        path.join(REJECTED_DIR, filename)
      );
      console.log('✗ Rejected → drafts/rejected/');
      return 'rejected';

    case 's':
    case 'skip':
      console.log('→ Skipped');
      return 'skipped';

    case 'q':
    case 'quit':
      return 'quit';

    default:
      console.log('Unknown action, skipping...');
      return 'skipped';
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let autoApprove = false;
  let listOnly = false;

  for (const arg of args) {
    if (arg === '--auto' || arg === '-a') autoApprove = true;
    if (arg === '--list' || arg === '-l') listOnly = true;
    if (arg === '--help' || arg === '-h') {
      console.log(`
Faytuks Draft Review CLI

Usage: npx tsx src/review-drafts.ts [options]

Options:
  --list, -l     List pending drafts without reviewing
  --auto, -a     Auto-approve all drafts (no prompts)
  --help, -h     Show this help message

Actions during review:
  [A]pprove      Move to approved queue
  [E]dit         Edit tweet text
  [R]eject       Move to rejected folder
  [S]kip         Leave in pending
  [Q]uit         Exit review
`);
      return;
    }
  }

  await ensureDirectories();
  const drafts = await loadPendingDrafts();

  console.log('═'.repeat(60));
  console.log('       FAYTUKS DRAFT REVIEW');
  console.log('═'.repeat(60));
  console.log(`\nPending drafts: ${drafts.length}`);

  if (drafts.length === 0) {
    console.log('No drafts to review.');
    return;
  }

  if (listOnly) {
    console.log('\nPending drafts:');
    for (const { draft } of drafts) {
      console.log(`  - ${draft.id} [${draft.theme}]: ${draft.english.slice(0, 50)}...`);
    }
    return;
  }

  if (autoApprove) {
    console.log('\nAuto-approving all drafts...');
    for (const { filename, draft } of drafts) {
      await rename(
        path.join(PENDING_DIR, filename),
        path.join(APPROVED_DIR, filename)
      );
      console.log(`✓ Approved: ${draft.id}`);
    }
    console.log(`\n=== Done: ${drafts.length} drafts approved ===`);
    return;
  }

  const rl = createReadline();
  const stats = { approved: 0, rejected: 0, skipped: 0, edited: 0 };

  for (let i = 0; i < drafts.length; i++) {
    const { filename, draft } = drafts[i];
    const result = await reviewDraft(rl, draft, filename, i, drafts.length);

    if (result === 'quit') {
      console.log('\nExiting review...');
      break;
    }

    if (result === 'edited') {
      i--;
      stats.edited++;
    } else {
      stats[result]++;
    }
  }

  rl.close();

  console.log('\n' + '═'.repeat(60));
  console.log('REVIEW SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Approved: ${stats.approved}`);
  console.log(`  Rejected: ${stats.rejected}`);
  console.log(`  Skipped:  ${stats.skipped}`);
  console.log(`  Edited:   ${stats.edited}`);

  const approvedCount = (await readdir(APPROVED_DIR)).filter((f) => f.endsWith('.json')).length;
  console.log(`\nReady to post: ${approvedCount} drafts in drafts/approved/`);
}

main().catch(console.error);
