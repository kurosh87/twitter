#!/usr/bin/env npx tsx

/**
 * Faytuks 24/7 Synthesis Daemon
 *
 * Runs continuously, performing hourly synthesis cycles:
 * 1. Scrape all buckets (last 24h)
 * 2. Analyze patterns
 * 3. Extract events and update knowledge base
 * 4. Generate LLM drafts with validation
 * 5. Save to pending queue
 *
 * Usage:
 *   npm run daemon                 # Run in foreground
 *   pm2 start npm -- run daemon    # Run with pm2
 */

import { spawn } from 'child_process';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const CYCLE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const BUCKETS = ['commentary', 'geopolitics'];
const THEMATIC_FOCUSES = ['history', 'geopolitics', 'parallels', 'iran-vs-iraq', 'unity', 'counter-revolution'];

let cycleCount = 0;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function runCommand(cmd: string, args: string[]): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { output += data.toString(); });

    proc.on('close', (code) => {
      resolve({ success: code === 0, output });
    });

    proc.on('error', (err) => {
      resolve({ success: false, output: err.message });
    });
  });
}

async function scrapeBucket(bucket: string): Promise<boolean> {
  log(`Scraping bucket: ${bucket}`);
  const result = await runCommand('npx', ['tsx', 'src/scrape-bucket.ts', '--bucket', bucket, '--weeks', '1']);
  if (!result.success) {
    log(`  Scrape failed: ${result.output.slice(-200)}`);
  }
  return result.success;
}

async function analyzeBucket(bucket: string): Promise<boolean> {
  log(`Analyzing bucket: ${bucket}`);
  const result = await runCommand('npx', ['tsx', 'src/analyze-bucket.ts', '--bucket', bucket]);
  if (!result.success) {
    log(`  Analysis failed: ${result.output.slice(-200)}`);
  }
  return result.success;
}

async function runEventExtraction(): Promise<boolean> {
  log('Extracting events from tweets...');
  const result = await runCommand('npx', ['tsx', 'src/extract-events.ts', '--hours', '24']);
  if (!result.success) {
    log(`  Extraction failed: ${result.output.slice(-200)}`);
  } else {
    const eventsMatch = result.output.match(/Events added: (\d+)/);
    const factsMatch = result.output.match(/Facts added: (\d+)/);
    if (eventsMatch || factsMatch) {
      log(`  Events: ${eventsMatch?.[1] || 0} added, Facts: ${factsMatch?.[1] || 0} added`);
    }
  }
  return result.success;
}

async function runLLMSynthesis(): Promise<boolean> {
  log('Running LLM synthesis (reactive)...');
  const result = await runCommand('npx', ['tsx', 'src/llm-synthesize.ts']);
  if (!result.success) {
    log(`  Synthesis failed: ${result.output.slice(-200)}`);
  } else {
    const match = result.output.match(/Generated (\d+) drafts/);
    if (match) {
      log(`  Generated ${match[1]} reactive drafts`);
    }
    const warningsMatch = result.output.match(/Validation Warnings:/);
    if (warningsMatch) {
      log(`  ⚠ Some drafts have validation warnings`);
    }
  }
  return result.success;
}

async function runThematicSynthesis(focus: string): Promise<boolean> {
  log(`Running thematic synthesis (focus: ${focus})...`);
  const result = await runCommand('npx', ['tsx', 'src/thematic-synthesize.ts', '--focus', focus, '--max', '2']);
  if (!result.success) {
    log(`  Thematic synthesis failed: ${result.output.slice(-200)}`);
  } else {
    const match = result.output.match(/Generated: (\d+) thematic tweets/);
    if (match) {
      log(`  Generated ${match[1]} thematic drafts (${focus})`);
    }
  }
  return result.success;
}

async function countPendingDrafts(): Promise<number> {
  const pendingDir = path.join(process.cwd(), 'drafts', 'pending');
  if (!existsSync(pendingDir)) return 0;
  const files = await readdir(pendingDir);
  return files.filter(f => f.endsWith('.json')).length;
}

async function runCycle(): Promise<void> {
  cycleCount++;
  const isThematicCycle = cycleCount % 3 === 0; // Every 3rd cycle is thematic-focused

  log('═══════════════════════════════════════════════════════');
  log(`Starting synthesis cycle #${cycleCount} (${isThematicCycle ? 'THEMATIC' : 'REACTIVE'})`);
  log('═══════════════════════════════════════════════════════');

  const startTime = Date.now();

  // 1. Scrape all buckets
  for (const bucket of BUCKETS) {
    try {
      await scrapeBucket(bucket);
    } catch (e) {
      log(`Scrape error for ${bucket}: ${e}`);
    }
    await sleep(5000); // Brief pause between buckets
  }

  // 2. Analyze all buckets
  for (const bucket of BUCKETS) {
    try {
      await analyzeBucket(bucket);
    } catch (e) {
      log(`Analyze error for ${bucket}: ${e}`);
    }
  }

  // 3. Extract events and update knowledge base
  try {
    await runEventExtraction();
  } catch (e) {
    log(`Extraction error: ${e}`);
  }

  // 4. Run reactive LLM synthesis (every cycle)
  try {
    await runLLMSynthesis();
  } catch (e) {
    log(`Reactive synthesis error: ${e}`);
  }

  // 5. Run thematic synthesis (every 3rd cycle, rotating focus)
  if (isThematicCycle) {
    const focusIndex = Math.floor(cycleCount / 3) % THEMATIC_FOCUSES.length;
    const focus = THEMATIC_FOCUSES[focusIndex];
    try {
      await runThematicSynthesis(focus);
    } catch (e) {
      log(`Thematic synthesis error: ${e}`);
    }
  }

  // 6. Report status
  const pendingCount = await countPendingDrafts();
  const elapsed = Math.round((Date.now() - startTime) / 1000);

  log('───────────────────────────────────────────────────────');
  log(`Cycle #${cycleCount} complete in ${elapsed}s`);
  log(`Pending drafts: ${pendingCount}`);
  if (isThematicCycle) {
    const nextFocusIndex = Math.floor((cycleCount + 3) / 3) % THEMATIC_FOCUSES.length;
    log(`Next thematic focus (cycle ${cycleCount + 3}): ${THEMATIC_FOCUSES[nextFocusIndex]}`);
  }
  log('───────────────────────────────────────────────────────');
}

async function main() {
  log('╔═══════════════════════════════════════════════════════╗');
  log('║       FAYTUKS SYNTHESIS DAEMON STARTING               ║');
  log('╚═══════════════════════════════════════════════════════╝');
  log(`Cycle interval: ${CYCLE_INTERVAL_MS / 1000 / 60} minutes`);
  log(`Buckets: ${BUCKETS.join(', ')}`);
  log(`Synthesis modes: Reactive (every cycle) + Thematic (every 3rd cycle)`);
  log(`Thematic focuses: ${THEMATIC_FOCUSES.join(', ')}`);
  log('');

  // Create drafts directories
  await mkdir(path.join(process.cwd(), 'drafts', 'pending'), { recursive: true });
  await mkdir(path.join(process.cwd(), 'drafts', 'approved'), { recursive: true });
  await mkdir(path.join(process.cwd(), 'drafts', 'posted'), { recursive: true });

  // Run first cycle immediately
  await runCycle();

  // Then run on interval
  while (true) {
    log(`Next cycle in ${CYCLE_INTERVAL_MS / 1000 / 60} minutes...`);
    await sleep(CYCLE_INTERVAL_MS);
    await runCycle();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down...');
  process.exit(0);
});

main().catch((e) => {
  log(`Fatal error: ${e}`);
  process.exit(1);
});
