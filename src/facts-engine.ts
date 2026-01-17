import { readFile, writeFile } from 'fs/promises';
import path from 'path';

export interface Fact {
  id: string;
  statement: string;
  persianStatement: string;
  category: string;
  confidence: 'verified' | 'reported' | 'unconfirmed';
  sources: string[];
  dateAdded: string;
  usageCount: number;
  lastUsed?: string;
}

export interface Actor {
  id: string;
  name: string;
  persianName: string;
  type: 'regime' | 'opposition' | 'western_hypocrite' | 'western_ally' | 'journalist';
  role: string;
  twitterHandle?: string;
  stance: string;
  keyActions: string[];
  lastUpdated: string;
}

export interface Narrative {
  id: string;
  title: string;
  persianTitle: string;
  description: string;
  status: 'active' | 'developing' | 'archived';
  priority: number;
  keyFacts: string[];
  relatedCategories: string[];
  relatedActors: string[];
  tweetAngle: string;
  hashtags: string[];
  frequency?: string;
  lastUpdated: string;
}

interface GenerationHistoryEntry {
  id: string;
  theme: string;
  narrativeId: string;
  generatedAt: string;
  factIds: string[];
}

interface GenerationHistory {
  recentDrafts: GenerationHistoryEntry[];
  metadata: { lastUpdated: string; version: string };
}

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

export async function loadFacts(): Promise<Fact[]> {
  const data = JSON.parse(await readFile(path.join(KNOWLEDGE_DIR, 'facts.json'), 'utf-8'));
  return data.facts;
}

export async function loadActors(): Promise<Actor[]> {
  const data = JSON.parse(await readFile(path.join(KNOWLEDGE_DIR, 'actors.json'), 'utf-8'));
  return data.actors;
}

export async function loadNarratives(): Promise<Narrative[]> {
  const data = JSON.parse(await readFile(path.join(KNOWLEDGE_DIR, 'narratives.json'), 'utf-8'));
  return data.narratives;
}

async function loadGenerationHistory(): Promise<GenerationHistory> {
  const data = JSON.parse(await readFile(path.join(KNOWLEDGE_DIR, 'generation-history.json'), 'utf-8'));
  return data;
}

async function saveGenerationHistory(history: GenerationHistory): Promise<void> {
  history.metadata.lastUpdated = new Date().toISOString();
  await writeFile(
    path.join(KNOWLEDGE_DIR, 'generation-history.json'),
    JSON.stringify(history, null, 2)
  );
}

