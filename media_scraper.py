#!/usr/bin/env python3
"""
Faytuks Media Scraper
Automated image and video collection using agent-browser.

Usage:
    python media_scraper.py search --topic "Treaty of Turkmenchay 1828"
    python media_scraper.py twitter --query "Rasht protest"
    python media_scraper.py batch --config topics.json
    python media_scraper.py organize --source /downloads
"""

import json
import os
import subprocess
import hashlib
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass, field
import urllib.parse
import time

# Configuration
CONFIG = {
    "media_root": Path("media"),
    "downloads_temp": Path("media/_temp"),
    "metadata_file": Path("media/metadata.json"),
    "agent_browser": "agent-browser",
    "default_session": "faytuks_scraper",
    "max_images_per_query": 20,
    "delay_between_actions": 1.5,  # seconds
    "supported_formats": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov"]
}

@dataclass
class MediaItem:
    """Represents a downloaded media item."""
    id: str
    filename: str
    source_url: str
    source_type: str  # google_images, twitter, news_article, archive
    download_date: str
    category: str
    subcategory: str
    tags: List[str]
    description: str
    date_depicted: Optional[str] = None
    location_depicted: Optional[str] = None
    attribution: Optional[str] = None
    license: Optional[str] = None
    original_tweet_id: Optional[str] = None
    original_author: Optional[str] = None
    verified: bool = False
    quality_rating: int = 3
    local_path: Optional[str] = None

class AgentBrowserClient:
    """Wrapper for agent-browser CLI commands."""
    
    def __init__(self, session: str = CONFIG["default_session"]):
        self.session = session
        self._ensure_browser_ready()
    
    def _run(self, *args, json_output: bool = False) -> str:
        """Run agent-browser command."""
        cmd = [CONFIG["agent_browser"]]
        if json_output:
            cmd.append("--json")
        cmd.extend(args)

        # Use environment variable for session instead of --session flag
        env = os.environ.copy()
        env["AGENT_BROWSER_SESSION"] = self.session

        result = subprocess.run(cmd, capture_output=True, text=True, env=env)
        if result.returncode != 0:
            print(f"Error: {result.stderr}")
        return result.stdout
    
    def _ensure_browser_ready(self):
        """Make sure browser is installed."""
        subprocess.run([CONFIG["agent_browser"], "install"], capture_output=True)
    
    def open(self, url: str, headed: bool = False) -> str:
        """Navigate to URL."""
        args = ["open", url]
        if headed:
            args.append("--headed")
        return self._run(*args)
    
    def snapshot(self, interactive_only: bool = True, compact: bool = True) -> str:
        """Get page accessibility tree."""
        args = ["snapshot"]
        if interactive_only:
            args.append("-i")
        if compact:
            args.append("-c")
        return self._run(*args, json_output=True)
    
    def click(self, selector: str) -> str:
        """Click element."""
        return self._run("click", selector)
    
    def fill(self, selector: str, text: str) -> str:
        """Fill input field."""
        return self._run("fill", selector, text)
    
    def press(self, key: str) -> str:
        """Press key."""
        return self._run("press", key)
    
    def screenshot(self, path: str, full_page: bool = False) -> str:
        """Take screenshot."""
        args = ["screenshot", path]
        if full_page:
            args.append("--full")
        return self._run(*args)
    
    def get_text(self, selector: str) -> str:
        """Get element text."""
        return self._run("get", "text", selector)
    
    def get_attr(self, selector: str, attr: str) -> str:
        """Get element attribute."""
        return self._run("get", "attr", selector, attr)
    
    def wait(self, selector_or_ms: str) -> str:
        """Wait for element or time."""
        return self._run("wait", selector_or_ms)
    
    def scroll(self, direction: str, pixels: int = 500) -> str:
        """Scroll page."""
        return self._run("scroll", direction, str(pixels))
    
    def eval_js(self, script: str) -> str:
        """Execute JavaScript."""
        return self._run("eval", script)
    
    def close(self) -> str:
        """Close browser."""
        return self._run("close")


