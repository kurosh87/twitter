import type {
  ExtendedKnowledgeContext,
  ThematicPeriod,
} from '../knowledge/loader';
import {
  formatHistoryForPrompt,
  formatParallelsForPrompt,
  formatGeopoliticsForPrompt,
  formatGeographyUnityForPrompt,
  formatIranNotIraqForPrompt,
  formatFactsForPrompt,
  getThematicTweetAngles,
} from '../knowledge/loader';

export type ThematicFocus =
  | 'history'
  | 'geopolitics'
  | 'parallels'
  | 'iran-vs-iraq'
  | 'unity'
  | 'counter-revolution'
  | 'mixed';

export interface ThematicPromptOptions {
  period: ThematicPeriod;
  focus: ThematicFocus;
  maxTweets: number;
  includePersian: boolean;
}

function buildFocusContext(
  knowledge: ExtendedKnowledgeContext,
  focus: ThematicFocus,
  period: ThematicPeriod
): string {
  const sections: string[] = [];

  switch (focus) {
    case 'history':
      sections.push(formatHistoryForPrompt(knowledge.history, period));
      break;

    case 'geopolitics':
      sections.push(formatGeopoliticsForPrompt(knowledge.geopolitics));
      break;

    case 'parallels':
      sections.push(formatParallelsForPrompt(knowledge.history));
      break;

    case 'iran-vs-iraq':
      sections.push(formatIranNotIraqForPrompt(knowledge.iranNotIraq));
      break;

    case 'unity':
      sections.push(formatGeographyUnityForPrompt(knowledge.geographyUnity));
      break;

    case 'counter-revolution':
      if (knowledge.history?.timeline?.era_1978_revolution?.counterRevolutionNarrative) {
        const cr = knowledge.history.timeline.era_1978_revolution.counterRevolutionNarrative;
        sections.push(`## THE COUNTER-REVOLUTION THESIS

Source: ${cr.source}

Thesis: ${cr.thesis}

Evidence:
${cr.evidence.map((e) => `- ${e}`).join('\n')}

Tweet Angle: ${cr.tweetAngle}

KEY NARRATIVE: 1979 wasn't a revolution - it was a counter-revolution that hijacked a popular uprising. 2026 is the REAL revolution, 47 years delayed.`);
      }
      break;

    case 'mixed':
      sections.push(formatHistoryForPrompt(knowledge.history, period));
      sections.push(formatGeopoliticsForPrompt(knowledge.geopolitics));
      sections.push(formatIranNotIraqForPrompt(knowledge.iranNotIraq));
      break;
  }

  return sections.filter(Boolean).join('\n\n---\n\n');
}

export function buildThematicPrompt(
  knowledge: ExtendedKnowledgeContext,
  options: ThematicPromptOptions
): string {
  const { period, focus, maxTweets, includePersian } = options;

  const focusContext = buildFocusContext(knowledge, focus, period);
  const factsContext = formatFactsForPrompt(knowledge.usableFacts);
  const tweetAngles = getThematicTweetAngles(knowledge, focus === 'mixed' ? 'history' : focus as any);

  const tweetAnglesSection = tweetAngles.length > 0
    ? `## PRE-WRITTEN TWEET ANGLES (Use as inspiration)
${tweetAngles.map((ta) => `- [${ta.theme}] ${ta.angle}`).join('\n')}`
    : '';

  const persianInstructions = includePersian
    ? `
## PERSIAN TWEET REQUIREMENTS
- Each tweet MUST have both English AND Persian versions
- Persian must be native Twitter Persian, not translated
- Use colloquial verbs (می‌ verbs), not formal constructions
- Use Persian numerals (۱۲۰۰۰) consistently
- Hashtags: #انقلاب_ایران #جاویدشاه #ایران`
    : '';

  return `<role>
You are a bilingual OSINT analyst for Faytuks Network (@FaytuksNetwork), creating THEMATIC tweets that draw historical parallels and provide context for current events. These are analytical tweets, not breaking news.
</role>

<thematic_context>
${focusContext}
</thematic_context>

<verified_facts>
${factsContext}
</verified_facts>

${tweetAnglesSection}

<synthesis_rules>
## THEMATIC TWEET RULES

### FOCUS: ${focus.toUpperCase()}
${getFocusGuidance(focus)}

### PERIOD: ${period.toUpperCase()}
${getPeriodGuidance(period)}

### ABSOLUTE RULES
1. **NEVER FABRICATE NUMBERS** - Only use figures from verified facts
2. **DRAW PARALLELS** - Connect current events to historical patterns
3. **280 CHARACTERS MAX** - Each tweet must fit
4. **ORIGINAL VOICE** - These are analytical, not just news summaries
5. **MORAL CLARITY** - The regime is evil. Don't both-sides it.

### VOICE
- Authoritative historian, not breathless reporter
- Connect dots others miss
- Controlled anger with historical weight
- Make readers see the pattern
${persianInstructions}

### HASHTAGS
- Use ONLY: #IranRevolution2026 #IranMassacre #IranProtests #Iran
- 1-2 hashtags MAX, at the end
</synthesis_rules>

<output_format>
Return ONLY a JSON array. No explanation, no markdown, just valid JSON:

[
  {
    "theme": "${getThemeOptions(focus)}",
    "english": "Tweet text under 280 chars #IranRevolution2026",
    ${includePersian ? '"persian": "متن فارسی زیر ۲۸۰ کاراکتر #انقلاب_ایران",' : ''}
    "factIds": ["fact_id_1"],
    "historicalReference": "Brief note on what history this draws from"
  }
]

Generate ${maxTweets} tweets. Quality over quantity. Each should illuminate something.
</output_format>
`;
}