function daysBetween(date1: string, date2: Date): number {
  const d1 = new Date(date1);
  return Math.floor((date2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function scoreFact(fact: Fact, allFacts: Fact[], now: Date): number {
  const daysSinceAdded = daysBetween(fact.dateAdded, now);
  const freshnessScore = Math.max(0, 30 - daysSinceAdded) / 30;

  const maxUsage = Math.max(...allFacts.map(f => f.usageCount), 1);
  const coverageScore = 1 - (fact.usageCount / maxUsage);

  const confidenceBoost = fact.confidence === 'verified' ? 0.2 : 0;

  return (freshnessScore * 0.4) + (coverageScore * 0.4) + confidenceBoost;
}

function parseFrequencyLimit(frequency?: string): { max: number; window: number } | null {
  if (!frequency) return null;
  const match = frequency.match(/(\d+)\s*in\s*(\d+)/i);
  if (match) {
    return { max: parseInt(match[1], 10), window: parseInt(match[2], 10) };
  }
  return null;
}

async function isNarrativeAllowed(narrative: Narrative, history: GenerationHistory): Promise<boolean> {
  const limit = parseFrequencyLimit(narrative.frequency);
  if (!limit) return true;

  const recentOfNarrative = history.recentDrafts
    .slice(-limit.window)
    .filter(d => d.narrativeId === narrative.id);

  return recentOfNarrative.length < limit.max;
}

export interface BuildContextOptions {
  maxFactsPerNarrative?: number;
  includeActors?: boolean;
}

export async function buildFactsContext(options: BuildContextOptions = {}): Promise<{
  context: string;
  includedFactIds: string[];
  includedNarrativeIds: string[];
}> {
  const { maxFactsPerNarrative = 4, includeActors = true } = options;

  const [facts, actors, narratives, history] = await Promise.all([
    loadFacts(),
    loadActors(),
    loadNarratives(),
    loadGenerationHistory()
  ]);

  const now = new Date();
  const includedFactIds: string[] = [];
  const includedNarrativeIds: string[] = [];
  const referencedActorIds = new Set<string>();

  const activeNarratives = narratives
    .filter(n => n.status === 'active' || n.status === 'developing')
    .sort((a, b) => b.priority - a.priority);

  let context = '## ACTIVE NARRATIVES\n\n';

  for (const narrative of activeNarratives) {
    const allowed = await isNarrativeAllowed(narrative, history);
    if (!allowed) continue;

    includedNarrativeIds.push(narrative.id);

    const relevantFacts = facts
      .filter(f => narrative.relatedCategories.includes(f.category))
      .map(f => ({ fact: f, score: scoreFact(f, facts, now) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxFactsPerNarrative);

    context += `### [P${narrative.priority}] ${narrative.title}\n`;
    context += `${narrative.persianTitle}\n\n`;

    for (const { fact } of relevantFacts) {
      context += `- ${fact.statement}\n`;
      context += `  (${fact.persianStatement})\n`;
      includedFactIds.push(fact.id);
    }

    context += `\n→ Angle: ${narrative.tweetAngle}\n`;
    context += `→ Hashtags: ${narrative.hashtags.join(' ')}\n`;

    if (narrative.frequency) {
      context += `→ FREQUENCY LIMIT: ${narrative.frequency}\n`;
    }

    context += '\n';

    for (const actorId of narrative.relatedActors) {
      referencedActorIds.add(actorId);
    }
  }

  if (includeActors && referencedActorIds.size > 0) {
    context += '## KEY ACTORS\n\n';

    const actorsByType: Record<string, Actor[]> = {};
    for (const actor of actors) {
      if (!referencedActorIds.has(actor.id)) continue;
      if (!actorsByType[actor.type]) actorsByType[actor.type] = [];
      actorsByType[actor.type].push(actor);
    }

    const typeLabels: Record<string, string> = {
      regime: 'Regime',
      opposition: 'Opposition',
      western_hypocrite: 'Western Hypocrites (use sparingly)',
      western_ally: 'Western Allies',
      journalist: 'Journalists/Platforms'
    };

    for (const [type, typeActors] of Object.entries(actorsByType)) {
      context += `### ${typeLabels[type] || type}\n`;
      for (const actor of typeActors) {
        const handle = actor.twitterHandle ? ` (${actor.twitterHandle})` : '';
        context += `- **${actor.name}**${handle}: ${actor.role}\n`;
        context += `  ${actor.persianName}\n`;
        context += `  Stance: ${actor.stance}\n`;
        context += `  Actions: ${actor.keyActions.slice(0, 3).join('; ')}\n\n`;
      }
    }
  }

  return { context, includedFactIds, includedNarrativeIds };
}

export async function trackFactUsage(
  factIds: string[],
  narrativeId: string,
  draftId: string,
  theme: string
): Promise<void> {
  const [factsData, history] = await Promise.all([
    readFile(path.join(KNOWLEDGE_DIR, 'facts.json'), 'utf-8').then(JSON.parse),
    loadGenerationHistory()
  ]);

  const now = new Date().toISOString();

  for (const fact of factsData.facts) {
    if (factIds.includes(fact.id)) {
      fact.usageCount = (fact.usageCount || 0) + 1;
      fact.lastUsed = now;
    }
  }

  factsData.metadata.lastUpdated = now;
  await writeFile(
    path.join(KNOWLEDGE_DIR, 'facts.json'),
    JSON.stringify(factsData, null, 2)
  );

  history.recentDrafts.push({
    id: draftId,
    theme,
    narrativeId,
    generatedAt: now,
    factIds
  });

  if (history.recentDrafts.length > 50) {
    history.recentDrafts = history.recentDrafts.slice(-50);
  }

  await saveGenerationHistory(history);
}

export async function getContextStats(): Promise<{
  totalFacts: number;
  usedFacts: number;
  unusedFacts: number;
  activeNarratives: number;
  totalActors: number;
}> {
  const [facts, narratives, actors] = await Promise.all([
    loadFacts(),
    loadNarratives(),
    loadActors()
  ]);

  const usedFacts = facts.filter(f => f.usageCount > 0).length;

  return {
    totalFacts: facts.length,
    usedFacts,
    unusedFacts: facts.length - usedFacts,
    activeNarratives: narratives.filter(n => n.status === 'active').length,
    totalActors: actors.length
  };
}

export interface DraftValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  validFactIds: string[];
  invalidFactIds: string[];
  unconfirmedFactIds: string[];
}

export async function validateDraftFacts(
  draftFactIds: string[] | undefined
): Promise<DraftValidationResult> {
  const result: DraftValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
    validFactIds: [],
    invalidFactIds: [],
    unconfirmedFactIds: [],
  };

  if (!draftFactIds || draftFactIds.length === 0) {
    return result;
  }

  const facts = await loadFacts();
  const factMap = new Map(facts.map(f => [f.id, f]));

  for (const id of draftFactIds) {
    const fact = factMap.get(id);
    if (!fact) {
      result.invalidFactIds.push(id);
      result.errors.push(`Unknown fact ID: ${id}`);
      result.isValid = false;
    } else if (fact.confidence === 'unconfirmed') {
      result.unconfirmedFactIds.push(id);
      result.warnings.push(`Unconfirmed fact used: ${id} - "${fact.statement.slice(0, 50)}..."`);
    } else {
      result.validFactIds.push(id);
    }
  }

  return result;
}

export async function validateAndFilterDrafts<T extends { factIds?: string[]; theme: string }>(
  drafts: T[]
): Promise<{ valid: T[]; warnings: string[] }> {
  const valid: T[] = [];
  const warnings: string[] = [];

  for (const draft of drafts) {
    const validation = await validateDraftFacts(draft.factIds);

    if (validation.errors.length > 0) {
      warnings.push(`Draft [${draft.theme}] has invalid facts: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      warnings.push(...validation.warnings.map(w => `Draft [${draft.theme}]: ${w}`));
    }

    valid.push(draft);
  }

  return { valid, warnings };
}

export interface GeographicUnityData {
  geography: {
    title: string;
    persianTitle: string;
    terrain: Record<string, unknown>;
    invasion_history: { invasions: { invader: string; result: string }[]; lesson: string };
    strategic_reality_2026: { why_invasion_impossible: string[]; tweetAngle: string };
  };
  ethnic_unity: {
    title: string;
    persianTitle: string;
    ethnic_composition: Record<string, unknown>;
    why_unity_persists: { historical_tests: unknown[]; binding_forces: unknown[] };
    '2026_proof': { evidence: string[]; tweetAngle: string };
  };
}

export interface HistoryData {
  timeline: Record<string, unknown>;
  pahlavi_dynasty_continuity: { timeline: unknown[]; position: string; tweetAngle: string };
  cinema_rex_vs_rasht_bazaar: {
    title: string;
    cinema_rex_1978: { victims: string; blamed: string; actual_blame: string };
    rasht_bazaar_2026: { victims: string; blamed: string; actual_blame: string };
    narrative_connection: string;
  };
}

export interface GeopoliticsData {
  geopolitics: {
    title: string;
    the_paradox: { description: string };
    reasons_for_fear: Record<string, { title: string; details: string[] }>;
    current_positions: Record<string, unknown>;
    western_hypocrisy_connection: { tweetAngle: string };
  };
}

export async function loadGeographicUnity(): Promise<GeographicUnityData> {
  const data = JSON.parse(await readFile(path.join(KNOWLEDGE_DIR, 'geographical-unity.json'), 'utf-8'));
  return data;
}

export async function loadHistory(): Promise<HistoryData> {
  const data = JSON.parse(await readFile(path.join(KNOWLEDGE_DIR, 'history.json'), 'utf-8'));
  return data;
}

export async function loadGeopolitics(): Promise<GeopoliticsData> {
  const data = JSON.parse(await readFile(path.join(KNOWLEDGE_DIR, 'geopolitics.json'), 'utf-8'));
  return data;
}

export interface GreatPowersData {
  great_powers_and_iran: {
    title: string;
    persianTitle: string;
    iran_china_history: {
      title: string;
      ancient_era: { keyInsight: string };
      '19th_century_humiliation': { significance: string };
      modern_relations: { islamic_republic_era: { key_events: { event: string; description: string }[] } };
      tweet_angles: string[];
    };
    iran_russia_history: {
      title: string;
      treaty_of_turkmenchay_1828: { significance: string; terms: string[] };
      great_game_era: { key_events: { event: string; description: string }[] };
      tweet_angles: string[];
    };
    great_game_2026: {
      title: string;
      current_alignment: { problems: string[] };
      democratic_iran_position: { strategies: Record<string, unknown> };
      tweet_angles: string[];
    };
  };
}

export interface IranNotIraqData {
  iran_isnt_iraq_vietnam: {
    title: string;
    persianTitle: string;
    thesis: string;
    iraq_failure_analysis: { keyPoints: { factor: string; iraq: string; iran: string }[] };
    afghanistan_failure_analysis: { keyPoints: { factor: string; afghanistan: string; iran: string }[] };
    iran_unique_advantages: { advantages: { advantage: string; significance: string }[] };
    the_real_lesson_of_iraq: { lessons: string[]; applicationToIran: string };
    isolationism_critique: { argument: string; actualOptions: { option: string; description: string }[] };
  };
  tweet_angles: Record<string, string[]>;
}

export async function loadGreatPowers(): Promise<GreatPowersData> {
  const data = JSON.parse(await readFile(path.join(KNOWLEDGE_DIR, 'great-powers.json'), 'utf-8'));
  return data;
}

export async function loadIranNotIraq(): Promise<IranNotIraqData> {
  const data = JSON.parse(await readFile(path.join(KNOWLEDGE_DIR, 'iran-not-iraq.json'), 'utf-8'));
  return data;
}

export async function buildDeepContext(narrativeId: string): Promise<string> {
  let deepContext = '';

  if (narrativeId === 'cinema_rex_rasht_parallel') {
    const history = await loadHistory();
    const parallel = history.cinema_rex_vs_rasht_bazaar;
    deepContext = `
## HISTORICAL PARALLEL: FIRE AS WEAPON

### Cinema Rex 1978
- Date: August 19, 1978
- Victims: ${parallel.cinema_rex_1978.victims}
- Regime blamed: ${parallel.cinema_rex_1978.blamed}
- Truth: ${parallel.cinema_rex_1978.actual_blame}

### Rasht Bazaar 2026
- Date: January 8-9, 2026
- Victims: ${parallel.rasht_bazaar_2026.victims}
- Regime blamed: ${parallel.rasht_bazaar_2026.blamed}
- Truth: ${parallel.rasht_bazaar_2026.actual_blame}

### The Pattern
${parallel.narrative_connection}
`;
  }

  if (narrativeId === 'iran_unconquerable' || narrativeId === 'ethnic_unity') {
    const geo = await loadGeographicUnity();

    if (narrativeId === 'iran_unconquerable') {
      deepContext = `
## GEOGRAPHY: WHY IRAN CANNOT BE INVADED

### Invasion History
${geo.geography.invasion_history.invasions.map(i => `- ${i.invader}: ${i.result}`).join('\n')}

### Lesson
${geo.geography.invasion_history.lesson}

### Strategic Reality 2026
${geo.geography.strategic_reality_2026.why_invasion_impossible.map(r => `- ${r}`).join('\n')}

→ Tweet Angle: ${geo.geography.strategic_reality_2026.tweetAngle}
`;
    }

    if (narrativeId === 'ethnic_unity') {
      deepContext = `
## ETHNIC UNITY: WHY IRAN WON'T FRAGMENT

### 2026 Proof
${geo.ethnic_unity['2026_proof'].evidence.map(e => `- ${e}`).join('\n')}

→ Tweet Angle: ${geo.ethnic_unity['2026_proof'].tweetAngle}
`;
    }
  }

  if (narrativeId === 'gulf_silence') {
    const geopolitics = await loadGeopolitics();
    const g = geopolitics.geopolitics;

    deepContext = `
## GULF STATES: THE PARADOX

### The Situation
${g.the_paradox.description}

### Why They Fear Free Iran
${Object.entries(g.reasons_for_fear).map(([key, val]) => `- **${val.title}**: ${val.details[0]}`).join('\n')}

→ Tweet Angle: ${g.western_hypocrisy_connection.tweetAngle}
`;
  }

  if (narrativeId === 'great_powers_game') {
    const greatPowers = await loadGreatPowers();
    const gp = greatPowers.great_powers_and_iran;

    deepContext = `
## GREAT POWERS: IRAN'S RESET

### Russia History
- Treaty of Turkmenchay 1828: ${gp.iran_russia_history.treaty_of_turkmenchay_1828.significance}
${gp.iran_russia_history.great_game_era.key_events.map(e => `- ${e.event}: ${e.description}`).join('\n')}

### China History
- ${gp.iran_china_history.ancient_era.keyInsight}
${gp.iran_china_history.modern_relations.islamic_republic_era.key_events.map(e => `- ${e.event}: ${e.description}`).join('\n')}

### 2026: The Reset
${gp.great_game_2026.current_alignment.problems.map(p => `- Problem: ${p}`).join('\n')}

→ Tweet Angles:
${gp.great_game_2026.tweet_angles.map(a => `- ${a}`).join('\n')}
`;
  }

  if (narrativeId === 'iran_not_iraq' || narrativeId === 'constitutional_memory') {
    const iranNotIraq = await loadIranNotIraq();
    const ini = iranNotIraq.iran_isnt_iraq_vietnam;

    deepContext = `
## WHY IRAN ISN'T IRAQ

### Thesis
${ini.thesis}

### Key Differences from Iraq
${ini.iraq_failure_analysis.keyPoints.slice(0, 3).map(kp => `- **${kp.factor}**: Iraq: ${kp.iraq} / Iran: ${kp.iran}`).join('\n')}

### Iran's Unique Advantages
${ini.iran_unique_advantages.advantages.slice(0, 4).map(a => `- **${a.advantage}**: ${a.significance}`).join('\n')}

### The Real Iraq Lesson
${ini.the_real_lesson_of_iraq.applicationToIran}

### Options (not invasion)
${ini.isolationism_critique.actualOptions.slice(0, 4).map(o => `- ${o.option}: ${o.description}`).join('\n')}
`;
  }

  return deepContext;
}