class GoogleImageScraper:
    """Scrape images from Google Images."""
    
    def __init__(self, browser: AgentBrowserClient):
        self.browser = browser
        self.base_url = "https://www.google.com/search?tbm=isch&q="
    
    def search(self, query: str, max_images: int = 10) -> List[Dict]:
        """Search Google Images and return image URLs."""
        encoded_query = urllib.parse.quote(query)
        url = f"{self.base_url}{encoded_query}"
        
        print(f"Searching Google Images: {query}")
        self.browser.open(url)
        time.sleep(2)
        
        images = []
        
        # Get snapshot to find image elements
        snapshot = self.browser.snapshot()
        
        # Scroll to load more images
        for _ in range(3):
            self.browser.scroll("down", 1000)
            time.sleep(1)
        
        # Extract image URLs using JavaScript
        js_script = """
        Array.from(document.querySelectorAll('img[data-src]')).slice(0, %d).map(img => ({
            src: img.dataset.src || img.src,
            alt: img.alt || ''
        }))
        """ % max_images
        
        result = self.browser.eval_js(js_script)
        
        # Parse results
        try:
            # The result might need parsing depending on agent-browser output format
            # This is a simplified version
            print(f"Found potential images for: {query}")
        except Exception as e:
            print(f"Error parsing results: {e}")
        
        return images
    
    def download_from_search(self, query: str, category: str, 
                             subcategory: str, max_images: int = 10) -> List[MediaItem]:
        """Search and download images."""
        # Navigate to Google Images
        encoded_query = urllib.parse.quote(query)
        url = f"{self.base_url}{encoded_query}"
        
        print(f"Opening Google Images for: {query}")
        self.browser.open(url)
        time.sleep(3)
        
        downloaded = []
        
        # Click on images and get high-res versions
        # This requires interacting with Google's image viewer
        
        # Get snapshot
        snapshot_output = self.browser.snapshot(interactive_only=True)
        
        # Find image refs from snapshot
        # Pattern: look for refs that are images
        
        print(f"Processing search results for: {query}")
        print("Note: Full implementation requires parsing snapshot refs and clicking through images")
        
        return downloaded


class TwitterScraper:
    """Scrape images and videos from Twitter/X."""
    
    def __init__(self, browser: AgentBrowserClient):
        self.browser = browser
    
    def search_and_download(self, query: str, category: str,
                           subcategory: str, max_items: int = 20) -> List[MediaItem]:
        """Search Twitter and download media."""
        encoded_query = urllib.parse.quote(query)
        url = f"https://twitter.com/search?q={encoded_query}&src=typed_query&f=image"
        
        print(f"Searching Twitter for: {query}")
        self.browser.open(url)
        time.sleep(3)
        
        downloaded = []
        
        # Scroll to load tweets
        for _ in range(5):
            self.browser.scroll("down", 800)
            time.sleep(2)
        
        # Get snapshot
        snapshot = self.browser.snapshot()
        
        # Extract image URLs from tweets
        # Twitter stores images in specific patterns
        js_script = """
        Array.from(document.querySelectorAll('img[src*="pbs.twimg.com/media"]')).map(img => ({
            src: img.src.replace('name=small', 'name=large'),
            alt: img.alt || '',
            tweet: img.closest('article')?.querySelector('a[href*="/status/"]')?.href || ''
        }))
        """
        
        result = self.browser.eval_js(js_script)
        print(f"Found Twitter media for: {query}")
        
        return downloaded
    
    def download_from_tweet(self, tweet_url: str, category: str,
                           subcategory: str) -> List[MediaItem]:
        """Download all media from a specific tweet."""
        print(f"Opening tweet: {tweet_url}")
        self.browser.open(tweet_url)
        time.sleep(3)
        
        downloaded = []
        
        # Get tweet author and content
        snapshot = self.browser.snapshot()
        
        # Extract media URLs
        js_script = """
        {
            images: Array.from(document.querySelectorAll('img[src*="pbs.twimg.com/media"]')).map(i => i.src.replace('name=small', 'name=large')),
            videos: Array.from(document.querySelectorAll('video source')).map(v => v.src),
            author: document.querySelector('[data-testid="User-Name"]')?.textContent || '',
            text: document.querySelector('[data-testid="tweetText"]')?.textContent || ''
        }
        """
        
        result = self.browser.eval_js(js_script)
        print(f"Extracted media from tweet: {tweet_url}")
        
        return downloaded