function getFocusGuidance(focus: ThematicFocus): string {
  const guidance: Record<ThematicFocus, string> = {
    history: `Draw from the full 1953-2026 arc. Connect current massacre to 1988 prison massacres.
Connect Western response to 1979 Guadeloupe Conference. Show the patterns.`,

    geopolitics: `Expose the Gulf Paradox - why Saudi Arabia is silent, why Arab states fear strong Iran.
Connect Western progressive silence to regime apologism. The strange alliance of MBS and Glenn Greenwald.`,

    parallels: `CINEMA REX 1978 → RASHT BAZAAR 2026. Same regime, same tactics, 47 years apart.
Trap civilians with fire, kill survivors, blame the victims. Make this parallel crystal clear.`,

    'iran-vs-iraq': `Counter the "don't repeat Iraq" narrative. Iran MADE Iraq a quagmire with IEDs and militias.
Iran has democratic history (1906), ethnic unity (2,500 years), revolution from WITHIN. Not asking for troops.`,

    unity: `Iran won't become Yugoslavia. 2,500 years vs 70 years. All ethnicities protesting together in 2026.
Geographic fortress. Every invader absorbed. This revolution is unified.`,

    'counter-revolution': `1979 was hijacked. Khomeini purged all allies, murdered everyone who helped him.
2026 is the REAL revolution - completing what 1979 started. Hitchens was right.`,

    mixed: `Draw from all sources. Connect current events to history, geopolitics, and the broader pattern.
Show how everything connects - the regime's tactics, Western responses, historical rhymes.`,
  };

  return guidance[focus];
}

function getPeriodGuidance(period: ThematicPeriod): string {
  const guidance: Record<ThematicPeriod, string> = {
    near: `Focus on connecting TODAY's events to immediate precedents.
Last 48 hours connected to 1988 massacres, 2019 Bloody November, etc.`,

    mid: `Focus on 1979-2025 patterns. The counter-revolution thesis.
The cycle of uprisings and crackdowns. Western betrayals across administrations.`,

    long: `Focus on 1953-present arc. Original sin of the coup.
2,500 years of Persian identity. The long view that explains everything.`,

    all: `Use the full historical range. Let the specific angle determine which period matters most.`,
  };

  return guidance[period];
}

function getThemeOptions(focus: ThematicFocus): string {
  const themes: Record<ThematicFocus, string> = {
    history: 'Historical Pattern" | "1953 Echo" | "Counter-Revolution" | "Cycle of Uprisings',
    geopolitics: 'Gulf Paradox" | "Western Silence" | "Arab Fear" | "Strange Alliance',
    parallels: 'Fire Parallel" | "Cinema Rex Echo" | "Same Tactics" | "47 Years',
    'iran-vs-iraq': 'Not Iraq" | "Saboteur Irony" | "Democratic History" | "What Iran Needs',
    unity: 'Ethnic Unity" | "Geographic Fortress" | "Yugoslavia Comparison" | "All Together',
    'counter-revolution': 'Hijacked Revolution" | "Hitchens Was Right" | "Real Revolution" | "47 Years Delayed',
    mixed: 'History" | "Geopolitics" | "Parallels" | "Iran vs Iraq" | "Unity',
  };

  return themes[focus];
}

export function buildQuickThematicPrompt(
  knowledge: ExtendedKnowledgeContext,
  focus: ThematicFocus
): string {
  return buildThematicPrompt(knowledge, {
    period: 'all',
    focus,
    maxTweets: 3,
    includePersian: true,
  });
}
