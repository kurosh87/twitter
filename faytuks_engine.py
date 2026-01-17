#!/usr/bin/env python3
"""
Faytuks Tweet Synthesis Engine
A comprehensive system for generating historically-grounded tweets about Iran's 2026 revolution.

Usage:
    python faytuks_engine.py generate --topic "Rasht massacre"
    python faytuks_engine.py thread --topic "Cinema Rex parallel" --length 6
    python faytuks_engine.py counter --claim "protesters are terrorists"
    python faytuks_engine.py daily --date 2026-01-17
    python faytuks_engine.py validate --tweet "tweet text here"
    python faytuks_engine.py lab --test fact-check --tweet "tweet text"
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

# Knowledge base paths - all files are now in knowledge/ directory
KNOWLEDGE_DIR = Path(__file__).parent / "knowledge"

KNOWLEDGE_FILES = {
    # Core knowledge
    "history": "history.json",
    "facts": "facts.json",
    "geography": "geographical-unity.json",
    "geopolitics": "geopolitics.json",
    "great_powers": "great-powers.json",
    "iran_not_iraq": "iran-not-iraq.json",
    "narratives": "narratives.json",
    "actors": "actors.json",
    "quotes": "quotes-persian.json",
    # Operational knowledge
    "calendar": "anniversary-calendar.json",
    "hashtags": "hashtag-strategy.json",
    "sources": "source-credibility.json",
    "threads": "thread-templates.json",
    "multiplatform": "multiplatform.json",
    "framework": "synthesis-framework.json",
    "corpus_scraped": "corpus-scraped.json",
    "corpus_samples": "corpus-samples.json"
}

# Generation history file (shared with TypeScript system)
GENERATION_HISTORY_FILE = KNOWLEDGE_DIR / "generation-history.json"


class ClaudeClient:
    """Wrapper for Claude API calls."""

    def __init__(self, api_key: Optional[str] = None):
        if not ANTHROPIC_AVAILABLE:
            raise ImportError("anthropic package not installed. Run: pip install anthropic")
        self.client = anthropic.Anthropic(api_key=api_key or os.getenv("ANTHROPIC_API_KEY"))

    def generate(self, prompt: str, model: str = "claude-sonnet-4-20250514", max_tokens: int = 1024) -> str:
        """Execute prompt with Claude API."""
        response = self.client.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text

    def generate_with_system(self, prompt: str, system: str, model: str = "claude-sonnet-4-20250514") -> str:
        """Execute prompt with system message."""
        response = self.client.messages.create(
            model=model,
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text


class TweetPattern(Enum):
    FIRE_PARALLEL = "fire_parallel"
    COUNTER_REVOLUTION = "counter_revolution"
    WESTERN_BETRAYAL = "western_betrayal"
    ETHNIC_UNITY = "ethnic_unity"
    GEOGRAPHY_FORTRESS = "geography_fortress"
    GREAT_POWER_GAME = "great_power_game"
    IRAQ_CONTRAST = "iraq_contrast"
    DIASPORA_RETURN = "diaspora_return"
    CONSTITUTIONAL_MEMORY = "constitutional_memory"
    MASSACRE_ESCALATION = "massacre_escalation"


# Auto-detection triggers: keyword → pattern mapping
PATTERN_TRIGGERS = {
    "fire_parallel": ["fire", "burn", "arson", "flames", "Cinema Rex", "Rasht", "bazaar", "trapped"],
    "counter_revolution": ["revolution", "1979", "hijacked", "Khomeini", "stole", "1978", "grandchildren"],
    "western_betrayal": ["West", "US", "Europe", "silent", "Guadeloupe", "Carter", "abandoned", "betrayal"],
    "iraq_contrast": ["Iraq", "invasion", "regime change", "troops", "Afghanistan", "Vietnam", "quagmire"],
    "ethnic_unity": ["Kurd", "Azeri", "Baluch", "Arab", "fragment", "unity", "ethnic", "Yugoslavia"],
    "massacre_escalation": ["killed", "massacre", "death toll", "1988", "executed", "bodies", "hospital"],
    "great_power_game": ["China", "Russia", "Turkmenchay", "Silk Road", "partner", "deal"],
    "constitutional_memory": ["1906", "constitution", "Mossadegh", "democratic", "parliament", "Majles"],
    "geography_fortress": ["geography", "mountains", "invasion", "fortress", "Zagros", "terrain"],
    "diaspora_return": ["diaspora", "return", "exile", "abroad", "4 million", "educated"],
}

# Emotional triggers per pattern - what emotion should the tweet evoke
PATTERN_EMOTIONS = {
    "fire_parallel": ["OUTRAGE", "IRONY"],
    "counter_revolution": ["OUTRAGE", "HOPE"],
    "western_betrayal": ["CONTEMPT", "OUTRAGE"],
    "iraq_contrast": ["IRONY", "PRIDE"],
    "ethnic_unity": ["PRIDE", "HOPE"],
    "massacre_escalation": ["GRIEF", "OUTRAGE"],
    "constitutional_memory": ["PRIDE", "HOPE"],
    "great_power_game": ["PRIDE", "IRONY"],
    "geography_fortress": ["PRIDE", "CONTEMPT"],
    "diaspora_return": ["HOPE", "PRIDE"],
}

# Hook templates for scroll-stopping openers
HOOK_TEMPLATES = {
    "shocking_stat": {
        "template": "[NUMBER] [SHOCKING FACT]. [CONTRAST/IRONY].",
        "example": "12,000 dead in 20 days. Media coverage: none.",
        "best_for": ["massacre_escalation", "western_betrayal"],
    },
    "historical_reveal": {
        "template": "In [YEAR], [UNEXPECTED FACT]. [CONNECTION TO NOW].",
        "example": "In 1978, Islamists burned 400 alive. They blamed the Shah.",
        "best_for": ["fire_parallel", "counter_revolution", "constitutional_memory"],
    },
    "question_hook": {
        "template": "[QUESTION THAT CHALLENGES ASSUMPTION]?",
        "example": "Why is Saudi Arabia silent while Iran burns?",
        "best_for": ["western_betrayal", "great_power_game"],
    },
    "contrast": {
        "template": "[THING 1] vs [THING 2]. [IMPLICATION].",
        "example": "1 USD = 70 rials in 1979. Today: 700,000.",
        "best_for": ["counter_revolution", "massacre_escalation"],
    },
    "pattern_break": {
        "template": "'[COMMON BELIEF].' [REFUTATION/EVIDENCE].",
        "example": "'Iran will fragment.' No. 2,500 years says otherwise.",
        "best_for": ["ethnic_unity", "geography_fortress", "iraq_contrast"],
    },
    "time_anchor": {
        "template": "[X] years ago, [EVENT]. Now, [ECHO/COMPLETION].",
        "example": "47 years ago a Crown Prince left Iran. Now they chant his name.",
        "best_for": ["diaspora_return", "counter_revolution", "fire_parallel"],
    },
}


def get_best_hook(pattern: str) -> str:
    """Return the best hook type for a given pattern."""
    for hook_type, config in HOOK_TEMPLATES.items():
        if pattern in config.get("best_for", []):
            return hook_type
    return "historical_reveal"  # default


def get_emotions(pattern: str) -> List[str]:
    """Return emotions for a pattern."""
    return PATTERN_EMOTIONS.get(pattern, ["OUTRAGE"])


def auto_detect_pattern(text: str) -> List[tuple]:
    """Auto-detect which patterns match the input text.

    Returns list of (pattern_name, score, matched_keywords) sorted by score descending.
    """
    text_lower = text.lower()
    results = []

    for pattern, triggers in PATTERN_TRIGGERS.items():
        matched = [t for t in triggers if t.lower() in text_lower]
        if matched:
            score = len(matched) / len(triggers)  # Normalize by trigger count
            results.append((pattern, score, matched))

    # Sort by score descending
    results.sort(key=lambda x: x[1], reverse=True)
    return results

class TimeLayer(Enum):
    NEAR_TERM = "near_term"  # Days to weeks
    MID_TERM = "mid_term"    # Years to decades (1979-2025)
    LONG_TERM = "long_term"  # Centuries

@dataclass
class TweetDraft:
    text: str
    pattern: TweetPattern
    time_layer: TimeLayer
    sources: List[str]
    confidence: float
    hashtags: List[str]
    
    def __str__(self):
        return f"{self.text}\n\n[Pattern: {self.pattern.value}, Layer: {self.time_layer.value}, Confidence: {self.confidence}]"

@dataclass
class ValidationResult:
    passed: bool
    fact_check_score: float
    voice_score: float
    parallel_score: float
    issues: List[str]
    suggestions: List[str]


# Media paths
MEDIA_DIR = Path(__file__).parent / "media"
TEMPLATES_DIR = Path(__file__).parent / "templates"
DRAFTS_DIR = Path(__file__).parent / "drafts"


class MediaMatcher:
    """Matches synthesis patterns to available media files."""

    # Pattern to media directory mapping
    PATTERN_MEDIA_DIRS = {
        "fire_parallel": ["events/cinema-rex-1978", "current/rasht-2026"],
        "counter_revolution": ["historical/1979-revolution"],
        "western_betrayal": ["events/guadeloupe-1979"],
        "ethnic_unity": ["maps/ethnic-distribution", "historical/1980-1988"],
        "iraq_contrast": ["historical/1906-1953", "figures/mossadegh"],
        "great_power_game": ["events/turkmenchay-1828", "maps/turkmenchay-loss"],
        "constitutional_memory": ["historical/1906-1953", "events/constitutional-1906"],
        "massacre_escalation": ["current/rasht-2026", "historical/2022-mahsa"],
    }

    # Pattern to search terms for auto-acquisition
    PATTERN_SEARCH_TERMS = {
        "fire_parallel": ["Cinema Rex 1978 Abadan", "Rasht bazaar fire 2026"],
        "western_betrayal": ["Guadeloupe Conference 1979 Carter"],
        "great_power_game": ["Treaty of Turkmenchay 1828 map"],
        "constitutional_memory": ["Iran Constitutional Revolution 1906 Majlis"],
    }

    def __init__(self, media_dir: Path = MEDIA_DIR):
        self.media_dir = media_dir
        self.metadata = self._load_metadata()

    def _load_metadata(self) -> Dict:
        """Load media metadata catalog."""
        metadata_file = self.media_dir / "metadata.json"
        if metadata_file.exists():
            with open(metadata_file, 'r') as f:
                return json.load(f)
        return {"media": []}

    def find_media_for_pattern(self, pattern: str) -> Dict[str, Any]:
        """Find available media for a synthesis pattern."""
        result = {
            "pattern": pattern,
            "available": [],
            "recommended": None,
            "acquire_suggestion": None
        }

        # Get directories to search
        dirs = self.PATTERN_MEDIA_DIRS.get(pattern, [])

        for subdir in dirs:
            dir_path = self.media_dir / subdir
            if dir_path.exists():
                # Find image files
                for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
                    for img in dir_path.glob(f"*{ext}"):
                        result["available"].append({
                            "path": str(img.relative_to(self.media_dir)),
                            "filename": img.name,
                            "directory": subdir
                        })

        # Set recommended (first available)
        if result["available"]:
            result["recommended"] = result["available"][0]
        else:
            # Suggest acquisition
            search_terms = self.PATTERN_SEARCH_TERMS.get(pattern, [])
            if search_terms:
                result["acquire_suggestion"] = {
                    "command": f'./media_scripts.sh google "{search_terms[0]}" ./media/{dirs[0] if dirs else "_temp"}',
                    "search_terms": search_terms
                }

        return result

    def get_media_recommendation(self, pattern: str, topic: str = None) -> Dict[str, Any]:
        """Get media recommendation for a tweet."""
        media_result = self.find_media_for_pattern(pattern)

        recommendation = {
            "has_media": len(media_result["available"]) > 0,
            "primary_media": media_result["recommended"]["path"] if media_result["recommended"] else None,
            "all_available": [m["path"] for m in media_result["available"]],
            "needs_acquisition": media_result["acquire_suggestion"] is not None,
            "acquisition_command": media_result["acquire_suggestion"]["command"] if media_result["acquire_suggestion"] else None
        }

        return recommendation


class TweetEnricher:
    """Enriches bucket tweets with historical parallels from knowledge base."""

    def __init__(self, knowledge_base: 'KnowledgeBase'):
        self.kb = knowledge_base

    def detect_pattern(self, text: str) -> Optional[str]:
        """Detect the best matching pattern for a tweet."""
        matches = auto_detect_pattern(text)
        return matches[0][0] if matches else None

    def get_historical_context(self, pattern: str) -> Dict:
        """Get relevant historical facts for a pattern."""
        facts = self.kb.get_facts()
        history = self.kb.data.get("history", {})

        # Pattern-specific fact retrieval
        pattern_facts = {
            "fire_parallel": ["Cinema Rex", "Rasht", "arson"],
            "massacre_escalation": ["1988", "2019", "Bloody November", "death toll"],
            "counter_revolution": ["1979", "Khomeini", "hijacked"],
            "western_betrayal": ["Guadeloupe", "Carter", "1979"],
            "constitutional_memory": ["1906", "Mossadegh", "constitutional"],
            "ethnic_unity": ["Khuzestan", "Azerbaijan", "unity"],
            "great_power_game": ["Turkmenchay", "China", "Russia"],
            "iraq_contrast": ["Iraq", "2003", "Afghanistan"],
            "diaspora_return": ["diaspora", "exile", "4 million"],
        }

        keywords = pattern_facts.get(pattern, [])
        relevant_facts = []
        for fact in facts:
            text = fact.get("fact", "").lower()
            if any(kw.lower() in text for kw in keywords):
                relevant_facts.append(fact)

        # Get historical era info
        eras = history.get("eras", {})
        relevant_era = None
        era_mapping = {
            "fire_parallel": "1978_revolution",
            "counter_revolution": "islamic_republic_1979",
            "constitutional_memory": "constitutional_1906",
            "massacre_escalation": "uprisings_2019_2022",
        }
        if pattern in era_mapping:
            relevant_era = eras.get(era_mapping[pattern])

        return {
            "facts": relevant_facts[:3],  # Top 3 relevant facts
            "era": relevant_era,
            "pattern": pattern
        }

    def generate_enrichment_prompt(self, original_tweet: str, context: Dict) -> str:
        """Generate a Claude prompt to create an enriched supplemental tweet."""
        facts_text = "\n".join([f"- {f.get('fact', '')}" for f in context.get('facts', [])])
        era = context.get('era', {})
        era_text = f"\nHistorical era: {era.get('name', 'N/A')}\n{era.get('description', '')}" if era else ""

        return f"""Create a supplemental tweet that adds historical depth to this current news.

