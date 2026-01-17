# Faytuks Laboratory - Tweet Testing & Validation System

## OVERVIEW

The Laboratory is a systematic framework for:
1. Testing tweet quality before publishing
2. Validating historical accuracy
3. A/B testing different approaches
4. Iterating based on feedback
5. Building a corpus of proven patterns

---

## LAB LOOP 1: FACT-CHECK VALIDATION

Every tweet must pass through this validation before publishing.

### Input
```json
{
  "tweet": "The tweet text to validate",
  "claimed_facts": [
    {"claim": "12,000 killed", "source": "knowledge-facts.json:death_toll_jan2026"},
    {"claim": "Cinema Rex 1978", "source": "knowledge-history.json:cinema_rex_1978"}
  ]
}
```

### Validation Prompt
```
<task>
Validate each claimed fact in this tweet against the knowledge base.

TWEET: {{tweet}}

CLAIMED FACTS:
{{claimed_facts}}

For each fact, verify:
1. Is the fact present in the cited source?
2. Is the fact stated accurately (numbers, dates, names)?
3. Is the context preserved (not misleading)?
4. Confidence level of the underlying source?
</task>

<output>
FACT CHECK RESULTS:

Fact 1: "{{claim}}"
- Present in source: [YES/NO]
- Accurate: [YES/NO/PARTIALLY]
- Context preserved: [YES/NO]
- Source confidence: [high/medium/low]
- VERDICT: [PASS/FAIL/NEEDS REVISION]
- If needs revision: [suggested fix]

[Repeat for each fact]

OVERALL TWEET STATUS: [PUBLISH/REVISE/REJECT]
</output>
```

### Output
```json
{
  "status": "PUBLISH" | "REVISE" | "REJECT",
  "fact_check_results": [...],
  "revision_suggestions": [...],
  "confidence_score": 0.0-1.0
}
```

---

## LAB LOOP 2: VOICE CONSISTENCY CHECK

Ensures tweets match the Faytuks voice and style.

### Validation Prompt
```
<task>
Evaluate this tweet against Faytuks voice guidelines.

TWEET: {{tweet}}

VOICE CRITERIA:
1. Authoritative but not academic (score 1-5)
2. Passionate but fact-based (score 1-5)
3. Historical depth with present urgency (score 1-5)
4. Persian pride without chauvinism (score 1-5)
5. Critical of regime, supportive of people (score 1-5)

AVOID CHECKLIST:
- [ ] Excessive hashtags (>2)
- [ ] Sycophantic praise
- [ ] Gratuitous violence
- [ ] Sectarian language
- [ ] Ethnic division
- [ ] Speculation as fact
- [ ] Emojis overuse
</task>

<output>
VOICE SCORE CARD:

Criterion 1 (Authoritative/Accessible): [1-5] - [comment]
Criterion 2 (Passionate/Factual): [1-5] - [comment]
Criterion 3 (Historical/Urgent): [1-5] - [comment]
Criterion 4 (Pride/Not Chauvinist): [1-5] - [comment]
Criterion 5 (Anti-regime/Pro-people): [1-5] - [comment]

TOTAL VOICE SCORE: [X/25]

AVOID VIOLATIONS:
[List any violations found]

OVERALL: [ON-VOICE/NEEDS ADJUSTMENT/OFF-VOICE]

If needs adjustment:
[Specific suggestions]
</output>
```

---

## LAB LOOP 3: HISTORICAL PARALLEL STRENGTH TEST

Tests whether the historical parallel is compelling and accurate.

