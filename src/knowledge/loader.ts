import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface Source {
  name: string;
  url: string | null;
  date: string;
}

export interface Event {
  id: string;
  date: string;
  category: EventCategory;
  severity: 1 | 2 | 3 | 4 | 5;
  title: string;
  description: string;
  location: string | null;
  sources: Source[];
  verified: boolean;
  relatedEvents: string[];
  tags: string[];
}

export type EventCategory =
  | 'massacre'
  | 'protest'
  | 'regime_action'
  | 'international'
  | 'infrastructure'
  | 'resistance'
  | 'western_response'
  | 'hypocrisy'
  | 'diaspora'
  | 'historical';

export interface Actor {
  id: string;
  name: string;
  persianName: string | null;
  type: 'regime' | 'opposition' | 'western_hypocrite' | 'western_ally' | 'journalist' | 'expert';
  role: string;
  twitterHandle: string | null;
  stance: string;
  keyActions: string[];
  lastUpdated: string;
}

export interface Narrative {
  id: string;
  title: string;
  persianTitle: string;
  description: string;
  status: 'active' | 'developing' | 'concluded';
  priority: 1 | 2 | 3 | 4 | 5;
  keyFacts: string[];
  relatedCategories?: string[];
  relatedEvents?: string[];
  relatedActors: string[];
  tweetAngle: string;
  hashtags?: string[];
  frequency?: string;
  lastUpdated: string;
}

export interface Fact {
  id: string;
  statement: string;
  persianStatement: string | null;
  category: string;
  confidence: 'verified' | 'reported' | 'unconfirmed';
  sources: string[];
  dateAdded: string;
  dateVerified?: string | null;
  usageCount: number;
}

export interface KnowledgeContext {
  events: Event[];
  actors: Actor[];
  narratives: Narrative[];
  facts: Fact[];
  recentEvents: Event[];
  activeNarratives: Narrative[];
  usableFacts: Fact[];
}

export interface HistoricalEra {
  title: string;
  persianTitle?: string;
  period: string;
  events?: Array<{
    date: string;
    event: string;
    significance?: string;
    description?: string;
    parallel2026?: string;
  }>;
  narrativeThread?: string;
  tweetAngle?: string;
  counterRevolutionNarrative?: {
    source: string;
    thesis: string;
    evidence: string[];
    tweetAngle: string;
  };
}

export interface HistoryContext {
  timeline: Record<string, HistoricalEra>;
  pahlavi_dynasty_continuity?: {
    title: string;
    timeline: Array<{ date: string; event: string; significance?: string }>;
    position: string;
    tweetAngle: string;
  };
  cinema_rex_vs_rasht_bazaar?: {
    title: string;
    cinema_rex_1978: Record<string, unknown>;
    rasht_bazaar_2026: Record<string, unknown>;
    narrative_connection: string;
  };
}

export interface GeopoliticsContext {
  geopolitics: {
    title: string;
    persianTitle: string;
    the_paradox: { title: string; description: string; explanation: string };
    reasons_for_fear: Record<string, { title: string; details: string[]; quote?: string }>;
    current_positions: Record<string, { public_stance: string; private_fear?: string; actions: string[] }>;
    western_hypocrisy_connection: { title: string; details: string[]; tweetAngle: string };
    historical_pattern: { title: string; instances: Array<{ era: string; reaction: string }>; lesson: string };
  };
  narrative_threads_for_tweets: {
    primary: Array<{ theme: string; angle: string; frequency: string }>;
  };
}

