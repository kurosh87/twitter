#!/bin/bash
# Faytuks Media Acquisition Scripts
# Using agent-browser for automated image collection

# Configuration
MEDIA_ROOT="./media"
SESSION="faytuks_media"
DELAY=2

# Export session for agent-browser (uses env var instead of --session flag)
export AGENT_BROWSER_SESSION="$SESSION"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure directories exist
mkdir -p "$MEDIA_ROOT"/{historical,events,figures,maps,documents,current,infographics,video}/_temp

echo -e "${GREEN}Faytuks Media Scraper${NC}"
echo "================================"

#######################################
# ACTUAL IMAGE DOWNLOAD FUNCTIONS
#######################################

# Download a single image with proper headers
download_image() {
    local url="$1"
    local output="$2"

    # Use curl with browser-like headers to avoid blocks
    curl -sL \
        -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
        -H "Referer: https://www.google.com" \
        -H "Accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" \
        "$url" -o "$output"

    # Check if download succeeded
    if [ -f "$output" ] && [ -s "$output" ]; then
        # Verify it's actually an image, not HTML error
        file_type=$(file -b "$output" | head -c 10)
        if [[ "$file_type" == *"HTML"* ]] || [[ "$file_type" == *"XML"* ]]; then
            echo -e "${RED}Downloaded HTML instead of image: $output${NC}"
            rm "$output"
            return 1
        fi
        echo -e "${GREEN}Downloaded: $output ($(du -h "$output" | cut -f1))${NC}"
        return 0
    else
        echo -e "${RED}Failed to download: $url${NC}"
        return 1
    fi
}

# Download all images from Wikipedia JSON extraction
download_wikipedia_images() {
    local json_file="$1"
    local output_dir="$2"

    if [ ! -f "$json_file" ]; then
        echo -e "${RED}JSON file not found: $json_file${NC}"
        return 1
    fi

    mkdir -p "$output_dir"

    echo -e "${YELLOW}Processing Wikipedia images from: $json_file${NC}"

    python3 << PYEOF
import json
import subprocess
import os
import sys
from urllib.parse import unquote

json_file = "$json_file"
output_dir = "$output_dir"

# Read the JSON file (it's double-encoded from agent-browser)
with open(json_file, 'r') as f:
    raw = f.read().strip()

# Handle double-encoding: first strip outer quotes if present
if raw.startswith('"') and raw.endswith('"'):
    raw = raw[1:-1]
    # Unescape the inner JSON using codecs
    import codecs
    raw = codecs.decode(raw, 'unicode_escape')

try:
    data = json.loads(raw)
except json.JSONDecodeError as e:
    print(f"Failed to parse JSON: {e}")
    sys.exit(1)

downloaded = 0
skipped = 0

for i, img in enumerate(data):
    src = img.get('src', '')

    if not src:
        continue

    # Skip tiny icons and SVG logos
    if any(skip in src for skip in ['Symbol_category', 'Commons-logo', 'OOjs_UI_icon', 'P_history', '/20px-', '/40px-']):
        skipped += 1
        continue

    # Convert thumb URL to full-res URL
    # Thumb format: /thumb/a/af/Image.jpg/440px-Image.jpg
    # Full format: /a/af/Image.jpg
    if '/thumb/' in src:
        # Remove /thumb/ and the size prefix at the end
        full_url = src.replace('/thumb/', '/')
        # Remove the last path component (e.g., /440px-Image.jpg)
        full_url = '/'.join(full_url.rsplit('/', 1)[:-1])
    else:
        full_url = src

    # Ensure https://
    if full_url.startswith('//'):
        full_url = 'https:' + full_url
    elif not full_url.startswith('http'):
        full_url = 'https://upload.wikimedia.org' + full_url

    # Get filename from URL
    filename = unquote(full_url.split('/')[-1])
    # Clean up filename
    filename = filename.replace(':', '_').replace('?', '_').replace('&', '_')[:100]

    # Add index prefix to maintain order
    ext = filename.split('.')[-1].lower()[:4]
    if ext not in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']:
        ext = 'jpg'  # Default

    output_file = os.path.join(output_dir, f"wiki_{i:03d}_{filename}")

    # Don't re-download existing files
    if os.path.exists(output_file):
        print(f"Skipping existing: {output_file}")
        continue

    print(f"Downloading: {full_url}")
    print(f"  -> {output_file}")

    result = subprocess.run([
        'curl', '-sL',
        '-A', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        '-H', 'Referer: https://en.wikipedia.org/',
        full_url, '-o', output_file
    ], capture_output=True)

    # Check if it's actually an image
    if os.path.exists(output_file):
        check = subprocess.run(['file', '-b', output_file], capture_output=True, text=True)
        if 'HTML' in check.stdout or 'XML' in check.stdout or os.path.getsize(output_file) < 1000:
            print(f"  ERROR: Got HTML or tiny file, removing")
            os.remove(output_file)
        else:
            size = os.path.getsize(output_file)
            print(f"  SUCCESS: {size:,} bytes")
            downloaded += 1

print(f"\nDownloaded: {downloaded} images")
print(f"Skipped: {skipped} (icons/small)")
PYEOF

    echo -e "${GREEN}Wikipedia image download complete${NC}"
}

