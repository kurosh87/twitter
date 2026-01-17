#!/usr/bin/env npx tsx

/**
 * Thematic Tweet Generator
 *
 * Generates original analytical tweets based on historical knowledge,
 * geopolitical context, and narrative patterns - not just reacting to
 * expert discourse.
 *
 * Usage:
 *   npm run thematic -- --focus history --period long
 *   npm run thematic -- --focus iran-vs-iraq
 *   npm run thematic -- --focus parallels
 *   npm run thematic -- --focus geopolitics --period mid
 */

import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { generateWithClaude, type DraftTweet } from './lib/ai';
import { loadExtendedKnowledge, type ThematicPeriod } from './knowledge/loader';
import {
  buildThematicPrompt,
  type ThematicFocus,
  type ThematicPromptOptions,
} from './prompts/thematic-synthesis';
import { validateAndFilterDrafts } from './facts-engine';

interface ThematicDraft extends DraftTweet {
  historicalReference?: string;
  factIds?: string[];
}

interface Options {
  focus: ThematicFocus;
  period: ThematicPeriod;
  maxTweets: number;
  model: 'opus' | 'sonnet';
  includePersian: boolean;
  dryRun: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    focus: 'mixed',
    period: 'all',
    maxTweets: 3,
    model: 'opus',
    includePersian: true,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--focus':
      case '-f':
        options.focus = args[++i] as ThematicFocus;
        break;
      case '--period':
      case '-p':
        options.period = args[++i] as ThematicPeriod;
        break;
      case '--max':
      case '-m':
        options.maxTweets = parseInt(args[++i] || '3', 10);
        break;
      case '--sonnet':
        options.model = 'sonnet';
        break;
      case '--opus':
        options.model = 'opus';
        break;
      case '--no-persian':
        options.includePersian = false;
        break;
      case '--dry-run':
        options.dryRun = true;
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
Faytuks Thematic Tweet Generator

Usage: npx tsx src/thematic-synthesize.ts [options]

Options:
  --focus, -f <type>     Focus area for tweets (default: mixed)
                         history | geopolitics | parallels | iran-vs-iraq |
                         unity | counter-revolution | mixed

  --period, -p <period>  Historical period to emphasize (default: all)
                         near (48h) | mid (1979-2025) | long (1953-present) | all

  --max, -m <count>      Maximum tweets to generate (default: 3)
  --sonnet               Use Claude Sonnet (faster, cheaper)
  --opus                 Use Claude Opus (default, better quality)
  --no-persian           Generate English only
  --dry-run              Show prompt without generating
  --help, -h             Show this help message

Examples:
  # Historical parallels (Cinema Rex -> Rasht)
  npm run thematic -- --focus parallels

  # Counter the "don't repeat Iraq" narrative
  npm run thematic -- --focus iran-vs-iraq

  # Deep historical context
  npm run thematic -- --focus history --period long

  # Gulf Paradox and Western silence
  npm run thematic -- --focus geopolitics

  # Counter-revolution thesis (Hitchens)
  npm run thematic -- --focus counter-revolution

  # Mixed bag of all themes
  npm run thematic -- --focus mixed --max 5
`);
}

async function saveDrafts(drafts: ThematicDraft[], focus: ThematicFocus): Promise<void> {
  const pendingDir = path.join(process.cwd(), 'drafts', 'pending');
  await mkdir(pendingDir, { recursive: true });

  for (const draft of drafts) {
    const filename = `thematic-${focus}-${draft.id}.json`;
    await writeFile(
      path.join(pendingDir, filename),
      JSON.stringify(draft, null, 2)
    );
    console.log(`  Saved: drafts/pending/${filename}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('=== Faytuks Thematic Tweet Generator ===\n');
  console.log(`Focus: ${options.focus}`);
  console.log(`Period: ${options.period}`);
  console.log(`Max tweets: ${options.maxTweets}`);
  console.log(`Model: Claude ${options.model}`);
  console.log(`Persian: ${options.includePersian ? 'Yes' : 'No'}`);
  console.log('');

  console.log('Loading extended knowledge...');
  const knowledge = await loadExtendedKnowledge();