export interface GeographyUnityContext {
  geography: {
    title: string;
    persianTitle: string;
    overview: string;
    terrain: Record<string, { [key: string]: string; significance: string }>;
    invasion_history: {
      title: string;
      invasions: Array<{ invader: string; result: string; note?: string }>;
      lesson: string;
    };
    strategic_reality_2026: { why_invasion_impossible: string[]; tweetAngle: string };
  };
  ethnic_unity: {
    title: string;
    persianTitle: string;
    ethnic_composition: Record<string, { percentage: string; location: string; language?: string; note?: string }>;
    why_unity_persists: {
      historical_tests: Array<{ test: string; result: string; significance: string }>;
      binding_forces: Array<{ factor: string; explanation: string }>;
      yugoslavia_comparison: { yugoslavia_had: string[]; iran_has: string[] };
    };
    '2026_proof': { title: string; evidence: string[]; tweetAngle: string };
  };
}

export interface IranNotIraqContext {
  iran_isnt_iraq_vietnam: {
    title: string;
    persianTitle: string;
    thesis: string;
    iraq_failure_analysis: {
      title: string;
      keyPoints: Array<{ factor: string; iraq: string; iran: string }>;
      ironyNote: string;
    };
    afghanistan_failure_analysis: {
      title: string;
      keyPoints: Array<{ factor: string; afghanistan: string; iran: string }>;
    };
    vietnam_comparison: {
      title: string;
      keyPoints: Array<{ factor: string; vietnam: string; iran: string }>;
    };
    iran_unique_advantages: {
      title: string;
      advantages: Array<{ advantage: string; significance: string }>;
    };
    the_real_lesson_of_iraq: {
      title: string;
      lessons: string[];
      applicationToIran: string;
    };
    isolationism_critique: {
      title: string;
      argument: string;
      actualOptions: Array<{ option: string; description: string }>;
      keyPoint: string;
    };
  };
  tweet_angles: {
    historical_democracy: string[];
    sabotage_irony: string[];
    false_binary: string[];
    educated_population: string[];
  };
  metadata: {
    lastUpdated: string;
    version: string;
    sources: string[];
  };
}

export interface ExtendedKnowledgeContext extends KnowledgeContext {
  history: HistoryContext | null;
  geopolitics: GeopoliticsContext | null;
  geographyUnity: GeographyUnityContext | null;
  iranNotIraq: IranNotIraqContext | null;
}

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

async function loadJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
  const filepath = path.join(KNOWLEDGE_DIR, filename);
  if (!existsSync(filepath)) {
    console.warn(`Knowledge file not found: ${filename}`);
    return defaultValue;
  }
  try {
    const content = await readFile(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return defaultValue;
  }
}

export async function loadKnowledge(): Promise<KnowledgeContext> {
  const [eventsData, actorsData, narrativesData, factsData] = await Promise.all([
    loadJsonFile<{ events: Event[] }>('events.json', { events: [] }),
    loadJsonFile<{ actors: Actor[] }>('actors.json', { actors: [] }),
    loadJsonFile<{ narratives: Narrative[] }>('narratives.json', { narratives: [] }),
    loadJsonFile<{ facts: Fact[] }>('facts.json', { facts: [] }),
  ]);

  const events = eventsData.events || [];
  const actors = actorsData.actors || [];
  const narratives = narrativesData.narratives || [];
  const facts = factsData.facts || [];

  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const recentEvents = events.filter((e) => {
    const eventDate = new Date(e.date);
    return eventDate >= fortyEightHoursAgo;
  });

  const activeNarratives = narratives
    .filter((n) => n.status === 'active' || n.status === 'developing')
    .sort((a, b) => b.priority - a.priority);

  const usableFacts = facts.filter(
    (f) => f.confidence === 'verified' || f.confidence === 'reported'
  );

  return {
    events,
    actors,
    narratives,
    facts,
    recentEvents,
    activeNarratives,
    usableFacts,
  };
}

export function formatFactsForPrompt(facts: Fact[]): string {
  return facts
    .map((f) => `- [${f.id}] ${f.statement} [${f.confidence}]`)
    .join('\n');
}

export function formatNarrativesForPrompt(narratives: Narrative[]): string {
  return narratives
    .map(
      (n) => `
### ${n.title} (Priority ${n.priority}/5)
${n.description}
Key facts: ${n.keyFacts.join('; ')}
Tweet angle: ${n.tweetAngle}`
    )
    .join('\n');
}