class MediaOrganizer:
    """Organize and catalog downloaded media."""
    
    def __init__(self, media_root: Path = CONFIG["media_root"]):
        self.media_root = media_root
        self.metadata_file = CONFIG["metadata_file"]
        self.metadata = self._load_metadata()
    
    def _load_metadata(self) -> Dict:
        """Load existing metadata."""
        if self.metadata_file.exists():
            with open(self.metadata_file, 'r') as f:
                return json.load(f)
        return {"items": [], "index": {}}
    
    def _save_metadata(self):
        """Save metadata to file."""
        self.metadata_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.metadata_file, 'w') as f:
            json.dump(self.metadata, f, indent=2, ensure_ascii=False)
    
    def generate_id(self, source_url: str) -> str:
        """Generate unique ID for media item."""
        date_part = datetime.now().strftime("%Y%m%d")
        hash_part = hashlib.md5(source_url.encode()).hexdigest()[:8]
        count = len(self.metadata["items"]) + 1
        return f"IMG_{date_part}_{count:04d}_{hash_part}"
    
    def add_item(self, item: MediaItem) -> str:
        """Add media item to catalog."""
        self.metadata["items"].append(vars(item))
        
        # Update search indices
        for tag in item.tags:
            if tag not in self.metadata["index"]:
                self.metadata["index"][tag] = []
            self.metadata["index"][tag].append(item.id)
        
        self._save_metadata()
        return item.id
    
    def search(self, tags: List[str] = None, category: str = None,
               date_range: tuple = None) -> List[Dict]:
        """Search media catalog."""
        results = self.metadata["items"]
        
        if tags:
            tag_matches = set()
            for tag in tags:
                if tag in self.metadata["index"]:
                    tag_matches.update(self.metadata["index"][tag])
            results = [i for i in results if i["id"] in tag_matches]
        
        if category:
            results = [i for i in results if i["category"] == category]
        
        return results
    
    def get_for_topic(self, topic: str) -> List[Dict]:
        """Get all media for a specific topic."""
        topic_tags = {
            "turkmenchay": ["turkmenchay", "1828", "russia", "qajar", "treaty"],
            "cinema_rex": ["cinema_rex", "1978", "abadan", "fire"],
            "guadeloupe": ["guadeloupe", "1979", "carter", "western_betrayal"],
            "rasht": ["rasht", "2026", "bazaar", "massacre"],
            "mossadegh": ["mossadegh", "1953", "oil", "coup"],
            "constitutional": ["1906", "constitutional", "majlis", "mashruteh"]
        }
        
        tags = topic_tags.get(topic, [topic])
        return self.search(tags=tags)
    
    def organize_downloads(self, source_dir: Path, category: str, 
                          subcategory: str, tags: List[str]) -> List[str]:
        """Organize files from a download directory."""
        organized = []
        
        for file in source_dir.iterdir():
            if file.suffix.lower() in CONFIG["supported_formats"]:
                # Generate metadata
                item_id = self.generate_id(str(file))
                
                # Determine destination
                dest_dir = self.media_root / category / subcategory
                dest_dir.mkdir(parents=True, exist_ok=True)
                
                new_filename = f"{item_id}{file.suffix}"
                dest_path = dest_dir / new_filename
                
                # Move file
                file.rename(dest_path)
                
                # Create metadata entry
                item = MediaItem(
                    id=item_id,
                    filename=new_filename,
                    source_url=f"local:{file.name}",
                    source_type="local_import",
                    download_date=datetime.now().isoformat(),
                    category=category,
                    subcategory=subcategory,
                    tags=tags,
                    description="Imported from local directory",
                    local_path=str(dest_path)
                )
                
                self.add_item(item)
                organized.append(item_id)
        
        return organized


