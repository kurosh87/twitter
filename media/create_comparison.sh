#!/bin/bash
# Create side-by-side comparison images for historical parallels
# Requires: ImageMagick (convert command)

MEDIA_ROOT="$(dirname "$0")"
OUTPUT_DIR="$MEDIA_ROOT/infographics/comparisons"
mkdir -p "$OUTPUT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if ImageMagick is available
if ! command -v convert &> /dev/null; then
    echo -e "${RED}ImageMagick not found. Install with: brew install imagemagick${NC}"
    exit 1
fi

create_comparison() {
    local left_image="$1"
    local right_image="$2"
    local left_label="$3"
    local right_label="$4"
    local output_name="$5"
    local title="$6"
    
    if [ ! -f "$left_image" ]; then
        echo -e "${RED}Left image not found: $left_image${NC}"
        return 1
    fi
    if [ ! -f "$right_image" ]; then
        echo -e "${RED}Right image not found: $right_image${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Creating comparison: $output_name${NC}"
    
    # Create comparison with labels
    convert \
        \( "$left_image" -resize 600x400^ -gravity center -extent 600x400 \
           -font Helvetica-Bold -pointsize 24 -fill white -gravity South \
           -background 'rgba(0,0,0,0.7)' -splice 0x40 \
           -annotate +0+10 "$left_label" \) \
        \( "$right_image" -resize 600x400^ -gravity center -extent 600x400 \
           -font Helvetica-Bold -pointsize 24 -fill white -gravity South \
           -background 'rgba(0,0,0,0.7)' -splice 0x40 \
           -annotate +0+10 "$right_label" \) \
        +append \
        -gravity North -background black -splice 0x50 \
        -font Helvetica-Bold -pointsize 28 -fill white \
        -annotate +0+10 "$title" \
        "$OUTPUT_DIR/$output_name"
    
    if [ -f "$OUTPUT_DIR/$output_name" ]; then
        echo -e "${GREEN}Created: $OUTPUT_DIR/$output_name${NC}"
        return 0
    else
        echo -e "${RED}Failed to create comparison${NC}"
        return 1
    fi
}

# Pre-built comparison configurations
case "$1" in
    fire_parallel)
        # Cinema Rex 1978 vs Rasht 2026
        create_comparison \
            "$MEDIA_ROOT/events/cinema-rex-1978/wiki_000_Rex_Cinema_Fire.jpg" \
            "$MEDIA_ROOT/events/bloody-november-2019/wiki_001_2019_Iranian_fuel_protests_Day_1_by_Fars_News_(10).jpg" \
            "Cinema Rex 1978" \
            "Protests 2019-2026" \
            "fire_parallel_comparison.jpg" \
            "Same Fire, Same Lies"
        ;;
    
    constitutional)
        # 1906 Majlis vs Modern protests
        create_comparison \
            "$MEDIA_ROOT/events/constitutional-1906/wiki_010_First_Majlis_MPs.jpg" \
            "$MEDIA_ROOT/historical/2022-mahsa/wiki_000"*.jpg 2>/dev/null || \
        create_comparison \
            "$MEDIA_ROOT/events/constitutional-1906/wiki_010_First_Majlis_MPs.jpg" \
            "$MEDIA_ROOT/events/bloody-november-2019/wiki_001"*.jpg \
            "First Majlis 1906" \
            "Revolution 2022-2026" \
            "constitutional_comparison.jpg" \
            "120 Years of Democratic Struggle"
        ;;
    
    western_betrayal)
        # Guadeloupe 1979 vs Modern silence
        create_comparison \
            "$MEDIA_ROOT/events/guadeloupe-1979/wiki_000_Carter_guadeloupe_cropped.png" \
            "$MEDIA_ROOT/geopolitics/us-iran/wiki_000"*.jpg 2>/dev/null || \
        create_comparison \
            "$MEDIA_ROOT/events/guadeloupe-1979/wiki_000_Carter_guadeloupe_cropped.png" \
            "$MEDIA_ROOT/figures/us-military/wiki_000"*.jpg \
            "Guadeloupe 1979" \
            "US Policy 2026" \
            "western_betrayal_comparison.jpg" \
            "Then: Betrayal. Now: Silence."
        ;;
    
    great_power)
        # Turkmenchay treaty vs modern carriers
        create_comparison \
            "$MEDIA_ROOT/events/turkmenchay-1828/wiki_000_Treaty_of_Turkmenchay_by_Moshkov.jpg" \
            "$MEDIA_ROOT/military/us-navy/wiki_000"*.jpg 2>/dev/null || echo "US Navy image not found"
        ;;
    
    custom)
        # Custom comparison: ./create_comparison.sh custom left.jpg right.jpg "Left" "Right" output.jpg "Title"
        create_comparison "$2" "$3" "$4" "$5" "$6" "$7"
        ;;
    
    list)
        echo "Available comparisons:"
        echo "  fire_parallel    - Cinema Rex 1978 vs current protests"
        echo "  constitutional   - 1906 Majlis vs modern revolution"
        echo "  western_betrayal - Guadeloupe 1979 vs US silence now"
        echo "  great_power      - Turkmenchay vs US carriers"
        echo "  custom           - Create custom comparison"
        echo ""
        echo "Usage: ./create_comparison.sh <type>"
        echo "       ./create_comparison.sh custom left.jpg right.jpg 'Left Label' 'Right Label' output.jpg 'Title'"
        ;;
    
    all)
        echo "Creating all comparisons..."
        $0 fire_parallel
        $0 constitutional
        $0 western_betrayal
        ;;
    
    *)
        $0 list
        ;;
esac