# Download images from Twitter JSON extraction
download_twitter_images() {
    local json_file="$1"
    local output_dir="$2"

    if [ ! -f "$json_file" ]; then
        echo -e "${RED}JSON file not found: $json_file${NC}"
        return 1
    fi

    mkdir -p "$output_dir"

    echo -e "${YELLOW}Downloading Twitter images from: $json_file${NC}"

    python3 << PYEOF
import json
import subprocess
import os

json_file = "$json_file"
output_dir = "$output_dir"

with open(json_file, 'r') as f:
    raw = f.read().strip()

# Handle potential double-encoding
if raw.startswith('"') and raw.endswith('"'):
    raw = raw[1:-1].replace('\\"', '"')

data = json.loads(raw)
downloaded = 0

for i, img in enumerate(data):
    url = img.get('url', '')
    if not url:
        continue

    # Ensure large size
    if 'name=' in url:
        url = url.split('?')[0] + '?format=jpg&name=large'

    output_file = os.path.join(output_dir, f"twitter_{i:03d}.jpg")

    print(f"Downloading: {url}")
    result = subprocess.run([
        'curl', '-sL',
        '-A', 'Mozilla/5.0',
        '-H', 'Referer: https://twitter.com/',
        url, '-o', output_file
    ])

    if os.path.exists(output_file) and os.path.getsize(output_file) > 1000:
        print(f"  SUCCESS: {os.path.getsize(output_file):,} bytes")
        downloaded += 1
    else:
        print(f"  FAILED")
        if os.path.exists(output_file):
            os.remove(output_file)

print(f"\nDownloaded: {downloaded} images")
PYEOF
}

# Batch download all Wikipedia images from a directory's JSON files
download_all_wikipedia() {
    local base_dir="${1:-$MEDIA_ROOT}"

    echo -e "${YELLOW}Scanning for Wikipedia JSON files in: $base_dir${NC}"

    find "$base_dir" -name "wikipedia_images.json" | while read json_file; do
        dir=$(dirname "$json_file")
        echo -e "\n${GREEN}Processing: $dir${NC}"
        download_wikipedia_images "$json_file" "$dir"
    done
}

#######################################
# Google Images Search and Download
#######################################
google_image_search() {
    local query="$1"
    local output_dir="$2"
    local max_images="${3:-10}"
    
    echo -e "${YELLOW}Searching Google Images: $query${NC}"
    
    # URL encode the query
    encoded_query=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$query'))")
    
    # Open Google Images
    agent-browser open "https://www.google.com/search?tbm=isch&q=$encoded_query"
    sleep $DELAY
    
    # Get snapshot to see what we have
    echo "Getting page snapshot..."
    agent-browser snapshot -i -c
    
    # Scroll to load more images
    for i in {1..5}; do
        agent-browser scroll down 1000
        sleep 1
    done
    
    # Take screenshot for reference
    mkdir -p "$output_dir"
    agent-browser screenshot "$output_dir/search_results_$(date +%Y%m%d_%H%M%S).png" --full
    
    echo -e "${GREEN}Screenshot saved. Manual download required for individual images.${NC}"
    echo "Tip: Click on images in the snapshot to get high-res versions"
}

#######################################
# Twitter Media Scraper
#######################################
twitter_media_search() {
    local query="$1"
    local output_dir="$2"
    local max_items="${3:-20}"
    
    echo -e "${YELLOW}Searching Twitter: $query${NC}"
    
    # URL encode
    encoded_query=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$query'))")
    
    # Open Twitter search with image filter
    agent-browser open "https://twitter.com/search?q=$encoded_query&src=typed_query&f=image"
    sleep 3
    
    # Scroll to load tweets
    for i in {1..5}; do
        agent-browser scroll down 800
        sleep 2
    done
    
    # Get snapshot
    echo "Getting Twitter snapshot..."
    agent-browser snapshot -i
    
    # Screenshot for reference
    mkdir -p "$output_dir"
    agent-browser screenshot "$output_dir/twitter_search_$(date +%Y%m%d_%H%M%S).png" --full
    
    # Extract image URLs using JavaScript
    echo "Extracting image URLs..."
    agent-browser eval "
        JSON.stringify(
            Array.from(document.querySelectorAll('img[src*=\"pbs.twimg.com/media\"]'))
                .slice(0, $max_items)
                .map(img => ({
                    url: img.src.replace('name=small', 'name=large').replace('name=medium', 'name=large'),
                    alt: img.alt
                }))
        )
    " > "$output_dir/image_urls.json"
    
    echo -e "${GREEN}Image URLs extracted to $output_dir/image_urls.json${NC}"
}

