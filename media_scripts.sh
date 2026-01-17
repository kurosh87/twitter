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
    echo "Commands:"
    echo "  google <query> <output_dir>     - Search Google Images"
    echo "  twitter <query> <output_dir>    - Search Twitter for media"
    echo "  tweet <url> <output_dir>        - Download media from specific tweet"
    echo "  wikipedia <article> <output_dir>- Get images from Wikipedia article"
    echo "  wikimedia <query> <output_dir>  - Search Wikimedia Commons"
    echo "  interactive <url>               - Open headed browser for manual scraping"
    echo "  batch <config.json>             - Run batch searches from config file"
    echo "  close                           - Close browser session"
    echo ""
    echo "Examples:"
    echo "  ./media_scripts.sh google \"Treaty of Turkmenchay 1828\" ./media/events/turkmenchay"
    echo "  ./media_scripts.sh twitter \"Rasht protest\" ./media/current/rasht"
    echo "  ./media_scripts.sh tweet \"https://twitter.com/user/status/123\" ./media/current/tweets"
    echo "  ./media_scripts.sh wikipedia \"Treaty_of_Turkmenchay\" ./media/events/turkmenchay"
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