### Validation Prompt
```
<task>
Evaluate the strength of the historical parallel in this tweet.

TWEET: {{tweet}}
PARALLEL CLAIMED: {{parallel}} (e.g., "Cinema Rex 1978 = Rasht 2026")

EVALUATION CRITERIA:

1. ACCURACY: Are both events accurately described?
2. RELEVANCE: Is the parallel genuinely illuminating?
3. PROPORTION: Is the comparison fair (not hyperbolic)?
4. NOVELTY: Has this parallel been overused?
5. EMOTIONAL RESONANCE: Does it land emotionally?
</task>

<output>
PARALLEL STRENGTH ANALYSIS:

Accuracy: [1-5]
- Event 1 accuracy: [assessment]
- Event 2 accuracy: [assessment]

Relevance: [1-5]
- Connection strength: [weak/moderate/strong]
- What it illuminates: [explanation]

Proportion: [1-5]
- Risk of hyperbole: [low/medium/high]
- Suggested adjustment if needed: [...]

Novelty: [1-5]
- Times this parallel used recently: [count]
- Still fresh: [yes/no]

Emotional Resonance: [1-5]
- Predicted emotional impact: [assessment]

TOTAL PARALLEL SCORE: [X/25]

RECOMMENDATION: [USE/MODIFY/RETIRE]
</output>
```

---

## LAB LOOP 4: A/B TESTING FRAMEWORK

For testing variations of the same message.

### Setup
```json
{
  "test_id": "AB_2026_01_17_001",
  "topic": "Rasht massacre",
  "hypothesis": "Historical parallel framing outperforms straight news",
  "variants": [
    {
      "id": "A",
      "type": "straight_news",
      "tweet": "70 bodies arrived at Poursina Hospital in Rasht after security forces trapped and killed protesters. 12,000+ now dead."
    },
    {
      "id": "B",
      "type": "historical_parallel",
      "tweet": "1978: Islamists burn Cinema Rex, kill 400, blame Shah. 2026: Regime burns Rasht bazaar, kills protesters, blames 'rioters.' Same fire. Same lies. 47 years apart."
    }
  ],
  "metrics_to_track": ["impressions", "engagements", "retweets", "quotes", "replies"],
  "test_duration_hours": 24
}
```

### Analysis Prompt (Post-Test)
```
<task>
Analyze A/B test results and extract learnings.

TEST: {{test_id}}
HYPOTHESIS: {{hypothesis}}

RESULTS:
Variant A ({{type_a}}):
- Impressions: {{impressions_a}}
- Engagements: {{engagements_a}}
- Engagement rate: {{rate_a}}

Variant B ({{type_b}}):
- Impressions: {{impressions_b}}
- Engagements: {{engagements_b}}
- Engagement rate: {{rate_b}}

WINNER: {{winner}}
MARGIN: {{margin}}
</task>

<output>
A/B TEST ANALYSIS:

HYPOTHESIS CONFIRMED: [YES/NO/INCONCLUSIVE]

WHY WINNER WON:
[Analysis of what made it perform better]

PATTERN TO REPLICATE:
[Extractable pattern for future tweets]

PATTERN TO AVOID:
[What didn't work in the loser]

NEXT TEST SUGGESTION:
[What to test next based on learnings]

UPDATE TO FRAMEWORK:
[Any updates needed to synthesis framework based on this]
</output>
```

---

## LAB LOOP 5: CORPUS BUILDING

Building a library of proven high-performers.

### Entry Format
```json
{
  "corpus_id": "CORPUS_001",
  "tweet": "The tweet text",
  "posted_date": "2026-01-17",
  "pattern_used": "fire_parallel",
  "time_layer": "long_term",
  "performance": {
    "impressions": 50000,
    "engagements": 5000,
    "engagement_rate": 0.10
  },
  "tags": ["cinema_rex", "rasht", "historical_parallel", "fire"],
  "reusable_structure": "[DATE]: [ACTOR] [ACTION], [BLAME]. [DATE]: [SAME PATTERN]. Same [ELEMENT]. Same [ELEMENT].",
  "why_it_worked": "Parallel structure, specific dates, ironic reversal"
}
```

### Corpus Query Prompt
```
<task>
Find the best template from the corpus for this topic.

NEW TOPIC: {{topic}}
DESIRED PATTERN: {{pattern}}
TONE: {{tone}}

Search the corpus for:
1. Similar topics that performed well
2. Matching patterns
3. Reusable structures
</task>

<output>
CORPUS MATCHES:

Match 1: {{corpus_id}}
- Original tweet: [...]
- Reusable structure: [...]
- Relevance to new topic: [high/medium/low]
- Suggested adaptation: [...]

Match 2: [...]

RECOMMENDED APPROACH:
[Which corpus entry to use as template and how to adapt]
</output>
```

