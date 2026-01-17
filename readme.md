# Faytuks Tweet Synthesis Engine

A comprehensive system for generating historically-grounded tweets about Iran's 2026 revolution, drawing parallels between current events and Iran's deep history.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FAYTUKS ENGINE                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   NEWS      │    │  KNOWLEDGE  │    │  SYNTHESIS  │     │
│  │  MONITOR    │───▶│    BASE     │───▶│  FRAMEWORK  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                                     │             │
│         ▼                                     ▼             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  PARALLEL   │───▶│   CLAUDE    │───▶│ VALIDATION  │     │
│  │  DETECTOR   │    │   PROMPTS   │    │  PIPELINE   │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                               │             │
│                                               ▼             │
│                                        ┌─────────────┐     │
│                                        │   TWEET     │     │
│                                        │   QUEUE     │     │
│                                        └─────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
faytuks-engine/
├── knowledge/                    # Knowledge base JSONs
│   ├── knowledge-history.json    # Historical timeline 1906-2026
│   ├── knowledge-facts.json      # Verified facts and statistics
│   ├── knowledge-geography-unity.json  # Ethnic unity, geography
│   ├── knowledge-geopolitics.json      # Arab states, regional dynamics
│   ├── knowledge-great-powers.json     # China, Russia relations
│   ├── knowledge-iran-not-iraq.json    # Comparison arguments
│   ├── knowledge-narratives.json       # Key narratives
│   └── knowledge-actors.json           # Key figures
│
├── prompts/                      # Claude prompt templates
│   └── tweet-generator.md        # All generation prompts
│
├── laboratory/                   # Testing framework
│   └── testing-framework.md      # Validation loops
│
├── output/                       # Generated content
│   ├── corpus.json               # High-performing tweets
│   ├── tweet_queue.json          # Pending tweets
│   └── posted_tweets.json        # Posted tweet history
│
├── faytuks_engine.py             # Main CLI tool
├── pipeline.py                   # Automated pipeline
└── README.md                     # This file
```

## Quick Start

### 1. Generate a Single Tweet

```bash
python faytuks_engine.py generate --topic "Rasht massacre" --pattern fire_parallel
```

This outputs a Claude prompt. Paste into Claude to get the tweet.

### 2. Generate a Thread

```bash
python faytuks_engine.py thread --topic "Why Iran isn't Iraq" --length 6
```

### 3. Generate Counter-Narrative

```bash
python faytuks_engine.py counter --claim "protesters are terrorists" --source regime
```

### 4. Generate Daily Package

```bash
python faytuks_engine.py daily --date 2026-01-17 --developments "70 bodies at Rasht" "Internet blackout"
```

### 5. Validate a Tweet

```bash
python faytuks_engine.py validate --tweet "Your tweet text here"
```

### 6. Run Lab Tests

```bash
python faytuks_engine.py lab --test fact-check --tweet "Your tweet text"
python faytuks_engine.py lab --test voice --tweet "Your tweet text"
python faytuks_engine.py lab --test full --tweet "Your tweet text"
```

## Knowledge Base

### knowledge-history.json
Complete timeline from 1906 Constitutional Revolution through 2026:
- 1953 Coup (Operation AJAX)
- Shah's reign (White Revolution, SAVAK)
- 1978-79 Revolution (Cinema Rex, Guadeloupe, Khomeini return)
- Hostage Crisis (1979-1981)
- Iran-Iraq War (1980-1988)
- Post-Khomeini era (1989-2025)
- 2026 Revolution

### knowledge-facts.json
Verified statistics with sources:
- Death tolls (12,000+ since Dec 28, 2025)
- Cinema Rex fire (377-470 killed, Aug 19, 1978)
- Rasht Bazaar massacre (70+ bodies at Poursina Hospital)
- 1988 prison massacres (5,000-30,000 executed)
- Ethnic composition (Persian 61%, Azeri 16%, Kurdish 10%...)
- Geographic facts (89M population, 2nd largest gas reserves)

### knowledge-iran-not-iraq.json
The case against "remember Iraq" isolationism:
- Iraq failure analysis (no democratic history, artificial state)
- Afghanistan failure analysis (no central state, low literacy)
- Iran's unique advantages (1906 constitution, educated diaspora)
- The false binary (support ≠ invasion)

### knowledge-great-powers.json
Historical relations with China and Russia:
- Silk Road era (2,000+ years as equals)
- Treaty of Turkmenchay 1828 (lost Caucasus to Russia)
- The Great Game (Britain vs Russia)
- Modern dependency (25-year China deal)
- Democratic Iran's leverage

## Synthesis Patterns

The framework supports 8 primary patterns:

| Pattern | Use When | Example |
|---------|----------|---------|
| `fire_parallel` | Fire/burning news | Cinema Rex 1978 = Rasht 2026 |
| `counter_revolution` | Revolution framing | 1979 hijacked, 2026 completes |
| `western_betrayal` | Western response | Guadeloupe then, silence now |
| `ethnic_unity` | Fragmentation claims | Khuzestan 1980, Azerbaijan 1946 |
| `iraq_contrast` | "Remember Iraq" | Constitution 1906 vs Iraq 2003 |
| `great_power_game` | China/Russia news | Turkmenchay, Silk Road |
| `constitutional_memory` | Democratic history | 1906, Mossadegh |
| `massacre_escalation` | Death toll news | 1988 → 2019 → 2022 → 2026 |

## Laboratory Testing

Every tweet passes through validation:

### Lab Loop 1: Fact-Check
- Verify all claims against knowledge base
- Check dates, numbers, names
- Pass/Fail/Revise

### Lab Loop 2: Voice Consistency
- Score 1-5 on 5 criteria (25 total)
- Minimum score: 18/25
- Check for violations (hashtags, praise, violence...)

### Lab Loop 3: Parallel Strength
- Accuracy of both events
- Relevance of connection
- Proportionality (not hyperbolic)
- Novelty (not overused)

### Lab Loop 4: A/B Testing
- Test variations of same message
- Track metrics
- Extract winning patterns

## Automated Pipeline

The pipeline.py script handles:

1. **News Monitoring**: Watch RSS feeds for Iran news
2. **Parallel Detection**: Automatically detect which pattern fits
3. **Generation**: Create tweet candidates
4. **Validation**: Run through lab loops
5. **Queue Management**: Stage validated tweets
6. **Scheduling**: Post at optimal times

### Example Pipeline Run

```python
from pipeline import FaytuksPipeline, NewsItem