#######################################
# Download Single Tweet Media
#######################################
download_tweet_media() {
    local tweet_url="$1"
    local output_dir="$2"
    
    echo -e "${YELLOW}Downloading media from: $tweet_url${NC}"
    
    agent-browser open "$tweet_url"
    sleep 3
    
    mkdir -p "$output_dir"
    
    # Get tweet metadata
    agent-browser eval "
        JSON.stringify({
            author: document.querySelector('[data-testid=\"User-Name\"]')?.textContent || 'unknown',
            text: document.querySelector('[data-testid=\"tweetText\"]')?.textContent || '',
            images: Array.from(document.querySelectorAll('img[src*=\"pbs.twimg.com/media\"]')).map(i => i.src.replace(/name=\\w+/, 'name=large')),
            video: document.querySelector('video')?.src || null,
            timestamp: document.querySelector('time')?.dateTime || ''
        })
    " > "$output_dir/tweet_metadata.json"
    
    # Screenshot the tweet
    agent-browser screenshot "$output_dir/tweet_screenshot.png"
    
    echo -e "${GREEN}Tweet data saved to $output_dir/${NC}"
    cat "$output_dir/tweet_metadata.json"
}

#######################################
# Wikipedia Image Extraction
#######################################
wikipedia_images() {
    local article="$1"
    local output_dir="$2"
    
    echo -e "${YELLOW}Getting images from Wikipedia: $article${NC}"
    
    # URL encode
    encoded_article=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$article'))")
    
    agent-browser open "https://en.wikipedia.org/wiki/$encoded_article"
    sleep 2
    
    mkdir -p "$output_dir"
    
    # Extract all image URLs
    agent-browser eval "
        JSON.stringify(
            Array.from(document.querySelectorAll('.mw-file-element'))
                .map(img => ({
                    src: img.src,
                    alt: img.alt,
                    caption: img.closest('figure')?.querySelector('figcaption')?.textContent || ''
                }))
        )
    " > "$output_dir/wikipedia_images.json"
    
    agent-browser screenshot "$output_dir/wikipedia_page.png" --full
    
    echo -e "${GREEN}Wikipedia images extracted to $output_dir/${NC}"
}

#######################################
# Wikimedia Commons Search
#######################################
wikimedia_search() {
    local query="$1"
    local output_dir="$2"
    
    echo -e "${YELLOW}Searching Wikimedia Commons: $query${NC}"
    
    encoded_query=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$query'))")
    
    agent-browser open "https://commons.wikimedia.org/w/index.php?search=$encoded_query&title=Special:MediaSearch&type=image"
    sleep 3
    
    mkdir -p "$output_dir"
    
    # Scroll to load
    for i in {1..3}; do
        agent-browser scroll down 800
        sleep 1
    done
    
    # Extract results
    agent-browser eval "
        JSON.stringify(
            Array.from(document.querySelectorAll('.sdms-search-result'))
                .slice(0, 20)
                .map(el => ({
                    title: el.querySelector('.sdms-search-result__title')?.textContent || '',
                    thumb: el.querySelector('img')?.src || '',
                    link: el.querySelector('a')?.href || ''
                }))
        )
    " > "$output_dir/wikimedia_results.json"
    
    agent-browser screenshot "$output_dir/wikimedia_search.png" --full
    
    echo -e "${GREEN}Wikimedia results saved to $output_dir/${NC}"
}

#######################################
# Interactive Mode
#######################################
interactive_scrape() {
    local url="$1"
    
    echo -e "${YELLOW}Opening browser in headed mode for manual scraping${NC}"
    echo "Use 'agent-browser' commands in another terminal to interact"
    echo "Example commands (set AGENT_BROWSER_SESSION=$SESSION first):"
    echo "  agent-browser snapshot -i"
    echo "  agent-browser click @e1"
    echo "  agent-browser screenshot output.png"
    echo ""
    
    agent-browser open "$url" --headed
    
    echo -e "${GREEN}Browser opened. Press Ctrl+C when done.${NC}"
    
    # Keep running until user exits
    while true; do
        read -p "Enter command (or 'quit'): " cmd
        if [ "$cmd" == "quit" ]; then
            break
        fi
        agent-browser $cmd
    done
}