  console.log(`  Events: ${knowledge.events.length}`);
  console.log(`  Facts: ${knowledge.facts.length} (${knowledge.usableFacts.length} usable)`);
  console.log(`  Actors: ${knowledge.actors.length}`);
  console.log(`  Narratives: ${knowledge.narratives.length}`);
  console.log(`  History: ${knowledge.history ? 'loaded' : 'not found'}`);
  console.log(`  Geopolitics: ${knowledge.geopolitics ? 'loaded' : 'not found'}`);
  console.log(`  Geography/Unity: ${knowledge.geographyUnity ? 'loaded' : 'not found'}`);
  console.log(`  Iran vs Iraq: ${knowledge.iranNotIraq ? 'loaded' : 'not found'}`);
  console.log('');

  const promptOptions: ThematicPromptOptions = {
    period: options.period,
    focus: options.focus,
    maxTweets: options.maxTweets,
    includePersian: options.includePersian,
  };

  const systemPrompt = buildThematicPrompt(knowledge, promptOptions);

  if (options.dryRun) {
    console.log('=== DRY RUN - Generated Prompt ===\n');
    console.log(systemPrompt);
    console.log('\n=== End Prompt ===');
    return;
  }

  console.log(`Generating thematic tweets with Claude ${options.model}...`);
  console.log(`Prompt length: ${systemPrompt.length} chars\n`);

  const userPrompt = `Generate ${options.maxTweets} thematic tweets focused on: ${options.focus}

Current date: ${new Date().toISOString().slice(0, 10)}

Use the historical context and verified facts provided. Each tweet should illuminate a pattern or connection that helps readers understand what's happening in Iran.`;

  const text = await generateWithClaude(systemPrompt, userPrompt, options.model);

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('No JSON array found in response');
    console.log('Raw response:', text);
    return;
  }

  let rawDrafts: ThematicDraft[];
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    rawDrafts = parsed.map((d: any, i: number) => ({
      id: `${new Date().toISOString().slice(0, 10)}-thematic-${String(i + 1).padStart(3, '0')}`,
      generatedAt: new Date().toISOString(),
      theme: d.theme || options.focus,
      english: d.english || d.en || '',
      persian: d.persian || d.fa || d.farsi || '',
      sources: d.sources || [],
      hashtags: d.hashtags || [],
      factIds: d.factIds || [],
      historicalReference: d.historicalReference || '',
    }));
  } catch (e) {
    console.error('Failed to parse drafts:', e);
    console.log('Raw JSON:', jsonMatch[0]);
    return;
  }

  const { valid: drafts, warnings } = await validateAndFilterDrafts(rawDrafts);

  if (warnings.length > 0) {
    console.log('\nValidation Warnings:');
    for (const warning of warnings) {
      console.log(`  ${warning}`);
    }
  }

  console.log(`\nGenerated ${drafts.length} thematic tweets:\n`);

  for (const draft of drafts) {
    console.log(`${'='.repeat(60)}`);
    console.log(`THEME: ${draft.theme.toUpperCase()}`);
    if ((draft as ThematicDraft).historicalReference) {
      console.log(`REFERENCE: ${(draft as ThematicDraft).historicalReference}`);
    }
    console.log(`${'='.repeat(60)}`);
    console.log(`\nEN: ${draft.english}`);
    console.log(`    (${draft.english.length} chars)`);
    if (draft.persian) {
      console.log(`\nFA: ${draft.persian}`);
      console.log(`    (${draft.persian.length} chars)`);
    }
    if ((draft as ThematicDraft).factIds?.length) {
      console.log(`\nFacts: ${(draft as ThematicDraft).factIds?.join(', ')}`);
    }
    console.log('');
  }

  await saveDrafts(drafts as ThematicDraft[], options.focus);

  console.log('\n=== Summary ===');
  console.log(`Generated: ${drafts.length} thematic tweets`);
  console.log(`Focus: ${options.focus}`);
  console.log(`Period: ${options.period}`);
  console.log(`Saved to: drafts/pending/`);
}

main().catch(console.error);