pipeline = FaytuksPipeline()

# Process news
news = NewsItem(
    title="70 bodies at Rasht hospital",
    content="Security forces trapped protesters, set fire...",
    source="Iran Human Rights",
    url="https://iranhr.net/...",
    timestamp=datetime.now()
)

# Auto-detect parallels
parallels = AutomaticParallelDetector.detect_parallel(news)
# Returns: [{"parallel": "fire_parallel", "score": 5, ...}]

# Generate candidates
candidates = pipeline.process_news(news)

# Validate
for candidate in candidates:
    scores = pipeline.validate_tweet(candidate)
    if scores["passed"]:
        queue.add(candidate)
```

## Daily Workflow

### Morning (8:30 AM EST)
- Post historical anchor tweet
- Deep parallel to set context

### Midday (12:30 PM EST)  
- Post news + context tweet
- Breaking news with historical echo

### Evening (6:30 PM EST)
- Post narrative synthesis tweet
- Connect day's events to larger pattern

### Night (10:30 PM EST)
- Post reflection tweet
- Human story, diaspora voice

## Corpus Building

High-performing tweets are saved to corpus.json:

```json
{
  "corpus_id": "CORPUS_0001",
  "tweet": "1978: Islamists burn Cinema Rex, kill 400, blame Shah. 2026: Same Islamists burn Rasht, kill protesters, blame 'rioters.' Same fire. Same lies.",
  "pattern": "fire_parallel",
  "performance": {
    "impressions": 50000,
    "engagements": 5000,
    "engagement_rate": 0.10
  },
  "tags": ["cinema_rex", "rasht", "fire"],
  "why_it_worked": "Parallel structure, specific facts, ironic reversal"
}
```

Query corpus for templates:
```python
corpus.search(pattern="fire_parallel")
corpus.get_template("iraq_contrast")
```

## Voice Guidelines

### DO:
- Use specific dates and numbers
- Ground in verifiable facts
- Use parallel structure
- Include Persian phrases with translation
- Critical of regime, supportive of people

### DON'T:
- Exceed 280 characters
- Use more than 2 hashtags
- Fabricate quotes or statistics
- Use sectarian language
- Promote ethnic division
- Present speculation as fact

## Sample Generated Tweets

### Fire Parallel
> 1978: Islamists burn Cinema Rex, kill 420, blame Shah.
> 2026: Same Islamists burn Rasht, kill protesters, blame "rioters."
> Same fire. Same lies. 47 years apart.

### Counter-Revolution
> 1978: Iranians wanted freedom.
> 1979: Khomeini stole it.
> 1981-88: He murdered everyone who helped him.
> 2026: The grandchildren are finishing the job.

### Iraq Contrast
> Iraq 2003: No democratic history.
> Iran 2026: Constitutional revolution since 1906.
> Not the same. Stop comparing them.

### Great Power Game
> 1828: Treaty of Turkmenchay - Russia took the Caucasus.
> 2021: 25-year deal - mullahs sold Iran to China.
> 2026: Free Iran will be partner to all, client to none.

## Contributing

To add new knowledge:
1. Update relevant JSON in knowledge/
2. Add sources with dates
3. Test with validation pipeline
4. Document in this README

## License

For Faytuks Network use only.