export function formatActorsForPrompt(actors: Actor[]): string {
  return actors
    .map((a) => `- ${a.name} (${a.type}): ${a.stance}`)
    .join('\n');
}

export function formatEventsForPrompt(events: Event[]): string {
  return events
    .map((e) => `- [${e.category}] ${e.date}: ${e.title} - ${e.description}`)
    .join('\n');
}

export function getFactById(facts: Fact[], id: string): Fact | undefined {
  return facts.find((f) => f.id === id);
}

export function validateFactIds(
  factIds: string[],
  facts: Fact[]
): { valid: string[]; invalid: string[]; unconfirmed: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  const unconfirmed: string[] = [];

  for (const id of factIds) {
    const fact = facts.find((f) => f.id === id);
    if (!fact) {
      invalid.push(id);
    } else if (fact.confidence === 'unconfirmed') {
      unconfirmed.push(id);
    } else {
      valid.push(id);
    }
  }

  return { valid, invalid, unconfirmed };
}

export async function loadExtendedKnowledge(): Promise<ExtendedKnowledgeContext> {
  const baseKnowledge = await loadKnowledge();

  const [historyData, geopoliticsData, geographyUnityData, iranNotIraqData] = await Promise.all([
    loadJsonFile<HistoryContext>('history.json', null as unknown as HistoryContext),
    loadJsonFile<GeopoliticsContext>('geopolitics.json', null as unknown as GeopoliticsContext),
    loadJsonFile<GeographyUnityContext>('geographical-unity.json', null as unknown as GeographyUnityContext),
    loadJsonFile<IranNotIraqContext>('iran-not-iraq.json', null as unknown as IranNotIraqContext),
  ]);

  return {
    ...baseKnowledge,
    history: historyData,
    geopolitics: geopoliticsData,
    geographyUnity: geographyUnityData,
    iranNotIraq: iranNotIraqData,
  };
}

export type ThematicPeriod = 'near' | 'mid' | 'long' | 'all';

export function formatHistoryForPrompt(history: HistoryContext | null, period: ThematicPeriod): string {
  if (!history?.timeline) return '';

  const sections: string[] = [];

  if (period === 'near' || period === 'all') {
    const era2026 = history.timeline.era_2026_revolution;
    if (era2026) {
      sections.push(`## CURRENT REVOLUTION (2025-2026)
${era2026.narrativeThread || ''}
Key Events:
${era2026.events?.map((e) => `- ${e.date}: ${e.event}`).join('\n') || ''}`);
    }
  }

  if (period === 'mid' || period === 'all') {
    const era1979 = history.timeline.era_1978_revolution;
    if (era1979) {
      sections.push(`## 1979 REVOLUTION & COUNTER-REVOLUTION
${era1979.counterRevolutionNarrative?.thesis || ''}
Key Events:
${era1979.events?.slice(0, 5).map((e) => `- ${e.date}: ${e.event}`).join('\n') || ''}
Tweet Angle: ${era1979.counterRevolutionNarrative?.tweetAngle || ''}`);
    }

    const hostage = history.timeline.era_hostage_crisis;
    if (hostage) {
      sections.push(`## HOSTAGE CRISIS & SHAH'S EXILE
${hostage.shahExileJourney?.betrayal || ''}
Tweet Angle: ${hostage.shahExileJourney?.tweetAngle || ''}`);
    }
  }

  if (period === 'long' || period === 'all') {
    const era1953 = history.timeline.era_1953_coup;
    if (era1953) {
      sections.push(`## 1953 COUP - THE ORIGINAL SIN
${era1953.narrativeThread || ''}
Tweet Angle: ${era1953.tweetAngle || ''}`);
    }
  }

  return sections.join('\n\n');
}