ORIGINAL TWEET (from Iranian commentator):
{original_tweet}

DETECTED PATTERN: {context.get('pattern', 'N/A')}

RELEVANT HISTORICAL FACTS:
{facts_text}
{era_text}

YOUR TASK:
Create a tweet that:
1. References the current event implicitly (don't repeat it)
2. Draws a specific historical parallel
3. Uses the pattern: "[Historical fact]. [Connection to now]. [Insight]."
4. Maximum 280 characters
5. 1-2 hashtags maximum
6. Tone: authoritative, ironic, fact-based

OUTPUT FORMAT:
TWEET: [your tweet]
PARALLEL: [which historical parallel you used]
HASHTAGS: [suggested hashtags]
"""

    def translate_to_persian(self, english_text: str, claude_client: 'ClaudeClient') -> str:
        """Translate breaking news to Persian for bilingual posting."""
        prompt = f"""Translate this breaking news tweet to Persian (Farsi).

ENGLISH:
{english_text}

RULES:
1. Keep the same factual content and tone
2. Use standard Persian, not overly formal
3. If there are hashtags in English, translate them to Persian equivalents
4. Keep names transliterated (not translated)
5. Maximum 280 characters
6. Output ONLY the Persian translation, nothing else

PERSIAN:"""
        return claude_client.generate(prompt).strip()

    def enrich_draft(self, draft: Dict, claude_client: 'ClaudeClient' = None) -> Dict:
        """Enrich a bucket-based draft with historical context."""
        text = draft.get('english', '')
        pattern = self.detect_pattern(text)

        if not pattern:
            pattern = draft.get('pattern', 'massacre_escalation')

        context = self.get_historical_context(pattern)

        enriched = {
            **draft,
            "detected_pattern": pattern,
            "historical_context": {
                "facts_count": len(context.get('facts', [])),
                "era": context.get('era', {}).get('name') if context.get('era') else None
            }
        }

        if claude_client:
            prompt = self.generate_enrichment_prompt(text, context)
            response = claude_client.generate(prompt)
            enriched["supplemental_tweet"] = response
            enriched["enrichment_prompt"] = prompt

        return enriched


class FaytuksDaemon:
    """Continuous operation daemon for tweet generation and posting."""

    def __init__(self, knowledge_base: 'KnowledgeBase'):
        self.kb = knowledge_base
        self.enricher = TweetEnricher(knowledge_base)
        self.draft_mgr = DraftManager()
        self.running = False

    def scrape_recent_tweets(self, bucket: str, max_age_hours: float) -> List[Dict]:
        """Get recent tweets from a bucket."""
        from datetime import timezone, timedelta

        bucket_files = {
            "breaking": [Path(__file__).parent / "buckets/breaking/middleeast_24-tweets.json"],
            "commentary": [
                Path(__file__).parent / "buckets/commentary/__injaneb96-tweets.json",
                Path(__file__).parent / "buckets/commentary/realneo101-tweets.json",
            ],
            "geopolitics": [
                Path(__file__).parent / "buckets/geopolitics/jasonmbrodsky-tweets.json",
                Path(__file__).parent / "buckets/geopolitics/ariaramesh-tweets.json",
            ],
        }

        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=max_age_hours)
        recent = []

        for file_path in bucket_files.get(bucket, []):
            if not file_path.exists():
                continue
            try:
                with open(file_path, 'r') as f:
                    data = json.load(f)
                tweets = data.get('tweets', data if isinstance(data, list) else [])
                for t in tweets:
                    try:
                        ts = datetime.fromisoformat(t.get('date', '').replace('Z', '+00:00'))
                        if ts > cutoff and not t.get('isRetweet', False):
                            t['bucket'] = bucket
                            t['handle'] = file_path.stem.replace('-tweets', '')
                            recent.append(t)
                    except:
                        continue
            except:
                continue

        return sorted(recent, key=lambda x: x.get('date', ''), reverse=True)

    def generate_drafts_from_buckets(self, claude_client: 'ClaudeClient' = None) -> List[str]:
        """Generate drafts from recent bucket tweets."""
        created = []

        # Breaking: < 10 minutes (immediate)
        breaking = self.scrape_recent_tweets("breaking", max_age_hours=0.17)

        # Commentary & Geopolitics: < 24 hours
        commentary = self.scrape_recent_tweets("commentary", max_age_hours=24)
        geopolitics = self.scrape_recent_tweets("geopolitics", max_age_hours=24)

        # Process breaking tweets FIRST (bilingual, auto-approve)
        for tweet in breaking[:5]:
            english_text = tweet.get('text', '')
            pattern = self.enricher.detect_pattern(english_text)

            # Translate breaking to Persian
            persian_text = ""
            if claude_client:
                try:
                    persian_text = self.enricher.translate_to_persian(english_text, claude_client)
                except:
                    pass

            path = self.draft_mgr.save_draft(
                english=english_text,
                persian=persian_text,
                pattern=pattern or "breaking",
                sources=[f"@{tweet.get('handle', 'unknown')}", "breaking"]
            )

            # Auto-approve breaking tweets
            draft_id = Path(path).stem if path else None
            if draft_id:
                self.draft_mgr.approve_draft(draft_id)
            created.append(path)

        # Process other buckets as drafts (English only for now)
        for tweet in (commentary + geopolitics)[:10]:
            english_text = tweet.get('text', '')
            pattern = self.enricher.detect_pattern(english_text)

            path = self.draft_mgr.save_draft(
                english=english_text,
                persian="",
                pattern=pattern or "general",
                sources=[f"@{tweet.get('handle', 'unknown')}", tweet.get('bucket', '')]
            )
            created.append(path)

        return created

    def run_cycle(self, claude_client: 'ClaudeClient' = None) -> Dict:
        """Run one complete cycle: scrape → enrich → queue."""
        results = {
            "timestamp": datetime.now().isoformat(),
            "drafts_created": [],
            "errors": []
        }

        try:
            created = self.generate_drafts_from_buckets(claude_client)
            results["drafts_created"] = created
        except Exception as e:
            results["errors"].append(str(e))

        return results


class DraftManager:
    """Manages tweet drafts with media attachments."""

    def __init__(self, drafts_dir: Path = DRAFTS_DIR):
        self.drafts_dir = drafts_dir
        self.pending_dir = drafts_dir / "pending"
        self.approved_dir = drafts_dir / "approved"
        self.posted_dir = drafts_dir / "posted"

        # Ensure directories exist
        for d in [self.pending_dir, self.approved_dir, self.posted_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def save_draft(self, english: str, persian: str, pattern: str,
                   media: List[str] = None, hashtags: List[str] = None,
                   sources: List[str] = None) -> str:
        """Save a draft with media attachments."""
        draft_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        draft = {
            "id": draft_id,
            "created_at": datetime.now().isoformat(),
            "status": "pending",
            "pattern": pattern,
            "english": english,
            "persian": persian,
            "media": media or [],
            "hashtags": hashtags or [],
            "sources": sources or [],
            "posted_at": None,
            "tweet_id": None
        }

        draft_file = self.pending_dir / f"draft_{draft_id}.json"
        with open(draft_file, 'w', encoding='utf-8') as f:
            json.dump(draft, f, indent=2, ensure_ascii=False)

        return str(draft_file)

    def list_pending(self) -> List[Dict]:
        """List all pending drafts."""
        drafts = []
        for f in self.pending_dir.glob("*.json"):
            with open(f, 'r', encoding='utf-8') as file:
                drafts.append(json.load(file))
        return sorted(drafts, key=lambda d: d.get("created_at", ""), reverse=True)

    def approve_draft(self, draft_id: str) -> bool:
        """Move draft from pending to approved."""
        for f in self.pending_dir.glob(f"*{draft_id}*.json"):
            dest = self.approved_dir / f.name
            f.rename(dest)
            return True
        return False

    def mark_posted(self, draft_id: str, tweet_id: str = None) -> bool:
        """Move draft from approved to posted."""
        for f in self.approved_dir.glob(f"*{draft_id}*.json"):
            # Update the draft
            with open(f, 'r', encoding='utf-8') as file:
                draft = json.load(file)
            draft["status"] = "posted"
            draft["posted_at"] = datetime.now().isoformat()
            draft["tweet_id"] = tweet_id

            dest = self.posted_dir / f.name
            with open(dest, 'w', encoding='utf-8') as file:
                json.dump(draft, file, indent=2, ensure_ascii=False)
            f.unlink()
            return True
        return False


class KnowledgeBase:
    """Loads and queries the knowledge base JSONs."""
    
    def __init__(self, base_dir: Path = KNOWLEDGE_DIR):
        self.base_dir = base_dir
        self.data = {}
        self._load_all()
    
    def _load_all(self):
        """Load all knowledge base files."""
        for key, filename in KNOWLEDGE_FILES.items():
            filepath = self.base_dir / filename
            if filepath.exists():
                with open(filepath, 'r', encoding='utf-8') as f:
                    self.data[key] = json.load(f)
            else:
                print(f"Warning: {filepath} not found")
                self.data[key] = {}
    
    def get_facts(self, category: Optional[str] = None) -> List[Dict]:
        """Get facts, optionally filtered by category."""
        facts = self.data.get("facts", {}).get("facts", [])
        if category:
            return [f for f in facts if f.get("category") == category]
        return facts
    
    def get_historical_event(self, event_id: str) -> Optional[Dict]:
        """Get a specific historical event."""
        history = self.data.get("history", {})
        for era_key, era_data in history.get("timeline", {}).items():
            events = era_data.get("events", [])
            for event in events:
                if event.get("date") == event_id or event.get("event", "").lower().startswith(event_id.lower()):
                    return event
        return None
    
    def get_parallel(self, parallel_name: str) -> Optional[Dict]:
        """Get a specific parallel comparison."""
        history = self.data.get("history", {})
        return history.get(parallel_name)
    
    def search(self, query: str) -> List[Dict]:
        """Search across all knowledge bases for relevant content."""
        results = []
        query_lower = query.lower()

        # Search facts
        for fact in self.get_facts():
            if query_lower in fact.get("statement", "").lower():
                results.append({"type": "fact", "data": fact})

        # Search narratives
        narratives = self.data.get("narratives", {}).get("narratives", [])
        for narrative in narratives:
            if query_lower in narrative.get("title", "").lower() or query_lower in narrative.get("description", "").lower():
                results.append({"type": "narrative", "data": narrative})

        # Search actors
        actors = self.data.get("actors", {}).get("actors", [])
        for actor in actors:
            if (query_lower in actor.get("name", "").lower() or
                query_lower in actor.get("role", "").lower()):
                results.append({"type": "actor", "data": actor})

        return results

    def get_actors(self, actor_type: Optional[str] = None) -> List[Dict]:
        """Get actors, optionally filtered by type."""
        actors = self.data.get("actors", {}).get("actors", [])
        if actor_type:
            return [a for a in actors if a.get("type") == actor_type]
        return actors

    def get_narratives(self, status: Optional[str] = None) -> List[Dict]:
        """Get narratives, optionally filtered by status."""
        narratives = self.data.get("narratives", {}).get("narratives", [])
        if status:
            return [n for n in narratives if n.get("status") == status]
        return narratives

    def get_relevant_actors(self, topic: str) -> List[Dict]:
        """Get actors relevant to a topic."""
        actors = self.get_actors()
        relevant = []
        topic_lower = topic.lower()
        for actor in actors:
            if (topic_lower in actor.get("name", "").lower() or
                topic_lower in actor.get("role", "").lower() or
                any(topic_lower in action.lower() for action in actor.get("keyActions", []))):
                relevant.append(actor)
        return relevant

    def load_patterns_from_narratives(self) -> Dict[str, Dict]:
        """Load tweet patterns dynamically from narratives.json."""
        narratives = self.get_narratives()
        patterns = {}
        for n in narratives:
            patterns[n["id"]] = {
                "title": n.get("title", ""),
                "template": n.get("tweetAngle", ""),
                "categories": n.get("relatedCategories", []),
                "frequency": n.get("frequency", ""),
                "priority": n.get("priority", 1),
                "hashtags": n.get("hashtags", []),
                "relatedActors": n.get("relatedActors", [])
            }
        return patterns

    def get_stats(self) -> Dict:
        """Get knowledge base statistics."""
        quotes_data = self.data.get("quotes", {})
        quote_bank = quotes_data.get("quote_bank", {}).get("by_topic", {})
        persian = quotes_data.get("persian_phrases", {})

        # Count anniversaries
        calendar = self.data.get("calendar", {}).get("anniversary_calendar", {})
        anniversary_count = sum(len(v) for v in calendar.values() if isinstance(v, list))

        # Count sources by tier
        sources_data = self.data.get("sources", {}).get("source_credibility", {}).get("sources", {})
        sources_count = sum(len(v) for v in sources_data.values() if isinstance(v, dict))

        # Count thread templates (templates is a dict)
        threads_dict = self.data.get("threads", {}).get("thread_templates", {}).get("templates", {})
        threads = list(threads_dict.keys()) if isinstance(threads_dict, dict) else []

        # Count platforms
        platforms = self.data.get("multiplatform", {}).get("multiplatform_guide", {}).get("platforms", {})

        return {
            # Core knowledge
            "facts": len(self.get_facts()),
            "actors": len(self.get_actors()),
            "narratives": len(self.get_narratives()),
            "active_narratives": len(self.get_narratives("active")),
            "quotes": sum(len(v) for v in quote_bank.values()),
            "persian_slogans": len(persian.get("protest_slogans", [])),
            "persian_terms": len(persian.get("historical_terms", [])),
            # Operational knowledge
            "anniversaries": anniversary_count,
            "sources_tracked": sources_count,
            "thread_templates": len(threads) if isinstance(threads, list) else 0,
            "platforms": len(platforms),
            "corpus_scraped": len(self.get_corpus_scraped()),
            "corpus_samples": len(self.get_corpus_samples())
        }

    def get_quotes(self, topic: Optional[str] = None) -> List[Dict]:
        """Get quotes, optionally filtered by topic."""
        quote_bank = self.data.get("quotes", {}).get("quote_bank", {}).get("by_topic", {})
        if topic and topic in quote_bank:
            return quote_bank[topic]
        all_quotes = []
        for quotes in quote_bank.values():
            all_quotes.extend(quotes)
        return all_quotes

    def get_persian_slogans(self) -> List[Dict]:
        """Get Persian protest slogans."""
        return self.data.get("quotes", {}).get("persian_phrases", {}).get("protest_slogans", [])

    def get_persian_terms(self) -> List[Dict]:
        """Get Persian historical terms."""
        return self.data.get("quotes", {}).get("persian_phrases", {}).get("historical_terms", [])

    def get_persian_phrase(self, transliteration: str) -> Optional[Dict]:
        """Get a specific Persian phrase by transliteration."""
        all_phrases = (
            self.get_persian_slogans() +
            self.get_persian_terms() +
            self.data.get("quotes", {}).get("persian_phrases", {}).get("cultural_phrases", [])
        )
        for phrase in all_phrases:
            if phrase.get("transliteration", "").lower() == transliteration.lower():
                return phrase
        return None

    def get_anniversary_for_date(self, month: int, day: int) -> List[Dict]:
        """Get historical anniversaries for a specific date."""
        calendar = self.data.get("calendar", {}).get("anniversary_calendar", {})
        month_names = ["", "january", "february", "march", "april", "may", "june",
                       "july", "august", "september", "october", "november", "december"]
        month_key = month_names[month] if 1 <= month <= 12 else ""

        month_events = calendar.get(month_key, [])
        results = []
        date_str = f"{month:02d}-{day:02d}"

        for event in month_events:
            event_date = event.get("date", "")
            if event_date == date_str or event_date.startswith(date_str):
                results.append(event)
        return results

    def get_today_anniversary(self) -> List[Dict]:
        """Get anniversaries for today's date."""
        today = datetime.now()
        return self.get_anniversary_for_date(today.month, today.day)

    def get_source_tier(self, source_name: str) -> Optional[Dict]:
        """Get credibility tier for a source."""
        credibility = self.data.get("sources", {}).get("source_credibility", {})
        sources = credibility.get("sources", {})

        source_lower = source_name.lower()
        for category, category_sources in sources.items():
            for source_id, source_data in category_sources.items():
                if (source_lower in source_id.lower() or
                    source_lower in source_data.get("name", "").lower()):
                    return {**source_data, "category": category, "id": source_id}
        return None

    def get_sources_by_tier(self, tier: int) -> List[Dict]:
        """Get all sources at a specific credibility tier (1-4)."""
        credibility = self.data.get("sources", {}).get("source_credibility", {})
        sources = credibility.get("sources", {})

        results = []
        for category, category_sources in sources.items():
            for source_id, source_data in category_sources.items():
                if source_data.get("tier") == tier:
                    results.append({**source_data, "category": category, "id": source_id})
        return results

    def get_tier_definitions(self) -> Dict:
        """Get source tier definitions."""
        return self.data.get("sources", {}).get("source_credibility", {}).get("tier_definitions", {})

    def get_corpus_scraped(self) -> List[Dict]:
        """Get scraped tweets from @FaytuksNetwork."""
        return self.data.get("corpus_scraped", {}).get("tweets", [])

    def get_corpus_samples(self, category: Optional[str] = None) -> List[Dict]:
        """Get sample generated tweets, optionally filtered by category."""
        samples = self.data.get("corpus_samples", {}).get("sample_tweets_generated", {})
        if category:
            cat_key = f"category_{category}" if not category.startswith("category_") else category
            return samples.get(cat_key, {}).get("tweets", [])
        # Return all tweets from all categories
        all_tweets = []
        for cat_key, cat_data in samples.items():
            if isinstance(cat_data, dict) and "tweets" in cat_data:
                all_tweets.extend(cat_data["tweets"])
        return all_tweets

    def get_corpus_by_pattern(self, pattern: str) -> List[Dict]:
        """Get corpus samples matching a pattern."""
        samples = self.get_corpus_samples()
        return [t for t in samples if t.get("pattern") == pattern]


class TemplateBase:
    """Loads and queries template files (hashtags, threads, multiplatform) - now in knowledge/ dir."""

    def __init__(self, base_dir: Path = KNOWLEDGE_DIR):
        self.base_dir = base_dir
        self.data = {}
        self._load_all()

    def _load_all(self):
        """Load template files from knowledge directory."""
        template_keys = ["hashtags", "threads", "multiplatform", "framework"]
        for key in template_keys:
            filename = KNOWLEDGE_FILES.get(key)
            if filename:
                filepath = self.base_dir / filename
                if filepath.exists():
                    with open(filepath, 'r', encoding='utf-8') as f:
                        self.data[key] = json.load(f)
                else:
                    print(f"Warning: Template {filepath} not found")
                    self.data[key] = {}

    def get_hashtag_strategy(self) -> Dict:
        """Get full hashtag strategy."""
        return self.data.get("hashtags", {}).get("hashtag_strategy", {})

    def get_primary_hashtags(self) -> List[Dict]:
        """Get tier 1 (primary) hashtags."""
        strategy = self.get_hashtag_strategy()
        return strategy.get("hashtag_tiers", {}).get("tier_1_primary", {}).get("hashtags", [])

    def get_hashtags_for_content_type(self, content_type: str) -> Dict:
        """Get recommended hashtag combination for a content type."""
        strategy = self.get_hashtag_strategy()
        return strategy.get("combination_strategy", {}).get(content_type, {})

    def get_thread_template(self, template_id: str) -> Optional[Dict]:
        """Get a specific thread template by ID."""
        templates = self.data.get("threads", {}).get("thread_templates", {}).get("templates", {})
        # templates is a dict keyed by template name
        for name, template in templates.items():
            if template.get("id") == template_id or name == template_id:
                return {**template, "key": name}
        return None

    def get_all_thread_templates(self) -> List[Dict]:
        """Get all thread templates."""
        templates = self.data.get("threads", {}).get("thread_templates", {}).get("templates", {})
        # Convert dict to list
        return [{"key": k, **v} for k, v in templates.items()] if isinstance(templates, dict) else templates

    def get_platform_specs(self, platform: str) -> Optional[Dict]:
        """Get specifications for a specific platform."""
        platforms = self.data.get("multiplatform", {}).get("multiplatform_guide", {}).get("platforms", {})
        return platforms.get(platform)

    def get_all_platforms(self) -> Dict:
        """Get all platform specifications."""
        return self.data.get("multiplatform", {}).get("multiplatform_guide", {}).get("platforms", {})

    def get_quality_rubric(self) -> Dict:
        """Get the quality scoring rubric from synthesis framework."""
        return self.data.get("framework", {}).get("tweet_synthesis_framework", {}).get("voice_guidelines", {})


class TweetGenerator:
    """Generates tweets using Claude prompts."""
    
    def __init__(self, knowledge_base: KnowledgeBase):
        self.kb = knowledge_base
        self.patterns = self._load_patterns()
    
    def _load_patterns(self) -> Dict:
        """Load synthesis patterns from framework."""
        # In production, load from tweet-synthesis-framework.json
        return {
            TweetPattern.FIRE_PARALLEL: {
                "template": "[Event 1978] + [Blame then] → [Event 2026] + [Blame now] → [Reveal truth]",
                "example": "1978: Islamists burn 400 alive in Cinema Rex, blame Shah. 2026: Same Islamists burn protesters in Rasht, blame 'rioters.' Same fire. Same lies."
            },
            TweetPattern.COUNTER_REVOLUTION: {
                "template": "[1978 aspiration] → [1979 hijacking] → [47 years of tyranny] → [2026 completion]",
                "example": "1978: Iranians wanted freedom. 1979: Khomeini stole it. 2026: The grandchildren finish what grandparents started."
            },
            TweetPattern.IRAQ_CONTRAST: {
                "template": "[Iraq failure reason] → [Iran opposite] → [Why 2026 different]",
                "example": "Iraq: No democratic history. Iran: Constitutional revolution 1906. Not the same."
            },
            TweetPattern.GREAT_POWER_GAME: {
                "template": "[Historical humiliation] → [Current dependency] → [Future leverage]",
                "example": "1828: Russia took Caucasus. 2021: Mullahs sold Iran to China. 2026: Free Iran plays all powers."
            }
        }
    
    def generate_prompt(self, topic: str, pattern: TweetPattern, context: Optional[Dict] = None,
                        emotion: Optional[str] = None, hook_config: Optional[Dict] = None) -> str:
        """Generate a Claude prompt for tweet creation."""
        pattern_info = self.patterns.get(pattern, {})

        # Get relevant facts
        relevant_facts = self.kb.search(topic)
        facts_text = "\n".join([f"- {r['data'].get('statement', r['data'].get('name', ''))}" for r in relevant_facts[:5]])

        # Get relevant quotes
        quotes = self.kb.get_quotes()
        quotes_text = ""
        if quotes:
            relevant_quotes = [q for q in quotes if topic.lower() in q.get("context", "").lower() or
                              topic.lower() in q.get("quote", "").lower()][:2]
            if relevant_quotes:
                quotes_text = "\n\nAVAILABLE QUOTES:\n" + "\n".join([
                    f'- "{q["quote"]}" - {q.get("author", "Unknown")}' for q in relevant_quotes
                ])

        # Get Persian phrases
        slogans = self.kb.get_persian_slogans()[:3]
        persian_text = ""
        if slogans:
            persian_text = "\n\nPERSIAN PHRASES (optional, 1 max):\n" + "\n".join([
                f'- {s["persian"]} ({s["transliteration"]}) = "{s["english"]}"' for s in slogans
            ])

        # Build emotional guidance
        emotion_guidance = ""
        if emotion:
            emotion_descriptions = {
                "OUTRAGE": "Trigger moral outrage at injustice. Lead with the most shocking fact.",
                "PRIDE": "Invoke Persian historical pride. Emphasize achievements and legacy.",
                "HOPE": "Inspire with possibility of change. Connect struggle to eventual victory.",
                "IRONY": "Expose regime contradictions with bitter humor. Let absurdity speak.",
                "GRIEF": "Honor the human cost. Make deaths feel personal, not statistical.",
                "CONTEMPT": "Expose cowardice and hypocrisy. Use precise, cutting language.",
            }
            emotion_guidance = f"\n\nEMOTIONAL TARGET: {emotion}\n{emotion_descriptions.get(emotion, '')}"

        # Build hook guidance
        hook_guidance = ""
        if hook_config:
            hook_guidance = f"""

OPENING HOOK (CRITICAL - first line must stop scrolling):
Template: {hook_config.get('template', '')}
Example: {hook_config.get('example', '')}
The FIRST LINE must grab attention using this pattern."""

        prompt = f"""Generate a tweet about: {topic}

PATTERN TO USE: {pattern.value}
Template: {pattern_info.get('template', 'N/A')}
Example: {pattern_info.get('example', 'N/A')}{emotion_guidance}{hook_guidance}

RELEVANT FACTS FROM KNOWLEDGE BASE:
{facts_text}{quotes_text}{persian_text}

REQUIREMENTS:
1. Maximum 280 characters
2. Ground in specific historical facts with dates
3. Use parallel structure for comparisons
4. 1-2 hashtags maximum
5. Match Faytuks voice: authoritative, passionate, fact-based
6. Persian phrases optional - use sparingly for authenticity
7. FIRST LINE MUST BE SCROLL-STOPPING (use the hook template)

OUTPUT FORMAT:
TWEET: [the tweet text]
SOURCES: [list facts/sources used]
CONFIDENCE: [high/medium/low]
"""

        if context:
            prompt += f"\nADDITIONAL CONTEXT:\n{json.dumps(context, indent=2)}"

        return prompt
    
    def generate_thread_prompt(self, topic: str, length: int = 6) -> str:
        """Generate a Claude prompt for thread creation."""
        relevant_facts = self.kb.search(topic)
        facts_text = "\n".join([f"- {r['data'].get('statement', r['data'].get('name', ''))}" for r in relevant_facts[:10]])
        
        return f"""Create a Twitter thread about: {topic}

TARGET LENGTH: {length} tweets

RELEVANT FACTS:
{facts_text}

STRUCTURE:
1/ Hook with 🧵 - create curiosity
2-{length-1}/ Build through historical evidence
{length}/ Forward-looking conclusion

REQUIREMENTS:
- Each tweet max 280 characters
- Ground in specific facts with dates
- Build narrative across tweets
- End with call to reflection or action

OUTPUT FORMAT:
1/ [tweet 1]

2/ [tweet 2]

... etc

SOURCES USED: [list]
"""
    
    def generate_counter_prompt(self, claim: str, source_type: str = "regime") -> str:
        """Generate a Claude prompt for counter-narrative."""
        counter_strategies = {
            "regime": "Use Cinema Rex parallel. Cite victim names. Note pattern of blaming outsiders.",
            "tankie": "Use Iraq Contrast. Cite 1906 Constitutional Revolution. Note silence on deaths.",
            "isolationist": "Distinguish support from invasion. Cite Iran's sabotage of Iraq. Note no troops proposed.",
            "fragmenter": "Use ethnic unity evidence. Cite 2,500 years. Note Yugoslavia comparison is false.",
            "mek": "Cite Saddam alliance during Iran-Iraq war. Note zero support inside Iran. Follow the money - Giuliani $20K/speech, Bolton paid appearances.",
            "niac": "Cite federal court ruling: 'not inconsistent with lobbying for regime'. Note 'NIAC' is slur inside Iran. Parsi met Obama officials 33 times.",
            "bbc": "Cite 'Ayatollah BBC' campaign by Iranians. Note Gaza vs Iran coverage disparity. 2019: BBC agreed to regime conditions on reporting.",
            "voa": "Note editorial choices platform various opposition factions. Accused of not adequately supporting Pahlavi."
        }
        
        strategy = counter_strategies.get(source_type, counter_strategies["regime"])
        
        return f"""Counter this claim without repeating it.

CLAIM TO COUNTER: {claim}
SOURCE TYPE: {source_type}

STRATEGY: {strategy}

REQUIREMENTS:
1. Do NOT repeat the false claim
2. Present factual counter with evidence
3. Reframe in Faytuks terms
4. Maintain composure
5. Max 280 characters

OUTPUT FORMAT:
COUNTER-TWEET: [the tweet]
STRATEGY USED: [strategy name]
FACTS DEPLOYED: [list]
"""


class TweetValidator:
    """Validates tweets through the laboratory loops."""
    
    def __init__(self, knowledge_base: KnowledgeBase):
        self.kb = knowledge_base
    
    def generate_fact_check_prompt(self, tweet: str, claimed_facts: List[Dict]) -> str:
        """Generate prompt for fact-checking."""
        facts_list = "\n".join([f"- Claim: {f['claim']}, Source: {f.get('source', 'unknown')}" for f in claimed_facts])
        
        return f"""Fact-check this tweet.

TWEET: {tweet}

CLAIMED FACTS:
{facts_list}

For each fact, verify:
1. Is the fact present in cited source?
2. Is it stated accurately (numbers, dates)?
3. Is context preserved?

OUTPUT:
FACT 1: [claim]
- Accurate: YES/NO
- Verdict: PASS/FAIL
- Fix needed: [if any]

[repeat for each fact]

OVERALL: PUBLISH/REVISE/REJECT
"""
    
    def generate_voice_check_prompt(self, tweet: str) -> str:
        """Generate prompt for voice consistency check."""
        return f"""Check this tweet for Faytuks voice consistency.

TWEET: {tweet}

SCORE 1-5 ON:
1. Authoritative but not academic
2. Passionate but fact-based
3. Historical depth with present urgency
4. Persian pride without chauvinism
5. Critical of regime, supportive of people

CHECK FOR VIOLATIONS:
- Excessive hashtags (>2)
- Sycophantic praise
- Gratuitous violence
- Sectarian language
- Ethnic division
- Speculation as fact

OUTPUT:
VOICE SCORES: [1]/5, [2]/5, [3]/5, [4]/5, [5]/5
TOTAL: [X]/25
VIOLATIONS: [list any]
VERDICT: ON-VOICE/NEEDS-ADJUSTMENT/OFF-VOICE
SUGGESTIONS: [if needed]
"""
    
    def generate_parallel_check_prompt(self, tweet: str, parallel: str) -> str:
        """Generate prompt for parallel strength check."""
        return f"""Evaluate historical parallel strength.

TWEET: {tweet}
PARALLEL CLAIMED: {parallel}

SCORE 1-5 ON:
1. Accuracy of both events
2. Relevance of connection
3. Proportionality (not hyperbolic)
4. Novelty (not overused)
5. Emotional resonance

OUTPUT:
PARALLEL SCORES: [1]/5, [2]/5, [3]/5, [4]/5, [5]/5
TOTAL: [X]/25
VERDICT: USE/MODIFY/RETIRE
SUGGESTIONS: [if needed]
"""
    
    def full_validation_prompt(self, tweet: str) -> str:
        """Generate comprehensive validation prompt."""
        return f"""Perform full validation of this tweet.

TWEET: {tweet}

=== FACT CHECK ===
List all factual claims and verify each.

=== VOICE CHECK ===
Score 1-5 on each criterion:
1. Authoritative/Accessible
2. Passionate/Factual
3. Historical/Urgent
4. Pride/Not Chauvinist
5. Anti-regime/Pro-people

=== PARALLEL CHECK (if applicable) ===
If tweet uses historical parallel, evaluate strength.

=== FINAL VERDICT ===
READY TO PUBLISH: YES/NO
ISSUES: [list any]
SUGGESTIONS: [list any]
CONFIDENCE: high/medium/low
"""


class DailyBriefGenerator:
    """Generates daily tweet packages."""
    
    def __init__(self, knowledge_base: KnowledgeBase):
        self.kb = knowledge_base
    
    def generate_daily_prompt(self, date: str, developments: List[str], previous_focus: str = None) -> str:
        """Generate prompt for daily tweet package."""
        dev_text = "\n".join([f"- {d}" for d in developments])

        # Calculate days since uprising
        start_date = datetime(2025, 12, 28)
        current = datetime.strptime(date, "%Y-%m-%d")
        days = (current - start_date).days

        # Check for historical anniversaries
        anniversaries = self.kb.get_anniversary_for_date(current.month, current.day)
        anniversary_text = ""
        if anniversaries:
            anniversary_text = "\n\n📅 TODAY'S HISTORICAL ANNIVERSARIES:\n"
            for ann in anniversaries:
                anniversary_text += f"- {ann.get('year', 'N/A')}: {ann.get('event', 'Unknown')}\n"
                anniversary_text += f"  Significance: {ann.get('significance', '')}\n"
                if ann.get('tweetAngle'):
                    anniversary_text += f"  Suggested angle: {ann.get('tweetAngle')}\n"
            anniversary_text += "\n⚡ INTEGRATE ANNIVERSARY into morning history tweet if relevant!"

        return f"""Generate daily tweet package for Faytuks Network.

DATE: {date}
DAY {days} OF UPRISING

OVERNIGHT DEVELOPMENTS:
{dev_text}{anniversary_text}

PREVIOUS FOCUS: {previous_focus or 'N/A'}

GENERATE 4 TWEETS:

1. MORNING HISTORY TWEET
   - Deep historical parallel
   - Educational, sets context
   - Best for: 8-9 AM EST

2. MIDDAY UPDATE TWEET
   - Breaking news + historical echo
   - Timely, news-focused
   - Best for: 12-1 PM EST

3. EVENING NARRATIVE TWEET
   - Synthesizes day into pattern
   - Thematic, connective
   - Best for: 6-7 PM EST

4. NIGHT REFLECTION TWEET
   - Human story or diaspora voice
   - Emotional, personal
   - Best for: 10-11 PM EST

Also provide:
- THREAD OPPORTUNITY: Topic worth full thread?
- COUNTER-NARRATIVE NEEDED: Claims to address?
- HASHTAG STRATEGY: What to use today?

OUTPUT FORMAT:
=== DAILY PACKAGE: {date} ===

MORNING:
[tweet]

MIDDAY:
[tweet]

EVENING:
[tweet]

NIGHT:
[tweet]

THREAD: [yes/no - topic]
COUNTER: [claim if any]
HASHTAGS: [list]
"""


class CorpusManager:
    """Manages corpus integrated with TypeScript system's generation-history.json."""

    def __init__(self, history_file: Path = GENERATION_HISTORY_FILE):
        self.history_file = history_file
        self.history = self._load_history()

    def _load_history(self) -> Dict:
        """Load generation history from shared file."""
        if self.history_file.exists():
            with open(self.history_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {"recentDrafts": [], "publishedTweets": [], "metadata": {"lastUpdated": "", "version": "1.0"}}

    def save_history(self):
        """Save generation history to shared file."""
        self.history["metadata"]["lastUpdated"] = datetime.now().isoformat()
        with open(self.history_file, 'w', encoding='utf-8') as f:
            json.dump(self.history, f, indent=2, ensure_ascii=False)

    def add_draft(self, theme: str, narrative_id: str, fact_ids: List[str]):
        """Add a draft to history (compatible with TypeScript system)."""
        entry = {
            "id": f"draft_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "theme": theme,
            "narrativeId": narrative_id,
            "generatedAt": datetime.now().isoformat(),
            "factIds": fact_ids
        }
        self.history.setdefault("recentDrafts", []).append(entry)
        if len(self.history["recentDrafts"]) > 50:
            self.history["recentDrafts"] = self.history["recentDrafts"][-50:]
        self.save_history()
        return entry

    def add_published(self, tweet: str, pattern: str, performance: Dict, tags: List[str], why_it_worked: str):
        """Add a published high-performing tweet to corpus."""
        entry = {
            "id": f"pub_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "tweet": tweet,
            "publishedAt": datetime.now().isoformat(),
            "pattern": pattern,
            "performance": performance,
            "tags": tags,
            "why_it_worked": why_it_worked
        }
        self.history.setdefault("publishedTweets", []).append(entry)
        self.save_history()
        return entry

    def get_published(self, query: Optional[str] = None, pattern: Optional[str] = None, min_engagement: float = 0.0) -> List[Dict]:
        """Search published tweets."""
        results = self.history.get("publishedTweets", [])

        if query:
            query_lower = query.lower()
            results = [e for e in results if query_lower in e.get("tweet", "").lower()]

        if pattern:
            results = [e for e in results if e.get("pattern") == pattern]

        if min_engagement > 0:
            results = [e for e in results if e.get("performance", {}).get("engagement_rate", 0) >= min_engagement]

        return results

    def get_best_template(self, pattern: str) -> Optional[Dict]:
        """Get best performing template for a pattern."""
        matches = self.get_published(pattern=pattern)
        if matches:
            matches.sort(key=lambda x: x.get("performance", {}).get("engagement_rate", 0), reverse=True)
            return matches[0]
        return None

    def get_recent_drafts(self, limit: int = 10) -> List[Dict]:
        """Get recent drafts."""
        return self.history.get("recentDrafts", [])[-limit:]


class AnniversaryGenerator:
    """Generates anniversary tweets from the calendar."""

    CALENDAR_FILE = KNOWLEDGE_DIR / "anniversary-calendar.json"

    def __init__(self, knowledge_base: KnowledgeBase):
        self.kb = knowledge_base
        self.calendar = self._load_calendar()

    def _load_calendar(self) -> Dict:
        """Load anniversary calendar."""
        if self.CALENDAR_FILE.exists():
            with open(self.CALENDAR_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    def get_anniversary(self, date_str: str) -> Optional[Dict]:
        """Get anniversary for a specific date (MM-DD format)."""
        calendar = self.calendar.get("anniversary_calendar", {})
        month_names = {
            "01": "january", "02": "february", "03": "march", "04": "april",
            "05": "may", "06": "june", "07": "july", "08": "august",
            "09": "september", "10": "october", "11": "november", "12": "december"
        }
        month = date_str[:2]
        month_key = month_names.get(month)
        if not month_key or month_key not in calendar:
            return None

        for event in calendar[month_key]:
            if event.get("date") == date_str:
                return event
        return None

    def get_today_anniversary(self) -> Optional[Dict]:
        """Get anniversary for today's date."""
        today = datetime.now().strftime("%m-%d")
        return self.get_anniversary(today)

    def generate_prompt(self, anniversary: Dict, current_context: Optional[str] = None) -> str:
        """Generate Claude prompt for anniversary tweet."""
        pattern = anniversary.get("pattern", "counter_revolution")
        emotions = get_emotions(pattern)
        hook = get_best_hook(pattern)
        hook_config = HOOK_TEMPLATES.get(hook, {})

        return f"""Generate an anniversary tweet for Faytuks Network.

HISTORICAL EVENT:
Date: {anniversary.get('date')} ({anniversary.get('year')})
Event: {anniversary.get('event')}
Description: {anniversary.get('description', 'N/A')}
Significance: {anniversary.get('significance', 'N/A')}

EXISTING ANGLE (optional reference):
{anniversary.get('tweetAngle', 'N/A')}

PATTERN: {pattern}
PRIMARY EMOTION: {emotions[0]}
HOOK TYPE: {hook}
Hook template: {hook_config.get('template', 'N/A')}

CURRENT CONTEXT (if provided):
{current_context or 'N/A'}

REQUIREMENTS:
1. Connect historical event to 2026 revolution
2. Maximum 280 characters
3. Use provided pattern and emotional tone
4. Ground in specific historical facts with dates
5. 1-2 hashtags maximum (use from: {anniversary.get('hashtags', [])})

OUTPUT FORMAT:
ANNIVERSARY TWEET: [the tweet]
PATTERN USED: [pattern]
CONNECTION TO 2026: [how it connects]
"""


class VictimMemorialGenerator:
    """Generates dignified memorial tweets for verified victims."""

    VICTIMS_FILE = KNOWLEDGE_DIR / "victims-database.json"

    def __init__(self, knowledge_base: KnowledgeBase):
        self.kb = knowledge_base
        self.victims_db = self._load_victims()

    def _load_victims(self) -> Dict:
        """Load victims database."""
        if self.VICTIMS_FILE.exists():
            with open(self.VICTIMS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    def get_victims(self, verified_only: bool = True) -> List[Dict]:
        """Get list of victims."""
        victims = self.victims_db.get("victims_database", {}).get("victims", [])
        if verified_only:
            return [v for v in victims if v.get("verified", False)]
        return victims

    def get_victim_by_name(self, name: str) -> Optional[Dict]:
        """Find victim by name."""
        for victim in self.get_victims(verified_only=False):
            if name.lower() in victim.get("name", "").lower():
                return victim
        return None

    def get_random_victim(self) -> Optional[Dict]:
        """Get a random verified victim for daily memorial."""
        import random
        victims = self.get_victims(verified_only=True)
        return random.choice(victims) if victims else None

    def generate_prompt(self, victim: Dict) -> str:
        """Generate Claude prompt for memorial tweet."""
        guidelines = self.victims_db.get("victims_database", {}).get("usage_guidelines", {})

        return f"""Generate a dignified memorial tweet for this victim.

VICTIM INFO:
Name: {victim.get('name')}
Persian Name: {victim.get('persianName', 'N/A')}
Age: {victim.get('age', 'Unknown')}
City: {victim.get('city')}
Province: {victim.get('province', 'N/A')}
Date of Death: {victim.get('date_of_death')}
Circumstances: {victim.get('circumstances')}
Occupation: {victim.get('occupation', 'Unknown')}
Source: {victim.get('source')}

EXISTING TWEET ANGLES (for reference):
{chr(10).join(victim.get('tweet_angles', ['N/A']))}

REQUIREMENTS:
1. Dignified, not exploitative
2. Humanize without sensationalizing
3. Include name prominently (English and Persian if available)
4. Focus on life/dreams if known, or simple dignity if not
5. End with call to remember
6. Maximum 280 characters
7. ONE hashtag maximum (#IranRevolution or victim-specific)
8. Tone: grief, dignity, remembrance - NOT rage or sensationalism

AVOID:
- Graphic death details
- Speculation about circumstances
- Political framing that overshadows the person
- Using death for shock value

OUTPUT FORMAT:
MEMORIAL TWEET: [the tweet]
TONE CHECK: [confirm: grief/dignity/remembrance]
HUMANIZATION: [how the tweet humanizes the victim]
"""


# CLI Interface
def main():
    import argparse

    parser = argparse.ArgumentParser(description="Faytuks Tweet Synthesis Engine")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Generate command
    gen_parser = subparsers.add_parser("generate", help="Generate a single tweet")
    gen_parser.add_argument("--topic", required=True, help="Topic for the tweet")
    gen_parser.add_argument("--pattern", default="fire_parallel", help="Pattern to use (or narrative ID)")
    gen_parser.add_argument("--auto", action="store_true", help="Auto-detect best pattern from topic")
    gen_parser.add_argument("--emotion", choices=["OUTRAGE", "PRIDE", "HOPE", "IRONY", "GRIEF", "CONTEMPT"],
                           help="Primary emotion to evoke (auto-selected if not specified)")
    gen_parser.add_argument("--hook", choices=["shocking_stat", "historical_reveal", "question_hook",
                                               "contrast", "pattern_break", "time_anchor"],
                           help="Hook type for opener (auto-selected if not specified)")
    gen_parser.add_argument("--execute", action="store_true", help="Execute with Claude API (default: prompt only)")
    gen_parser.add_argument("--queue", action="store_true", help="Save to draft queue after generation")

    # Detect command - test auto-detection
    detect_parser = subparsers.add_parser("detect", help="Auto-detect patterns from text")
    detect_parser.add_argument("--text", required=True, help="News/text to analyze")

    # Thread command
    thread_parser = subparsers.add_parser("thread", help="Generate a thread")
    thread_parser.add_argument("--topic", required=True, help="Topic for the thread")
    thread_parser.add_argument("--length", type=int, default=6, help="Number of tweets")
    thread_parser.add_argument("--execute", action="store_true", help="Execute with Claude API")
    thread_parser.add_argument("--queue", action="store_true", help="Save to draft queue after generation")

    # Counter command
    counter_parser = subparsers.add_parser("counter", help="Generate counter-narrative")
    counter_parser.add_argument("--claim", required=True, help="Claim to counter")
    counter_parser.add_argument("--source", default="regime", help="Source type (regime/tankie/mek/niac/bbc/voa)")
    counter_parser.add_argument("--execute", action="store_true", help="Execute with Claude API")
    counter_parser.add_argument("--queue", action="store_true", help="Save to draft queue after generation")

    # Daily command
    daily_parser = subparsers.add_parser("daily", help="Generate daily package")
    daily_parser.add_argument("--date", required=True, help="Date (YYYY-MM-DD)")
    daily_parser.add_argument("--developments", nargs="+", help="Overnight developments")
    daily_parser.add_argument("--execute", action="store_true", help="Execute with Claude API")
    daily_parser.add_argument("--queue", action="store_true", help="Save to draft queue after generation")

    # Validate command
    validate_parser = subparsers.add_parser("validate", help="Validate a tweet")
    validate_parser.add_argument("--tweet", required=True, help="Tweet to validate")
    validate_parser.add_argument("--execute", action="store_true", help="Execute with Claude API")

    # Lab command
    lab_parser = subparsers.add_parser("lab", help="Run lab test")
    lab_parser.add_argument("--test", choices=["fact-check", "voice", "parallel", "full"], required=True)
    lab_parser.add_argument("--tweet", required=True, help="Tweet to test")
    lab_parser.add_argument("--execute", action="store_true", help="Execute with Claude API")

    # Stats command
    subparsers.add_parser("stats", help="Show knowledge base statistics")

    # Anniversary command
    ann_parser = subparsers.add_parser("anniversary", help="Check historical anniversaries and generate tweets")
    ann_parser.add_argument("--date", help="Date to check (MM-DD format, default: today)")
    ann_parser.add_argument("--context", help="Current context to connect anniversary to")
    ann_parser.add_argument("--execute", action="store_true", help="Generate tweet with Claude API")

    # Memorial command
    memorial_parser = subparsers.add_parser("memorial", help="Generate victim memorial tweet")
    memorial_parser.add_argument("--name", help="Victim name to memorialize")
    memorial_parser.add_argument("--random", action="store_true", help="Select random verified victim")
    memorial_parser.add_argument("--list", action="store_true", help="List all verified victims")
    memorial_parser.add_argument("--execute", action="store_true", help="Generate tweet with Claude API")

    # Source credibility command
    src_parser = subparsers.add_parser("source", help="Check source credibility")
    src_parser.add_argument("name", help="Source name to look up")

    # Hashtags command
    hash_parser = subparsers.add_parser("hashtags", help="Get hashtag recommendations")
    hash_parser.add_argument("--type", choices=["breaking_news", "historical_parallel", "victim_memorial",
                                                 "analysis_thread", "counter_propaganda"],
                             default="breaking_news", help="Content type")

    # Corpus command
    corpus_parser = subparsers.add_parser("corpus", help="Search tweet corpus")
    corpus_parser.add_argument("--pattern", help="Filter by pattern (e.g., fire_parallel)")
    corpus_parser.add_argument("--limit", type=int, default=5, help="Number of results")
    corpus_parser.add_argument("--scraped", action="store_true", help="Search scraped tweets instead of samples")

    # Media command - check/acquire media for patterns
    media_parser = subparsers.add_parser("media", help="Check media availability for patterns")
    media_parser.add_argument("--pattern", help="Pattern to check (e.g., fire_parallel)")
    media_parser.add_argument("--all", action="store_true", help="Check all patterns")
    media_parser.add_argument("--acquire", action="store_true", help="Show acquisition commands for missing media")

    # Draft/Queue command - manage tweet drafts
    draft_parser = subparsers.add_parser("draft", help="Manage tweet drafts (alias: queue)")
    draft_parser.add_argument("--list", action="store_true", help="List pending drafts")
    draft_parser.add_argument("--approved", action="store_true", help="List approved drafts")
    draft_parser.add_argument("--posted-list", action="store_true", help="List posted drafts")
    draft_parser.add_argument("--preview", help="Preview draft by ID with media suggestions")
    draft_parser.add_argument("--save", action="store_true", help="Save a new draft")
    draft_parser.add_argument("--english", help="English tweet text")
    draft_parser.add_argument("--persian", help="Persian tweet text")
    draft_parser.add_argument("--pattern", help="Synthesis pattern used")
    draft_parser.add_argument("--media", nargs="+", help="Media file paths to attach")
    draft_parser.add_argument("--attach", nargs=2, metavar=("ID", "PATH"), help="Attach media to draft")
    draft_parser.add_argument("--approve", help="Approve draft by ID")
    draft_parser.add_argument("--reject", help="Delete draft by ID")
    draft_parser.add_argument("--stats", action="store_true", help="Show queue statistics")

    # Queue command - alias for draft
    queue_parser = subparsers.add_parser("queue", help="Manage tweet queue (alias for draft)")
    queue_parser.add_argument("action", nargs="?", choices=["list", "preview", "approve", "attach", "reject", "stats"],
                              help="Queue action")
    queue_parser.add_argument("id", nargs="?", help="Draft ID")
    queue_parser.add_argument("path", nargs="?", help="Media path for attach")
    queue_parser.add_argument("--approved", action="store_true", help="List approved")
    queue_parser.add_argument("--posted", action="store_true", help="List posted")

    # Post command - workflow for Chrome posting
    post_parser = subparsers.add_parser("post", help="Post workflow (shows instructions for claude --chrome)")
    post_parser.add_argument("--draft", help="Draft ID to post")
    post_parser.add_argument("--next", action="store_true", help="Get next approved draft")
    post_parser.add_argument("--clipboard", action="store_true", help="Copy tweet to clipboard instead of browser posting")

    # Posted command - track posted tweets
    posted_parser = subparsers.add_parser("posted", help="Track posted tweets")
    posted_parser.add_argument("action", nargs="?", choices=["confirm", "list", "stats"],
                               default="list", help="Action")
    posted_parser.add_argument("id", nargs="?", help="Draft ID for confirm")
    posted_parser.add_argument("--url", help="Tweet URL for confirm")

    # Refresh command - scrape buckets and generate drafts
    refresh_parser = subparsers.add_parser("refresh", help="Refresh drafts from bucket tweets")
    refresh_parser.add_argument("--execute", action="store_true", help="Enrich with Claude API")
    refresh_parser.add_argument("--breaking-hours", type=int, default=1, help="Max age for breaking (default: 1h)")
    refresh_parser.add_argument("--other-hours", type=int, default=24, help="Max age for other buckets (default: 24h)")

    # Enrich command - add historical parallels to a draft
    enrich_parser = subparsers.add_parser("enrich", help="Enrich draft with historical parallels")
    enrich_parser.add_argument("--draft", required=True, help="Draft ID to enrich")
    enrich_parser.add_argument("--execute", action="store_true", help="Generate supplemental tweet with Claude")

    # Daemon command - continuous operation
    daemon_parser = subparsers.add_parser("daemon", help="Run continuous operation daemon")
    daemon_parser.add_argument("--interval", type=int, default=3600, help="Check interval in seconds (default: 1h)")
    daemon_parser.add_argument("--execute", action="store_true", help="Enable Claude API enrichment")

    args = parser.parse_args()

    # Initialize components
    kb = KnowledgeBase()
    templates = TemplateBase()
    generator = TweetGenerator(kb)
    validator = TweetValidator(kb)
    daily_gen = DailyBriefGenerator(kb)

    # Initialize Claude client if --execute is used
    claude = None
    if hasattr(args, 'execute') and args.execute:
        if not ANTHROPIC_AVAILABLE:
            print("Error: anthropic package not installed. Run: pip install anthropic")
            return
        claude = ClaudeClient()
    
    if args.command == "detect":
        matches = auto_detect_pattern(args.text)
        print("=== PATTERN DETECTION ===")
        if not matches:
            print("No patterns matched. Try including more specific keywords.")
        else:
            for pattern_name, score, keywords in matches:
                print(f"\n{pattern_name}: {score:.0%} match")
                print(f"  Matched: {', '.join(keywords)}")
            print(f"\nRecommended: {matches[0][0]}")

    elif args.command == "generate":
        # Auto-detect pattern if --auto flag is set
        if args.auto:
            matches = auto_detect_pattern(args.topic)
            if matches:
                detected = matches[0][0]
                print(f"=== AUTO-DETECTED PATTERN: {detected} ({matches[0][1]:.0%} match) ===")
                print(f"Matched keywords: {', '.join(matches[0][2])}\n")
                pattern = TweetPattern(detected)
            else:
                print("=== NO PATTERN DETECTED, USING DEFAULT ===\n")
                pattern = TweetPattern.FIRE_PARALLEL
        else:
            pattern = TweetPattern(args.pattern) if hasattr(TweetPattern, args.pattern.upper()) else TweetPattern.FIRE_PARALLEL

        # Get emotion (from flag or auto-select from pattern)
        emotion = args.emotion if args.emotion else get_emotions(pattern.value)[0]

        # Get hook (from flag or auto-select from pattern)
        hook = args.hook if args.hook else get_best_hook(pattern.value)
        hook_config = HOOK_TEMPLATES.get(hook, HOOK_TEMPLATES["historical_reveal"])

        print(f"Emotion: {emotion} | Hook: {hook}")

        prompt = generator.generate_prompt(args.topic, pattern, emotion=emotion, hook_config=hook_config)
        if claude:
            print("=== CLAUDE RESPONSE ===")
            response = claude.generate(prompt)
            print(response)

            # Save to queue if --queue flag set
            if args.queue:
                draft_mgr = DraftManager()
                matcher = MediaMatcher()
                media_rec = matcher.get_media_recommendation(pattern.value)
                media_paths = [media_rec["primary_media"]] if media_rec["has_media"] else []

                draft_path = draft_mgr.save_draft(
                    english=response,
                    persian="",
                    pattern=pattern.value,
                    media=media_paths,
                    hashtags=[],
                    sources=[args.topic]
                )
                print(f"\n✅ Saved to queue: {draft_path}")
                if media_paths:
                    print(f"📷 Auto-attached media: {media_paths[0]}")
        else:
            print("=== CLAUDE PROMPT ===")
            print(prompt)

    elif args.command == "thread":
        prompt = generator.generate_thread_prompt(args.topic, args.length)
        if claude:
            print("=== CLAUDE RESPONSE ===")
            response = claude.generate(prompt)
            print(response)

            if args.queue:
                draft_mgr = DraftManager()
                draft_path = draft_mgr.save_draft(
                    english=response,
                    persian="",
                    pattern="thread",
                    media=[],
                    hashtags=[],
                    sources=[args.topic]
                )
                print(f"\n✅ Thread saved to queue: {draft_path}")
        else:
            print("=== CLAUDE PROMPT ===")
            print(prompt)

    elif args.command == "counter":
        prompt = generator.generate_counter_prompt(args.claim, args.source)
        if claude:
            print("=== CLAUDE RESPONSE ===")
            response = claude.generate(prompt)
            print(response)

            if args.queue:
                draft_mgr = DraftManager()
                draft_path = draft_mgr.save_draft(
                    english=response,
                    persian="",
                    pattern="counter_" + args.source,
                    media=[],
                    hashtags=[],
                    sources=[args.claim]
                )
                print(f"\n✅ Counter-narrative saved to queue: {draft_path}")
        else:
            print("=== CLAUDE PROMPT ===")
            print(prompt)

    elif args.command == "daily":
        developments = args.developments or ["No developments provided"]
        prompt = daily_gen.generate_daily_prompt(args.date, developments)
        if claude:
            print("=== CLAUDE RESPONSE ===")
            response = claude.generate(prompt)
            print(response)

            if args.queue:
                draft_mgr = DraftManager()
                draft_path = draft_mgr.save_draft(
                    english=response,
                    persian="",
                    pattern="daily_package",
                    media=[],
                    hashtags=[],
                    sources=developments[:3] if developments else []
                )
                print(f"\n✅ Daily package saved to queue: {draft_path}")
        else:
            print("=== CLAUDE PROMPT ===")
            print(prompt)

    elif args.command == "validate":
        prompt = validator.full_validation_prompt(args.tweet)
        if claude:
            print("=== VALIDATION RESULT ===")
            print(claude.generate(prompt))
        else:
            print("=== VALIDATION PROMPT ===")
            print(prompt)

    elif args.command == "lab":
        if args.test == "fact-check":
            prompt = validator.generate_fact_check_prompt(args.tweet, [])
        elif args.test == "voice":
            prompt = validator.generate_voice_check_prompt(args.tweet)
        elif args.test == "parallel":
            prompt = validator.generate_parallel_check_prompt(args.tweet, "")
        else:
            prompt = validator.full_validation_prompt(args.tweet)
        if claude:
            print(f"=== {args.test.upper()} RESULT ===")
            print(claude.generate(prompt))
        else:
            print(f"=== {args.test.upper()} PROMPT ===")
            print(prompt)

    elif args.command == "stats":
        stats = kb.get_stats()
        print("=== FAYTUKS KNOWLEDGE BASE ===")
        print("\n📚 CORE KNOWLEDGE:")
        print(f"  Facts: {stats['facts']}")
        print(f"  Actors: {stats['actors']}")
        print(f"  Narratives: {stats['narratives']} ({stats['active_narratives']} active)")
        print(f"  Quotes: {stats.get('quotes', 0)}")
        print(f"  Persian slogans: {stats.get('persian_slogans', 0)}")
        print(f"  Persian terms: {stats.get('persian_terms', 0)}")

        print("\n⚙️ OPERATIONAL KNOWLEDGE:")
        print(f"  Anniversaries: {stats.get('anniversaries', 0)}")
        print(f"  Sources tracked: {stats.get('sources_tracked', 0)}")
        print(f"  Thread templates: {stats.get('thread_templates', 0)}")
        print(f"  Platforms: {stats.get('platforms', 0)}")

        print("\n📝 CORPUS:")
        print(f"  Scraped tweets (@FaytuksNetwork): {stats.get('corpus_scraped', 0)}")
        print(f"  Sample generated tweets: {stats.get('corpus_samples', 0)}")

        print("\n🏷️ PRIMARY HASHTAGS (Tier 1):")
        for tag in templates.get_primary_hashtags()[:6]:
            print(f"  {tag.get('tag')}: {tag.get('usage', '')}")

        print("\n📖 PATTERNS:")
        patterns = kb.load_patterns_from_narratives()
        for pid, pdata in list(patterns.items())[:8]:
            print(f"  - {pid}: {pdata['title']}")
        if len(patterns) > 8:
            print(f"  ... and {len(patterns) - 8} more")

    elif args.command == "anniversary":
        ann_gen = AnniversaryGenerator(kb)
        if args.date:
            anniversary = ann_gen.get_anniversary(args.date)
            date_display = args.date
        else:
            anniversary = ann_gen.get_today_anniversary()
            date_display = datetime.now().strftime("%m-%d")
            print(f"=== ANNIVERSARIES FOR {datetime.now().strftime('%B %d')} ===")

        if not anniversary:
            print(f"No historical anniversaries found for {date_display}.")
        else:
            print(f"\n📅 {anniversary.get('year', 'N/A')}: {anniversary.get('event', 'N/A')}")
            print(f"   {anniversary.get('description', '')}")
            print(f"   Significance: {anniversary.get('significance', '')}")
            if anniversary.get('tweetAngle'):
                print(f"\n   💡 Tweet angle: {anniversary.get('tweetAngle')}")
            if anniversary.get('pattern'):
                print(f"   Pattern: {anniversary.get('pattern')}")
            if anniversary.get('hashtags'):
                print(f"   Hashtags: #{' #'.join(anniversary.get('hashtags', []))}")

            # Generate tweet if --execute
            if claude:
                prompt = ann_gen.generate_prompt(anniversary, args.context if hasattr(args, 'context') else None)
                print("\n=== GENERATED ANNIVERSARY TWEET ===")
                print(claude.generate(prompt))
            elif hasattr(args, 'execute') and args.execute:
                print("\n=== ANNIVERSARY TWEET PROMPT ===")
                prompt = ann_gen.generate_prompt(anniversary, args.context if hasattr(args, 'context') else None)
                print(prompt)

    elif args.command == "memorial":
        memorial_gen = VictimMemorialGenerator(kb)

        if args.list:
            victims = memorial_gen.get_victims(verified_only=True)
            print(f"=== VERIFIED VICTIMS ({len(victims)}) ===")
            for v in victims:
                age_str = f", {v.get('age')}" if v.get('age') else ""
                print(f"\n  {v.get('name')} ({v.get('persianName', 'N/A')}){age_str}")
                print(f"    {v.get('city')} - {v.get('date_of_death')}")
                print(f"    {v.get('circumstances', '')[:80]}...")
        elif args.random:
            victim = memorial_gen.get_random_victim()
            if victim:
                print(f"=== MEMORIAL: {victim.get('name')} ===")
                print(f"Persian: {victim.get('persianName', 'N/A')}")
                print(f"Age: {victim.get('age', 'Unknown')}")
                print(f"City: {victim.get('city')}, {victim.get('province', '')}")
                print(f"Date: {victim.get('date_of_death')}")
                print(f"Circumstances: {victim.get('circumstances')}")
                print(f"Source: {victim.get('source')}")
                if victim.get('tweet_angles'):
                    print(f"\nExisting angles:")
                    for angle in victim.get('tweet_angles', []):
                        print(f"  - {angle}")

                if claude:
                    prompt = memorial_gen.generate_prompt(victim)
                    print("\n=== GENERATED MEMORIAL TWEET ===")
                    print(claude.generate(prompt))
                elif hasattr(args, 'execute') and args.execute:
                    print("\n=== MEMORIAL TWEET PROMPT ===")
                    prompt = memorial_gen.generate_prompt(victim)
                    print(prompt)
            else:
                print("No verified victims found in database.")
        elif args.name:
            victim = memorial_gen.get_victim_by_name(args.name)
            if victim:
                print(f"=== MEMORIAL: {victim.get('name')} ===")
                print(f"Persian: {victim.get('persianName', 'N/A')}")
                print(f"Age: {victim.get('age', 'Unknown')}")
                print(f"City: {victim.get('city')}, {victim.get('province', '')}")
                print(f"Date: {victim.get('date_of_death')}")
                print(f"Circumstances: {victim.get('circumstances')}")

                if claude:
                    prompt = memorial_gen.generate_prompt(victim)
                    print("\n=== GENERATED MEMORIAL TWEET ===")
                    print(claude.generate(prompt))
                elif hasattr(args, 'execute') and args.execute:
                    print("\n=== MEMORIAL TWEET PROMPT ===")
                    prompt = memorial_gen.generate_prompt(victim)
                    print(prompt)
            else:
                print(f"Victim '{args.name}' not found. Use --list to see all victims.")
        else:
            print("Usage: memorial --random | --name NAME | --list")
            print("Add --execute to generate tweet with Claude API")

    elif args.command == "source":
        source_info = kb.get_source_tier(args.name)
        if source_info:
            tier = source_info.get('tier', 'N/A')
            tier_emoji = {1: '🟢', 2: '🟡', 3: '🟠', 4: '🔴'}.get(tier, '⚪')
            tier_defs = kb.get_tier_definitions()
            tier_key = f"tier_{tier}"
            tier_name = tier_defs.get(tier_key, {}).get('name', f'Tier {tier}')

            print(f"=== SOURCE CREDIBILITY: {source_info.get('name', args.name)} ===")
            print(f"\n{tier_emoji} Tier {tier}: {tier_name}")
            print(f"Category: {source_info.get('category', 'N/A')}")
            if source_info.get('website'):
                print(f"Website: {source_info['website']}")
            if source_info.get('twitter'):
                print(f"Twitter: {source_info['twitter']}")
            if source_info.get('notes'):
                print(f"\nNotes: {source_info['notes']}")
            if source_info.get('strengths'):
                print(f"\nStrengths: {', '.join(source_info['strengths'])}")
            if source_info.get('weaknesses'):
                print(f"Weaknesses: {', '.join(source_info['weaknesses'])}")
            if source_info.get('use_for'):
                use_for = source_info['use_for']
                if isinstance(use_for, list):
                    print(f"Use for: {', '.join(use_for)}")
                else:
                    print(f"Use for: {use_for}")
        else:
            print(f"Source '{args.name}' not found in credibility database.")
            print("\nTry searching for: IHRNGO, BBC, Iran International, Hengaw, etc.")

    elif args.command == "hashtags":
        strategy = templates.get_hashtags_for_content_type(args.type)
        if strategy:
            print(f"=== HASHTAGS FOR: {args.type} ===")
            print(f"\nRecommended: {strategy.get('recommended', 'N/A')}")
            print(f"Example: {strategy.get('example', 'N/A')}")
        else:
            print(f"No hashtag strategy found for content type: {args.type}")

        print("\n=== PRIMARY HASHTAGS (use frequently) ===")
        for tag in templates.get_primary_hashtags():
            print(f"  {tag.get('tag')}: {tag.get('usage')}")

    elif args.command == "corpus":
        if args.scraped:
            tweets = kb.get_corpus_scraped()[:args.limit]
            print(f"=== SCRAPED TWEETS (@FaytuksNetwork) ===")
            for i, tweet in enumerate(tweets, 1):
                print(f"\n{i}. [{tweet.get('date', 'N/A')[:10]}]")
                print(f"   {tweet.get('text', '')[:200]}...")
        else:
            if args.pattern:
                tweets = kb.get_corpus_by_pattern(args.pattern)[:args.limit]
                print(f"=== SAMPLE TWEETS: {args.pattern} ===")
            else:
                tweets = kb.get_corpus_samples()[:args.limit]
                print(f"=== SAMPLE GENERATED TWEETS ===")
            for i, tweet in enumerate(tweets, 1):
                print(f"\n{i}. Pattern: {tweet.get('pattern', 'N/A')}")
                print(f"   {tweet.get('tweet', '')[:200]}")
                if tweet.get('sources'):
                    print(f"   Sources: {', '.join(tweet.get('sources', []))}")

    elif args.command == "media":
        matcher = MediaMatcher()
        patterns_to_check = list(MediaMatcher.PATTERN_MEDIA_DIRS.keys()) if args.all else [args.pattern] if args.pattern else []

        if not patterns_to_check:
            print("Usage: python faytuks_engine.py media --pattern fire_parallel")
            print("       python faytuks_engine.py media --all")
            print(f"\nAvailable patterns: {', '.join(MediaMatcher.PATTERN_MEDIA_DIRS.keys())}")
        else:
            print("=== MEDIA AVAILABILITY ===\n")
            for pattern in patterns_to_check:
                result = matcher.get_media_recommendation(pattern)
                status = "✅" if result["has_media"] else "❌"
                print(f"{status} {pattern}:")
                if result["has_media"]:
                    print(f"   Primary: {result['primary_media']}")
                    print(f"   Available: {len(result['all_available'])} files")
                else:
                    print(f"   No media found")
                    if args.acquire and result["acquisition_command"]:
                        print(f"   Acquire: {result['acquisition_command']}")
                print()

    elif args.command == "draft":
        draft_mgr = DraftManager()

        if args.stats:
            # Queue statistics
            pending = list((DRAFTS_DIR / "pending").glob("*.json"))
            approved = list((DRAFTS_DIR / "approved").glob("*.json"))
            posted = list((DRAFTS_DIR / "posted").glob("*.json"))

            print("=== QUEUE STATISTICS ===\n")
            print(f"📋 Pending:  {len(pending)}")
            print(f"✅ Approved: {len(approved)}")
            print(f"📤 Posted:   {len(posted)}")
            print(f"\n📊 Total:    {len(pending) + len(approved) + len(posted)}")

            # Pattern breakdown
            if posted:
                patterns = {}
                for f in posted:
                    with open(f, 'r', encoding='utf-8') as file:
                        d = json.load(file)
                        p = d.get('pattern', 'unknown')
                        patterns[p] = patterns.get(p, 0) + 1
                print("\n📖 Posted by pattern:")
                for p, count in sorted(patterns.items(), key=lambda x: -x[1]):
                    print(f"   {p}: {count}")

        elif args.list:
            drafts = draft_mgr.list_pending()
            print(f"=== PENDING DRAFTS ({len(drafts)}) ===\n")
            for d in drafts:
                media_status = f"📷 {len(d.get('media', []))} media" if d.get('media') else "No media"
                print(f"ID: {d['id']} | {d.get('pattern', 'N/A')} | {media_status}")
                print(f"   EN: {d.get('english', '')[:80]}...")
                print()

        elif args.approved:
            approved_files = list((DRAFTS_DIR / "approved").glob("*.json"))
            print(f"=== APPROVED DRAFTS ({len(approved_files)}) ===\n")
            for f in approved_files:
                with open(f, 'r', encoding='utf-8') as file:
                    d = json.load(file)
                media_status = f"📷 {len(d.get('media', []))} media" if d.get('media') else "No media"
                print(f"ID: {d['id']} | {d.get('pattern', 'N/A')} | {media_status}")
                print(f"   EN: {d.get('english', '')[:80]}...")
                print()

        elif getattr(args, 'posted_list', False):
            posted_files = list((DRAFTS_DIR / "posted").glob("*.json"))
            print(f"=== POSTED DRAFTS ({len(posted_files)}) ===\n")
            for f in posted_files:
                with open(f, 'r', encoding='utf-8') as file:
                    d = json.load(file)
                posted_at = d.get('posted_at', 'N/A')[:10] if d.get('posted_at') else 'N/A'
                print(f"ID: {d['id']} | Posted: {posted_at}")
                print(f"   EN: {d.get('english', '')[:80]}...")
                if d.get('tweet_id'):
                    print(f"   URL: https://x.com/FaytuksNetwork/status/{d['tweet_id']}")
                print()

        elif args.preview:
            # Find draft by ID
            draft = None
            for folder in [DRAFTS_DIR / "pending", DRAFTS_DIR / "approved"]:
                for f in folder.glob(f"*{args.preview}*.json"):
                    with open(f, 'r', encoding='utf-8') as file:
                        draft = json.load(file)
                    break
            if draft:
                print(f"=== DRAFT PREVIEW: {draft['id']} ===\n")
                print(f"Pattern: {draft.get('pattern', 'N/A')}")
                print(f"Created: {draft.get('created_at', 'N/A')}")
                print(f"Status: {draft.get('status', 'N/A')}")
                print(f"\n--- ENGLISH ---\n{draft.get('english', '')}")
                if draft.get('persian'):
                    print(f"\n--- PERSIAN ---\n{draft.get('persian', '')}")
                print(f"\n--- MEDIA ---")
                if draft.get('media'):
                    for m in draft['media']:
                        exists = "✅" if (MEDIA_DIR / m).exists() else "❌"
                        print(f"  {exists} {m}")
                else:
                    # Suggest media based on pattern
                    matcher = MediaMatcher()
                    rec = matcher.get_media_recommendation(draft.get('pattern', ''))
                    if rec["has_media"]:
                        print(f"  💡 Suggested: {rec['primary_media']}")
                        print(f"     Attach with: draft --attach {draft['id']} {rec['primary_media']}")
                    else:
                        print("  No media attached")
            else:
                print(f"Draft '{args.preview}' not found")

        elif args.attach:
            draft_id, media_path = args.attach
            # Find and update draft
            updated = False
            for folder in [DRAFTS_DIR / "pending", DRAFTS_DIR / "approved"]:
                for f in folder.glob(f"*{draft_id}*.json"):
                    with open(f, 'r', encoding='utf-8') as file:
                        draft = json.load(file)
                    draft['media'] = draft.get('media', []) + [media_path]
                    with open(f, 'w', encoding='utf-8') as file:
                        json.dump(draft, file, indent=2, ensure_ascii=False)
                    print(f"✅ Attached {media_path} to draft {draft_id}")
                    updated = True
                    break
            if not updated:
                print(f"❌ Draft {draft_id} not found")

        elif args.reject:
            # Delete draft
            deleted = False
            for folder in [DRAFTS_DIR / "pending", DRAFTS_DIR / "approved"]:
                for f in folder.glob(f"*{args.reject}*.json"):
                    f.unlink()
                    print(f"✅ Draft {args.reject} deleted")
                    deleted = True
                    break
            if not deleted:
                print(f"❌ Draft {args.reject} not found")

        elif args.save:
            if not args.english:
                print("Error: --english is required for --save")
            else:
                # Auto-match media if pattern provided
                media_paths = args.media or []
                if args.pattern and not media_paths:
                    matcher = MediaMatcher()
                    rec = matcher.get_media_recommendation(args.pattern)
                    if rec["has_media"]:
                        media_paths = [rec["primary_media"]]
                        print(f"Auto-attached media: {rec['primary_media']}")

                path = draft_mgr.save_draft(
                    english=args.english,
                    persian=args.persian or "",
                    pattern=args.pattern or "unknown",
                    media=media_paths,
                    hashtags=[]
                )
                print(f"✅ Draft saved: {path}")

        elif args.approve:
            if draft_mgr.approve_draft(args.approve):
                print(f"✅ Draft {args.approve} approved and moved to approved/")
            else:
                print(f"❌ Draft {args.approve} not found in pending/")

        else:
            print("Usage: python faytuks_engine.py draft --list [--approved|--posted-list]")
            print("       python faytuks_engine.py draft --preview <draft_id>")
            print("       python faytuks_engine.py draft --save --english 'text' --pattern fire_parallel")
            print("       python faytuks_engine.py draft --attach <draft_id> <media_path>")
            print("       python faytuks_engine.py draft --approve <draft_id>")
            print("       python faytuks_engine.py draft --reject <draft_id>")
            print("       python faytuks_engine.py draft --stats")

    elif args.command == "post":
        import subprocess

        # Find draft to post
        draft = None
        draft_file = None
        if args.draft:
            for f in (DRAFTS_DIR / "approved").glob(f"*{args.draft}*.json"):
                with open(f, 'r', encoding='utf-8') as file:
                    draft = json.load(file)
                draft_file = f
                break
        elif args.next:
            approved = list((DRAFTS_DIR / "approved").glob("*.json"))
            if approved:
                draft_file = approved[0]
                with open(draft_file, 'r', encoding='utf-8') as f:
                    draft = json.load(f)

        if not draft:
            approved_count = len(list((DRAFTS_DIR / "approved").glob("*.json")))
            pending_count = len(list((DRAFTS_DIR / "pending").glob("*.json")))
            print(f"📋 Queue: {pending_count} pending | {approved_count} approved")
            if approved_count == 0 and pending_count > 0:
                print("\n💡 Approve a draft first: draft --approve <id>")
            print("\nUsage:")
            print("  python faytuks_engine.py post --next              # Get next approved draft")
            print("  python faytuks_engine.py post --draft ID          # Post specific draft")
            print("  python faytuks_engine.py post --draft ID --clipboard  # Copy to clipboard")
        else:
            tweet_text = draft.get('english', '')

            if args.clipboard:
                # Copy to clipboard using pbcopy (macOS)
                try:
                    process = subprocess.Popen(['pbcopy'], stdin=subprocess.PIPE)
                    process.communicate(tweet_text.encode('utf-8'))
                    print("✅ Tweet copied to clipboard!\n")
                except Exception as e:
                    print(f"❌ Clipboard error: {e}")
                    print(f"\n--- COPY THIS ---\n{tweet_text}\n--- END ---\n")

                print(f"📝 Draft: {draft['id']}")
                print(f"📊 Pattern: {draft.get('pattern', 'N/A')}")
                print(f"📏 Length: {len(tweet_text)} chars")

                if draft.get('media'):
                    print(f"\n📷 Media to attach:")
                    for m in draft['media']:
                        full_path = MEDIA_DIR / m
                        if full_path.exists():
                            print(f"   {full_path}")
                        else:
                            print(f"   ❌ {full_path} (NOT FOUND)")

                print(f"\n📋 Next steps:")
                print(f"   1. Open https://x.com/compose/tweet")
                print(f"   2. Paste (Cmd+V)")
                if draft.get('media'):
                    print(f"   3. Attach media file(s) above")
                    print(f"   4. Post")
                else:
                    print(f"   3. Post")
                print(f"\n✅ After posting, confirm with:")
                print(f"   python faytuks_engine.py posted confirm {draft['id']} --url <tweet_url>")
            else:
                # Full posting workflow instructions
                print("=" * 60)
                print("POSTING WORKFLOW (use with: claude --chrome)")
                print("=" * 60)
                print(f"\n📝 DRAFT ID: {draft['id']}")
                print(f"📊 PATTERN: {draft.get('pattern', 'N/A')}")
                print(f"\n--- ENGLISH ---")
                print(tweet_text)
                if draft.get('persian'):
                    print(f"\n--- PERSIAN ---")
                    print(draft.get('persian', ''))

                if draft.get('media'):
                    print(f"\n📷 MEDIA TO ATTACH:")
                    for m in draft['media']:
                        full_path = MEDIA_DIR / m
                        exists = "✅" if full_path.exists() else "❌ NOT FOUND"
                        print(f"   {exists} {full_path}")

                print("\n" + "=" * 60)
                print("INSTRUCTIONS FOR claude --chrome:")
                print("=" * 60)
                print("1. Navigate to https://x.com/compose/tweet")
                print("2. Click the compose textarea")
                print("3. Type or paste the English text")
                if draft.get('media'):
                    print("4. Click photo icon and attach media file(s)")
                    print("5. Click Post button")
                else:
                    print("4. Click Post button")
                print(f"\nAfter posting, confirm with:")
                print(f"  python faytuks_engine.py posted confirm {draft['id']} --url <tweet_url>")
                print("=" * 60)

    elif args.command == "queue":
        # Alias for draft command with positional args
        draft_mgr = DraftManager()

        if args.action == "list":
            if args.approved:
                approved_files = list((DRAFTS_DIR / "approved").glob("*.json"))
                print(f"=== APPROVED ({len(approved_files)}) ===\n")
                for f in approved_files:
                    with open(f, 'r', encoding='utf-8') as file:
                        d = json.load(file)
                    print(f"{d['id']} | {d.get('pattern', 'N/A')}")
            elif args.posted:
                posted_files = list((DRAFTS_DIR / "posted").glob("*.json"))
                print(f"=== POSTED ({len(posted_files)}) ===\n")
                for f in posted_files:
                    with open(f, 'r', encoding='utf-8') as file:
                        d = json.load(file)
                    print(f"{d['id']} | Posted: {d.get('posted_at', 'N/A')[:10] if d.get('posted_at') else 'N/A'}")
            else:
                drafts = draft_mgr.list_pending()
                print(f"=== PENDING ({len(drafts)}) ===\n")
                for d in drafts:
                    media = "📷" if d.get('media') else ""
                    print(f"{d['id']} | {d.get('pattern', 'N/A')} {media}")
                    print(f"  {d.get('english', '')[:60]}...")
                    print()

        elif args.action == "preview" and args.id:
            draft = None
            for folder in [DRAFTS_DIR / "pending", DRAFTS_DIR / "approved"]:
                for f in folder.glob(f"*{args.id}*.json"):
                    with open(f, 'r', encoding='utf-8') as file:
                        draft = json.load(file)
                    break
            if draft:
                print(f"=== {draft['id']} ===\n")
                print(draft.get('english', ''))
                if draft.get('media'):
                    print(f"\n📷 {draft['media']}")
            else:
                print(f"Draft {args.id} not found")

        elif args.action == "approve" and args.id:
            if draft_mgr.approve_draft(args.id):
                print(f"✅ {args.id} approved")
            else:
                print(f"❌ {args.id} not found")

        elif args.action == "attach" and args.id and args.path:
            for folder in [DRAFTS_DIR / "pending", DRAFTS_DIR / "approved"]:
                for f in folder.glob(f"*{args.id}*.json"):
                    with open(f, 'r', encoding='utf-8') as file:
                        draft = json.load(file)
                    draft['media'] = draft.get('media', []) + [args.path]
                    with open(f, 'w', encoding='utf-8') as file:
                        json.dump(draft, file, indent=2, ensure_ascii=False)
                    print(f"✅ Attached {args.path}")
                    break

        elif args.action == "reject" and args.id:
            for folder in [DRAFTS_DIR / "pending", DRAFTS_DIR / "approved"]:
                for f in folder.glob(f"*{args.id}*.json"):
                    f.unlink()
                    print(f"✅ {args.id} deleted")
                    break

        elif args.action == "stats":
            pending = len(list((DRAFTS_DIR / "pending").glob("*.json")))
            approved = len(list((DRAFTS_DIR / "approved").glob("*.json")))
            posted = len(list((DRAFTS_DIR / "posted").glob("*.json")))
            print(f"📋 Pending: {pending} | ✅ Approved: {approved} | 📤 Posted: {posted}")

        else:
            print("Usage: queue list [--approved|--posted]")
            print("       queue preview <id>")
            print("       queue approve <id>")
            print("       queue attach <id> <path>")
            print("       queue reject <id>")
            print("       queue stats")

    elif args.command == "posted":
        # Handle posted command
        if args.action == "confirm" and args.id:
            draft_mgr = DraftManager()
            tweet_url = args.url if hasattr(args, 'url') else None
            # Extract tweet ID from URL if provided
            tweet_id = None
            if tweet_url and '/status/' in tweet_url:
                tweet_id = tweet_url.split('/status/')[-1].split('?')[0]
            if draft_mgr.mark_posted(args.id, tweet_id=tweet_id):
                print(f"✅ {args.id} marked as posted")
                if tweet_url:
                    print(f"   URL: {tweet_url}")
            else:
                print(f"❌ {args.id} not found in approved/")

        elif args.action == "list":
            posted_files = list((DRAFTS_DIR / "posted").glob("*.json"))
            print(f"=== POSTED TWEETS ({len(posted_files)}) ===\n")
            for f in sorted(posted_files, key=lambda x: x.stat().st_mtime, reverse=True):
                with open(f, 'r', encoding='utf-8') as file:
                    d = json.load(file)
                posted_at = d.get('posted_at', '')[:10] if d.get('posted_at') else 'N/A'
                print(f"{d['id']} | {posted_at} | {d.get('pattern', 'N/A')}")
                if d.get('tweet_id'):
                    print(f"  https://x.com/FaytuksNetwork/status/{d['tweet_id']}")
                print()

        elif args.action == "stats":
            posted_files = list((DRAFTS_DIR / "posted").glob("*.json"))
            patterns = {}
            for f in posted_files:
                with open(f, 'r', encoding='utf-8') as file:
                    d = json.load(file)
                p = d.get('pattern', 'unknown')
                patterns[p] = patterns.get(p, 0) + 1

            print(f"=== POSTING STATS ===\n")
            print(f"Total posted: {len(posted_files)}")
            print(f"\nBy pattern:")
            for p, count in sorted(patterns.items(), key=lambda x: -x[1]):
                print(f"  {p}: {count}")

        else:
            print("Usage: posted confirm <id> --url <tweet_url>")
            print("       posted list")
            print("       posted stats")

    elif args.command == "refresh":
        # Refresh drafts from bucket tweets
        daemon = FaytuksDaemon(kb)
        enricher = TweetEnricher(kb)

        print("=== REFRESHING FROM BUCKETS ===\n")

        # Breaking: use CLI arg (default 0.17 = ~10 mins), auto-approve, bilingual
        breaking_hours = getattr(args, 'breaking_hours', 0.17)
        breaking = daemon.scrape_recent_tweets("breaking", max_age_hours=breaking_hours)

        # Commentary & Geopolitics: < 24 hours - drafts only
        other_hours = getattr(args, 'other_hours', 24)
        commentary = daemon.scrape_recent_tweets("commentary", max_age_hours=other_hours)
        geopolitics = daemon.scrape_recent_tweets("geopolitics", max_age_hours=other_hours)

        breaking_mins = int(breaking_hours * 60)
        print(f"Breaking (< {breaking_mins} min):     {len(breaking)} tweets → AUTO-APPROVE")
        print(f"Commentary (< {other_hours}h):    {len(commentary)} tweets → drafts")
        print(f"Geopolitics (< {other_hours}h):   {len(geopolitics)} tweets → drafts")

        created_breaking = 0
        created_drafts = 0

        # Process breaking tweets - immediate posting (BILINGUAL)
        for tweet in breaking[:5]:
            english_text = tweet.get('text', '')
            pattern = enricher.detect_pattern(english_text)

            # Translate to Persian if Claude is available
            persian_text = ""
            if claude:
                try:
                    persian_text = enricher.translate_to_persian(english_text, claude)
                    print(f"  🔄 Translated to Persian ({len(persian_text)} chars)")
                except Exception as e:
                    print(f"  ⚠️ Translation failed: {e}")

            draft_id = datetime.now().strftime("%Y%m%d_%H%M%S")

            path = daemon.draft_mgr.save_draft(
                english=english_text,
                persian=persian_text,
                pattern=pattern or "breaking",
                sources=[f"@{tweet.get('handle', '')}", "breaking"]
            )

            # Auto-approve breaking tweets
            daemon.draft_mgr.approve_draft(draft_id)
            created_breaking += 1
            lang_status = "EN+FA" if persian_text else "EN only"
            print(f"  ⚡ BREAKING [{lang_status}]: @{tweet.get('handle', '')} → approved")

        # Process other buckets as regular drafts
        for tweet in (commentary + geopolitics)[:10]:
            pattern = enricher.detect_pattern(tweet.get('text', ''))

            path = daemon.draft_mgr.save_draft(
                english=tweet.get('text', ''),
                persian="",
                pattern=pattern or "general",
                sources=[f"@{tweet.get('handle', '')}", tweet.get('bucket', '')]
            )
            created_drafts += 1

        print(f"\n✅ Created: {created_breaking} breaking (auto-approved), {created_drafts} drafts")

        # Show queue status
        pending = len(list((DRAFTS_DIR / "pending").glob("*.json")))
        approved = len(list((DRAFTS_DIR / "approved").glob("*.json")))
        print(f"📋 Queue: {pending} pending | {approved} approved (ready to post)")

    elif args.command == "enrich":
        # Enrich a draft with historical parallels
        enricher = TweetEnricher(kb)

        # Find draft
        draft = None
        for folder in [DRAFTS_DIR / "pending", DRAFTS_DIR / "approved"]:
            for f in folder.glob(f"*{args.draft}*.json"):
                with open(f, 'r', encoding='utf-8') as file:
                    draft = json.load(file)
                draft_path = f
                break

        if not draft:
            print(f"Draft '{args.draft}' not found")
        else:
            print(f"=== ENRICHING: {draft.get('id', args.draft)} ===\n")

            # Detect pattern
            pattern = enricher.detect_pattern(draft.get('english', ''))
            print(f"Detected pattern: {pattern or 'none'}")

            # Get historical context
            context = enricher.get_historical_context(pattern or 'massacre_escalation')
            print(f"\nRelevant facts: {len(context.get('facts', []))}")
            for fact in context.get('facts', [])[:3]:
                print(f"  - {fact.get('fact', '')[:80]}...")

            if context.get('era'):
                print(f"\nHistorical era: {context['era'].get('name', 'N/A')}")

            if claude:
                prompt = enricher.generate_enrichment_prompt(draft.get('english', ''), context)
                print("\n=== SUPPLEMENTAL TWEET ===")
                response = claude.generate(prompt)
                print(response)

                # Save enrichment to draft
                draft['supplemental_tweet'] = response
                draft['enriched_at'] = datetime.now().isoformat()
                with open(draft_path, 'w', encoding='utf-8') as file:
                    json.dump(draft, file, indent=2, ensure_ascii=False)
                print(f"\n✅ Enrichment saved to draft")
            else:
                print("\n(Add --execute to generate supplemental tweet with Claude)")

    elif args.command == "daemon":
        import time

        daemon = FaytuksDaemon(kb)
        interval = args.interval

        print("=" * 60)
        print("FAYTUKS CONTINUOUS DAEMON")
        print("=" * 60)
        print(f"\nInterval: {interval} seconds ({interval/60:.1f} minutes)")
        print(f"Claude enrichment: {'enabled' if claude else 'disabled'}")
        print("\nPress Ctrl+C to stop\n")

        cycle = 0
        while True:
            cycle += 1
            print(f"\n--- Cycle {cycle} at {datetime.now().strftime('%H:%M:%S')} ---")

            try:
                results = daemon.run_cycle(claude)
                print(f"Created: {len(results.get('drafts_created', []))} drafts")
                if results.get('errors'):
                    print(f"Errors: {results['errors']}")

                # Show queue status
                pending = len(list((DRAFTS_DIR / "pending").glob("*.json")))
                approved = len(list((DRAFTS_DIR / "approved").glob("*.json")))
                print(f"Queue: {pending} pending | {approved} approved")

            except Exception as e:
                print(f"Error: {e}")

            print(f"Sleeping {interval}s...")
            time.sleep(interval)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()