---

## LAB LOOP 6: DAILY PERFORMANCE REVIEW

End-of-day analysis of all tweets posted.

### Review Prompt
```
<task>
Conduct daily performance review of Faytuks tweets.

DATE: {{date}}
TWEETS POSTED: {{count}}

TWEET PERFORMANCE DATA:
{{tweet_performance_list}}

CONTEXT:
- Major news events today: {{news_events}}
- Competitor performance: {{competitor_notes}}
- Trending topics: {{trending}}
</task>

<output>
=== DAILY PERFORMANCE REVIEW: {{date}} ===

TOP PERFORMER:
Tweet: [...]
Why it worked: [...]
Pattern to replicate: [...]

UNDERPERFORMER:
Tweet: [...]
Why it failed: [...]
Lesson learned: [...]

OVERALL METRICS:
- Total impressions: [...]
- Total engagements: [...]
- Average engagement rate: [...]
- Comparison to previous day: [+/-]

PATTERNS THAT WORKED TODAY:
1. [...]
2. [...]

PATTERNS THAT DIDN'T WORK:
1. [...]

TOMORROW'S ADJUSTMENTS:
1. [...]
2. [...]

CORPUS ADDITIONS:
[Any tweets that should be added to corpus]

KNOWLEDGE BASE UPDATES NEEDED:
[Any new facts/events to add]
</output>
```

---

## LAB LOOP 7: SENTIMENT & RECEPTION ANALYSIS

Analyze how tweets are being received.

### Analysis Prompt
```
<task>
Analyze sentiment and reception of this tweet.

TWEET: {{tweet}}
REPLY SAMPLE: {{replies}}
QUOTE TWEETS: {{quotes}}
</task>

<output>
RECEPTION ANALYSIS:

SENTIMENT BREAKDOWN:
- Positive: [X%]
- Neutral: [X%]
- Negative: [X%]
- Hostile: [X%]

AUDIENCE SEGMENTS RESPONDING:
- Iranian diaspora: [assessment]
- Western observers: [assessment]
- Policy community: [assessment]
- Regime supporters: [assessment]
- Hostile actors: [assessment]

KEY THEMES IN REPLIES:
1. [Theme] - [sentiment]
2. [Theme] - [sentiment]

CRITICISM TO ADDRESS:
[Any valid criticism that should inform future tweets]

ATTACKS TO IGNORE:
[Bad-faith attacks not worth engaging]

OPPORTUNITIES SPOTTED:
[Follow-up tweets or threads suggested by reception]
</output>
```

---

## MASTER VALIDATION PIPELINE

Run all tweets through this sequence before publishing:

```
┌─────────────────┐
│  TWEET DRAFT    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ FACT-CHECK      │ → FAIL → Revise facts
│ (Lab Loop 1)    │
└────────┬────────┘
         │ PASS
         ▼
┌─────────────────┐
│ VOICE CHECK     │ → OFF-VOICE → Adjust tone
│ (Lab Loop 2)    │
└────────┬────────┘
         │ ON-VOICE
         ▼
┌─────────────────┐
│ PARALLEL TEST   │ → WEAK → Strengthen or remove
│ (Lab Loop 3)    │
└────────┬────────┘
         │ STRONG
         ▼
┌─────────────────┐
│ READY TO POST   │
└─────────────────┘
```

---

## ITERATION CYCLE

Weekly iteration based on accumulated data:

1. **Monday**: Review previous week's performance
2. **Tuesday**: Update knowledge base with new events
3. **Wednesday**: A/B test new patterns
4. **Thursday**: Analyze test results
5. **Friday**: Update synthesis framework
6. **Weekend**: Corpus maintenance, documentation

---

## METRICS DASHBOARD

Track these KPIs:

| Metric | Target | Current |
|--------|--------|---------|
| Daily tweets | 4-6 | |
| Avg engagement rate | >5% | |
| Fact-check pass rate | 100% | |
| Voice consistency | >20/25 | |
| Parallel strength | >20/25 | |
| Corpus size | +5/week | |