export function formatParallelsForPrompt(history: HistoryContext | null): string {
  if (!history?.cinema_rex_vs_rasht_bazaar) return '';

  const parallel = history.cinema_rex_vs_rasht_bazaar;
  return `## HISTORICAL PARALLEL: Cinema Rex 1978 → Rasht 2026
${parallel.narrative_connection}

CINEMA REX (Aug 19, 1978):
- Islamist militants barred doors, set fire, killed 377-470
- Blamed on Shah/SAVAK (false)
- Galvanized revolution against Shah

RASHT BAZAAR (Jan 8-9, 2026):
- Regime forces surrounded protesters, set fires, shot survivors
- Blamed on "rioters" (false)
- Same tactics, 47 years later

Tweet Angle: In 1978, Islamists burned 400 alive and blamed the Shah. In 2026, the same Islamist regime burns protesters and blames "rioters." 47 years of the same lie.`;
}

export function formatGeopoliticsForPrompt(geopolitics: GeopoliticsContext | null): string {
  if (!geopolitics?.geopolitics) return '';

  const geo = geopolitics.geopolitics;
  const threads = geopolitics.narrative_threads_for_tweets?.primary || [];

  return `## GEOPOLITICS: THE GULF PARADOX
${geo.the_paradox.description}

WHY ARAB STATES FEAR STRONG IRAN:
${Object.entries(geo.reasons_for_fear)
    .map(([_, v]) => `- ${v.title}: ${v.details[0]}`)
    .join('\n')}

WESTERN SILENCE CONNECTION:
${geo.western_hypocrisy_connection.details.slice(0, 3).join('\n')}
Tweet Angle: ${geo.western_hypocrisy_connection.tweetAngle}

NARRATIVE THREADS:
${threads.map((t) => `- ${t.theme}: ${t.angle}`).join('\n')}`;
}

export function formatGeographyUnityForPrompt(geoUnity: GeographyUnityContext | null): string {
  if (!geoUnity) return '';

  const geo = geoUnity.geography;
  const unity = geoUnity.ethnic_unity;

  return `## GEOGRAPHY & ETHNIC UNITY

WHY IRAN WON'T BECOME YUGOSLAVIA:
${unity.why_unity_persists.binding_forces.slice(0, 4).map((f) => `- ${f.factor}: ${f.explanation}`).join('\n')}

HISTORICAL TESTS PASSED:
${unity.why_unity_persists.historical_tests.map((t) => `- ${t.test}: ${t.result}`).join('\n')}

2026 PROOF:
${unity['2026_proof'].evidence.slice(0, 3).join('\n')}
Tweet Angle: ${unity['2026_proof'].tweetAngle}

GEOGRAPHY AS FORTRESS:
${geo.invasion_history.lesson}
Tweet Angle: ${geo.strategic_reality_2026.tweetAngle}`;
}

export function formatIranNotIraqForPrompt(iranNotIraq: IranNotIraqContext | null): string {
  if (!iranNotIraq?.iran_isnt_iraq_vietnam) return '';

  const main = iranNotIraq.iran_isnt_iraq_vietnam;
  const sections: string[] = ['## WHY IRAN ISN\'T IRAQ OR VIETNAM'];

  if (main.thesis) {
    sections.push(`CORE THESIS: ${main.thesis}`);
  }

  if (main.iraq_failure_analysis?.keyPoints) {
    const iraqPoints = main.iraq_failure_analysis.keyPoints.slice(0, 4);
    sections.push(`WHY IRAQ FAILED:\n${iraqPoints.map((p) => `- ${p.factor}: ${p.iraq}`).join('\n')}`);
    sections.push(`WHY IRAN IS DIFFERENT:\n${iraqPoints.map((p) => `- ${p.factor}: ${p.iran}`).join('\n')}`);
    if (main.iraq_failure_analysis.ironyNote) {
      sections.push(`IRONY: ${main.iraq_failure_analysis.ironyNote}`);
    }
  }

  if (main.iran_unique_advantages?.advantages) {
    sections.push(`IRAN'S UNIQUE ADVANTAGES:\n${main.iran_unique_advantages.advantages.slice(0, 4).map((a) => `- ${a.advantage}: ${a.significance}`).join('\n')}`);
  }

  if (main.the_real_lesson_of_iraq?.lessons) {
    sections.push(`REAL LESSONS FROM IRAQ:\n${main.the_real_lesson_of_iraq.lessons.slice(0, 5).map((l) => `- ${l}`).join('\n')}`);
    if (main.the_real_lesson_of_iraq.applicationToIran) {
      sections.push(`APPLICATION TO IRAN: ${main.the_real_lesson_of_iraq.applicationToIran}`);
    }
  }

  if (main.isolationism_critique?.actualOptions) {
    sections.push(`FALSE BINARY - ACTUAL OPTIONS:\n${main.isolationism_critique.actualOptions.slice(0, 4).map((o) => `- ${o.option}: ${o.description}`).join('\n')}`);
    if (main.isolationism_critique.keyPoint) {
      sections.push(`KEY POINT: ${main.isolationism_critique.keyPoint}`);
    }
  }

  return sections.join('\n\n');
}