#######################################
# Batch Processing
#######################################
batch_search() {
    local config_file="$1"
    
    if [ ! -f "$config_file" ]; then
        echo -e "${RED}Config file not found: $config_file${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Running batch search from: $config_file${NC}"
    
    # Read JSON config and process each query
    python3 << EOF
import json
import subprocess
import time

with open('$config_file', 'r') as f:
    config = json.load(f)

for item in config.get('searches', []):
    query = item.get('query', '')
    source = item.get('source', 'google')
    output = item.get('output', './media/_temp')
    
    print(f"Processing: {query} from {source}")
    
    if source == 'google':
        subprocess.run(['bash', '-c', f'source media_scripts.sh && google_image_search "{query}" "{output}"'])
    elif source == 'twitter':
        subprocess.run(['bash', '-c', f'source media_scripts.sh && twitter_media_search "{query}" "{output}"'])
    elif source == 'wikipedia':
        subprocess.run(['bash', '-c', f'source media_scripts.sh && wikipedia_images "{query}" "{output}"'])
    elif source == 'wikimedia':
        subprocess.run(['bash', '-c', f'source media_scripts.sh && wikimedia_search "{query}" "{output}"'])
    
    time.sleep(3)

print("Batch processing complete!")
EOF
}

#######################################
# Close browser
#######################################
close_browser() {
    echo "Closing browser session..."
    agent-browser close
    echo -e "${GREEN}Browser closed.${NC}"
}

#######################################
# Main CLI
#######################################
show_help() {
    echo "Usage: ./media_scripts.sh <command> [arguments]"
    echo ""
    echo "SEARCH COMMANDS (extract URLs only):"
    echo "  google <query> <output_dir>      - Search Google Images (saves screenshot + refs)"
    echo "  twitter <query> <output_dir>     - Search Twitter for media (extracts URLs)"
    echo "  wikipedia <article> <output_dir> - Extract images from Wikipedia article"
    echo "  wikimedia <query> <output_dir>   - Search Wikimedia Commons"
    echo ""
    echo "DOWNLOAD COMMANDS (actually download images):"
    echo "  download-wiki <json> <output_dir>   - Download images from Wikipedia JSON"
    echo "  download-twitter <json> <output_dir>- Download images from Twitter JSON"
    echo "  download-all [base_dir]             - Download all Wikipedia images in directory tree"
    echo "  download-url <url> <output_file>    - Download single image URL"
    echo ""
    echo "OTHER COMMANDS:"
    echo "  tweet <url> <output_dir>         - Download media from specific tweet"
    echo "  interactive <url>                - Open headed browser for manual scraping"
    echo "  batch <config.json>              - Run batch searches from config file"
    echo "  close                            - Close browser session"
    echo ""
    echo "WORKFLOW:"
    echo "  1. Extract: ./media_scripts.sh wikipedia \"Cinema_Rex_fire\" ./media/events/cinema-rex"
    echo "  2. Download: ./media_scripts.sh download-wiki ./media/events/cinema-rex/wikipedia_images.json ./media/events/cinema-rex"
    echo ""
    echo "  Or batch all Wikipedia downloads:"
    echo "  ./media_scripts.sh download-all ./media"
    echo ""
    echo "Examples:"
    echo "  ./media_scripts.sh wikipedia \"Guadeloupe_Conference\" ./media/events/guadeloupe-1979"
    echo "  ./media_scripts.sh download-wiki ./media/events/guadeloupe-1979/wikipedia_images.json ./media/events/guadeloupe-1979"
    echo "  ./media_scripts.sh download-url \"https://upload.wikimedia.org/...jpg\" ./output.jpg"
}

# Parse command
case "$1" in
    google)
        google_image_search "$2" "$3" "$4"
        ;;
    twitter)
        twitter_media_search "$2" "$3" "$4"
        ;;
    tweet)
        download_tweet_media "$2" "$3"
        ;;
    wikipedia)
        wikipedia_images "$2" "$3"
        ;;
    wikimedia)
        wikimedia_search "$2" "$3"
        ;;
    download-wiki)
        download_wikipedia_images "$2" "$3"
        ;;
    download-twitter)
        download_twitter_images "$2" "$3"
        ;;
    download-all)
        download_all_wikipedia "$2"
        ;;
    download-url)
        download_image "$2" "$3"
        ;;
    interactive)
        interactive_scrape "$2"
        ;;
    batch)
        batch_search "$2"
        ;;
    close)
        close_browser
        ;;
    *)
        show_help
        ;;
esac