class FaytuksMediaPipeline:
    """Main pipeline for media acquisition and management."""
    
    def __init__(self):
        self.browser = AgentBrowserClient()
        self.google_scraper = GoogleImageScraper(self.browser)
        self.twitter_scraper = TwitterScraper(self.browser)
        self.organizer = MediaOrganizer()
        
        # Load topic requirements
        self.topic_requirements = self._load_topic_requirements()
    
    def _load_topic_requirements(self) -> Dict:
        """Load media requirements from schema."""
        schema_path = Path("media/MEDIA_SCHEMA.json")
        if schema_path.exists():
            with open(schema_path, 'r') as f:
                schema = json.load(f)
                return schema.get("media_repository", {}).get("topic_media_requirements", {}).get("topics", {})
        return {}
    
    def acquire_for_topic(self, topic: str, max_images: int = 10) -> Dict:
        """Acquire all needed media for a topic."""
        if topic not in self.topic_requirements:
            return {"error": f"Unknown topic: {topic}"}
        
        requirements = self.topic_requirements[topic]
        results = {
            "topic": topic,
            "queries_executed": [],
            "images_found": 0,
            "images_downloaded": 0
        }
        
        for query in requirements.get("search_queries", []):
            if query.startswith("SCRAPE FROM TWITTER"):
                continue  # Skip Twitter-only topics for Google search
            
            print(f"Executing query: {query}")
            
            # Determine category from topic
            category = self._topic_to_category(topic)
            
            images = self.google_scraper.download_from_search(
                query=query,
                category=category,
                subcategory=topic,
                max_images=max_images
            )
            
            results["queries_executed"].append(query)
            results["images_found"] += len(images)
        
        return results
    
    def _topic_to_category(self, topic: str) -> str:
        """Map topic to category directory."""
        mapping = {
            "turkmenchay_1828": "events/turkmenchay-1828",
            "cinema_rex_1978": "events/cinema-rex-1978",
            "guadeloupe_1979": "events/guadeloupe-1979",
            "constitutional_revolution_1906": "historical/1906-1953",
            "mossadegh_era": "historical/1906-1953",
            "1979_revolution": "historical/1979-revolution",
            "ethnic_unity": "historical",
            "rasht_2026": "current/protests",
            "pahlavi_family": "figures/pahlavi-dynasty"
        }
        return mapping.get(topic, "uncategorized")
    
    def scrape_twitter_for_current(self, query: str, max_items: int = 20) -> Dict:
        """Scrape Twitter for current event media."""
        results = self.twitter_scraper.search_and_download(
            query=query,
            category="current",
            subcategory="protests",
            max_items=max_items
        )
        
        return {
            "query": query,
            "items_found": len(results),
            "items": results
        }
    
    def get_media_for_tweet(self, topic: str) -> List[Dict]:
        """Get available media for a tweet topic."""
        return self.organizer.get_for_topic(topic)
    
    def generate_scraping_plan(self) -> Dict:
        """Generate a plan for what media needs to be acquired."""
        plan = {
            "critical_gaps": [],
            "high_priority": [],
            "medium_priority": [],
            "queries_to_execute": []
        }
        
        for topic, requirements in self.topic_requirements.items():
            priority = requirements.get("priority", "medium")
            existing = self.organizer.get_for_topic(topic)
            needed = requirements.get("needed", [])
            
            gap = {
                "topic": topic,
                "existing_count": len(existing),
                "needed_items": needed,
                "search_queries": requirements.get("search_queries", [])
            }
            
            if priority == "critical" and len(existing) < 3:
                plan["critical_gaps"].append(gap)
                plan["queries_to_execute"].extend(gap["search_queries"])
            elif priority == "high" and len(existing) < 2:
                plan["high_priority"].append(gap)
            else:
                plan["medium_priority"].append(gap)
        
        return plan
    
    def close(self):
        """Close browser session."""
        self.browser.close()


# CLI Commands
def cmd_search(args):
    """Search and download images for a topic."""
    pipeline = FaytuksMediaPipeline()
    try:
        result = pipeline.acquire_for_topic(args.topic, args.max_images)
        print(json.dumps(result, indent=2))
    finally:
        pipeline.close()

def cmd_twitter(args):
    """Scrape Twitter for media."""
    pipeline = FaytuksMediaPipeline()
    try:
        result = pipeline.scrape_twitter_for_current(args.query, args.max_items)
        print(json.dumps(result, indent=2))
    finally:
        pipeline.close()

def cmd_plan(args):
    """Generate scraping plan."""
    pipeline = FaytuksMediaPipeline()
    try:
        plan = pipeline.generate_scraping_plan()
        print(json.dumps(plan, indent=2))
    finally:
        pipeline.close()

def cmd_organize(args):
    """Organize downloaded files."""
    organizer = MediaOrganizer()
    source = Path(args.source)
    
    if not source.exists():
        print(f"Source directory not found: {source}")
        return
    
    tags = args.tags.split(",") if args.tags else []
    
    organized = organizer.organize_downloads(
        source_dir=source,
        category=args.category,
        subcategory=args.subcategory,
        tags=tags
    )
    
    print(f"Organized {len(organized)} files")
    for item_id in organized:
        print(f"  - {item_id}")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Faytuks Media Scraper")
    subparsers = parser.add_subparsers(dest="command")
    
    # Search command
    search_parser = subparsers.add_parser("search", help="Search and download images")
    search_parser.add_argument("--topic", required=True, help="Topic to search for")
    search_parser.add_argument("--max-images", type=int, default=10, help="Max images to download")
    
    # Twitter command
    twitter_parser = subparsers.add_parser("twitter", help="Scrape Twitter for media")
    twitter_parser.add_argument("--query", required=True, help="Search query")
    twitter_parser.add_argument("--max-items", type=int, default=20, help="Max items to download")
    
    # Plan command
    plan_parser = subparsers.add_parser("plan", help="Generate scraping plan")
    
    # Organize command
    organize_parser = subparsers.add_parser("organize", help="Organize downloaded files")
    organize_parser.add_argument("--source", required=True, help="Source directory")
    organize_parser.add_argument("--category", required=True, help="Target category")
    organize_parser.add_argument("--subcategory", required=True, help="Target subcategory")
    organize_parser.add_argument("--tags", help="Comma-separated tags")
    
    args = parser.parse_args()
    
    if args.command == "search":
        cmd_search(args)
    elif args.command == "twitter":
        cmd_twitter(args)
    elif args.command == "plan":
        cmd_plan(args)
    elif args.command == "organize":
        cmd_organize(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()