export function getThematicTweetAngles(
  knowledge: ExtendedKnowledgeContext,
  focusArea: 'history' | 'geopolitics' | 'parallels' | 'iran-vs-iraq' | 'unity'
): Array<{ theme: string; angle: string; persianAngle?: string; hashtags?: string[] }> {
  const angles: Array<{ theme: string; angle: string; persianAngle?: string; hashtags?: string[] }> = [];

  switch (focusArea) {
    case 'history':
      if (knowledge.history?.timeline) {
        for (const [_, era] of Object.entries(knowledge.history.timeline)) {
          if (era.tweetAngle) {
            angles.push({ theme: era.title, angle: era.tweetAngle });
          }
          if (era.counterRevolutionNarrative?.tweetAngle) {
            angles.push({
              theme: 'Counter-Revolution',
              angle: era.counterRevolutionNarrative.tweetAngle,
            });
          }
        }
      }
      break;

    case 'geopolitics':
      if (knowledge.geopolitics?.narrative_threads_for_tweets?.primary) {
        for (const thread of knowledge.geopolitics.narrative_threads_for_tweets.primary) {
          angles.push({ theme: thread.theme, angle: thread.angle });
        }
      }
      if (knowledge.geopolitics?.geopolitics?.western_hypocrisy_connection?.tweetAngle) {
        angles.push({
          theme: 'Western Silence',
          angle: knowledge.geopolitics.geopolitics.western_hypocrisy_connection.tweetAngle,
        });
      }
      break;

    case 'parallels':
      if (knowledge.history?.cinema_rex_vs_rasht_bazaar?.narrative_connection) {
        angles.push({
          theme: 'Fire Parallel',
          angle: knowledge.history.cinema_rex_vs_rasht_bazaar.narrative_connection,
        });
      }
      break;

    case 'iran-vs-iraq':
      if (knowledge.iranNotIraq?.tweet_angles) {
        const ta = knowledge.iranNotIraq.tweet_angles;
        for (const [themeKey, tweetList] of Object.entries(ta)) {
          if (Array.isArray(tweetList)) {
            for (const angle of tweetList.slice(0, 2)) {
              angles.push({
                theme: themeKey.replace(/_/g, ' '),
                angle,
              });
            }
          }
        }
      }
      break;

    case 'unity':
      if (knowledge.geographyUnity?.ethnic_unity?.['2026_proof']?.tweetAngle) {
        angles.push({
          theme: 'Ethnic Unity',
          angle: knowledge.geographyUnity.ethnic_unity['2026_proof'].tweetAngle,
        });
      }
      if (knowledge.geographyUnity?.geography?.strategic_reality_2026?.tweetAngle) {
        angles.push({
          theme: 'Geography',
          angle: knowledge.geographyUnity.geography.strategic_reality_2026.tweetAngle,
        });
      }
      break;
  }

  return angles;
}
