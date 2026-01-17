#!/usr/bin/env python3
"""
Build metadata.json catalog from downloaded images.
Scans media/ directory and catalogs all wiki_* images with tags and patterns.
"""

import json
import os
from pathlib import Path
from datetime import datetime
import subprocess

MEDIA_ROOT = Path(__file__).parent

# Map directories to patterns and tags
DIR_MAPPING = {
    # EVENTS
    "events/cinema-rex-1978": {
        "patterns": ["fire_parallel", "massacre_escalation"],
        "tags": ["cinema_rex", "1978", "fire", "abadan", "arson"],
        "era": "1970s"
    },
    "events/turkmenchay-1828": {
        "patterns": ["great_power_game"],
        "tags": ["turkmenchay", "1828", "russia", "treaty", "territory_loss"],
        "era": "1800s"
    },
    "events/guadeloupe-1979": {
        "patterns": ["western_betrayal"],
        "tags": ["guadeloupe", "1979", "carter", "western_powers", "betrayal"],
        "era": "1970s"
    },
    "events/constitutional-1906": {
        "patterns": ["constitutional_memory", "iraq_contrast"],
        "tags": ["constitutional", "1906", "majlis", "mashruteh", "democracy"],
        "era": "1900s"
    },
    "events/black-friday-1978": {
        "patterns": ["massacre_escalation"],
        "tags": ["black_friday", "1978", "jaleh_square", "massacre"],
        "era": "1970s"
    },
    "events/1988-executions": {
        "patterns": ["massacre_escalation"],
        "tags": ["1988", "executions", "political_prisoners", "raisi"],
        "era": "1980s"
    },
    "events/bloody-november-2019": {
        "patterns": ["massacre_escalation", "fire_parallel"],
        "tags": ["2019", "bloody_november", "fuel_protests", "aban"],
        "era": "2010s"
    },
    # HISTORICAL
    "historical/1979-revolution": {
        "patterns": ["counter_revolution"],
        "tags": ["1979", "revolution", "khomeini", "demonstrations"],
        "era": "1970s"
    },
    "historical/1980-1988": {
        "patterns": ["ethnic_unity", "iraq_contrast"],
        "tags": ["iran_iraq_war", "1980s", "khuzestan", "war"],
        "era": "1980s"
    },
    "historical/2022-mahsa": {
        "patterns": ["massacre_escalation"],
        "tags": ["2022", "mahsa_amini", "woman_life_freedom", "protests"],
        "era": "2020s"
    },
    # FIGURES - IRANIAN
    "figures/khomeini": {
        "patterns": ["counter_revolution"],
        "tags": ["khomeini", "ayatollah", "islamic_republic"],
        "era": "1970s-1980s"
    },
    "figures/khamenei": {
        "patterns": ["great_power_game", "massacre_escalation"],
        "tags": ["khamenei", "supreme_leader", "islamic_republic"],
        "era": "1989-present"
    },
    "figures/mossadegh": {
        "patterns": ["iraq_contrast", "constitutional_memory"],
        "tags": ["mossadegh", "1951", "1953", "nationalization", "coup"],
        "era": "1950s"
    },
    "figures/pahlavi-dynasty": {
        "patterns": ["counter_revolution"],
        "tags": ["pahlavi", "shah", "monarchy", "reza_pahlavi"],
        "era": "1900s-1970s"
    },
    "figures/irgc": {
        "patterns": ["great_power_game", "massacre_escalation"],
        "tags": ["irgc", "quds_force", "soleimani", "military", "regime"],
        "era": "1979-present"
    },
    # FIGURES - US/WESTERN
    "figures/us-officials": {
        "patterns": ["great_power_game", "western_betrayal"],
        "tags": ["trump", "rubio", "us_officials", "foreign_policy"],
        "era": "2020s"
    },
    "figures/us-military": {
        "patterns": ["great_power_game", "iraq_contrast"],
        "tags": ["us_military", "centcom", "generals", "pentagon"],
        "era": "contemporary"
    },
    # MILITARY
    "military/us-navy": {
        "patterns": ["great_power_game"],
        "tags": ["carrier", "fleet", "navy", "persian_gulf", "us_military"],
        "era": "contemporary"
    },
    "military/us-airforce": {
        "patterns": ["great_power_game"],
        "tags": ["airforce", "jets", "bombers", "us_military"],
        "era": "contemporary"
    },
    "military/weapons": {
        "patterns": ["great_power_game"],
        "tags": ["missiles", "weapons", "ordnance", "military"],
        "era": "contemporary"
    },
    "military/irgc-assets": {
        "patterns": ["great_power_game"],
        "tags": ["irgc", "drones", "missiles", "iran_military"],
        "era": "contemporary"
    },
    # MAPS
    "maps/turkmenchay-loss": {
        "patterns": ["great_power_game"],
        "tags": ["map", "territory", "russia", "caucasus", "turkmenchay"],
        "era": "historical"
    },
    "maps/ethnic-distribution": {
        "patterns": ["ethnic_unity"],
        "tags": ["map", "ethnic", "diversity", "kurds", "azeris", "baloch"],
        "era": "contemporary"
    },
    "maps/persian-gulf": {
        "patterns": ["great_power_game"],
        "tags": ["map", "persian_gulf", "strait_hormuz", "military"],
        "era": "contemporary"
    },
    # GEOPOLITICS
    "geopolitics/us-iran": {
        "patterns": ["great_power_game", "western_betrayal"],
        "tags": ["us_iran", "sanctions", "diplomacy", "confrontation"],
        "era": "contemporary"
    },
    "geopolitics/china-russia": {
        "patterns": ["great_power_game"],
        "tags": ["china", "russia", "axis", "partnership"],
        "era": "contemporary"
    },
}

# Hero images - best image per directory (manually curated)
HERO_IMAGES = {
    "events/cinema-rex-1978": "wiki_000_Rex_Cinema_Fire.jpg",
    "events/turkmenchay-1828": "wiki_000_Treaty_of_Turkmenchay_by_Moshkov.jpg",
    "events/guadeloupe-1979": "wiki_000_Carter_guadeloupe_cropped.png",
    "events/constitutional-1906": "wiki_010_First_Majlis_MPs.jpg",
    "events/black-friday-1978": "wiki_000",
    "events/1988-executions": "wiki_001_Ebrahim_Raisi_and_Mostafa_Pourmohammadi.jpg",
    "events/bloody-november-2019": "wiki_001",
    "historical/1979-revolution": "wiki_000",
    "historical/1980-1988": "wiki_002_Children_In_iraq-iran_war4_(cropped).jpg",
    "historical/2022-mahsa": "wiki_000",
    "figures/khomeini": "wiki_000",
    "figures/khamenei": "wiki_000",
    "figures/mossadegh": "wiki_000",
    "figures/pahlavi-dynasty": "wiki_000",
    "figures/irgc": "wiki_000",
    "figures/us-officials": "wiki_000",
    "figures/us-military": "wiki_000",
    "military/us-navy": "wiki_000",
    "military/us-airforce": "wiki_000",
    "maps/ethnic-distribution": "wiki_002_Iran_ethnoreligious_distribution_2004.jpg",
    "maps/turkmenchay-loss": "wiki_021_Map_Safavid_persia.png",
}


def get_file_info(filepath: Path) -> dict:
    """Get file size and type."""
    size = filepath.stat().st_size
    try:
        result = subprocess.run(['file', '-b', str(filepath)], capture_output=True)
        file_type = result.stdout.decode('utf-8', errors='replace').strip()[:50]
    except Exception:
        file_type = "unknown"
    return {"size": size, "type": file_type}


def build_catalog():
    """Scan media directory and build catalog."""
    catalog = {
        "version": "2.0",
        "last_updated": datetime.now().isoformat(),
        "total_items": 0,
        "categories": {
            "historical": "Pre-2022 historical images",
            "events": "Key historical events (Cinema Rex, Turkmenchay, etc.)",
            "figures": "Notable people (Pahlavi, Mossadegh, IRGC, US officials)",
            "maps": "Geographic and territorial maps",
            "military": "Military assets, carriers, weapons",
            "geopolitics": "US-Iran, China-Russia relations",
            "current": "2025-2026 revolution media",
            "infographics": "Created visual content"
        },
        "patterns": {
            "fire_parallel": "Cinema Rex 1978 / Current fire events",
            "counter_revolution": "1979 hijack of democratic movement",
            "western_betrayal": "Guadeloupe 1979, Western silence",
            "ethnic_unity": "Iranian ethnic groups united",
            "iraq_contrast": "Why Iran isn't Iraq",
            "great_power_game": "Russia/China relations, US military, Turkmenchay",
            "constitutional_memory": "1906 revolution, democratic heritage",
            "massacre_escalation": "1988 → 2019 → 2022 → 2026"
        },
        "media": []
    }

    # Scan for wiki_* images
    for dirpath, pattern_info in DIR_MAPPING.items():
        full_path = MEDIA_ROOT / dirpath
        if not full_path.exists():
            continue

        hero_pattern = HERO_IMAGES.get(dirpath, "")

        for img_file in sorted(full_path.glob("wiki_*")):
            if not img_file.is_file():
                continue

            rel_path = str(img_file.relative_to(MEDIA_ROOT))
            file_info = get_file_info(img_file)

            # Determine if hero image
            is_hero = (hero_pattern and
                      (img_file.name == hero_pattern or
                       img_file.name.startswith(hero_pattern)))

            entry = {
                "id": f"IMG_{catalog['total_items']:04d}",
                "filename": img_file.name,
                "path": rel_path,
                "directory": dirpath,
                "patterns": pattern_info["patterns"],
                "tags": pattern_info["tags"],
                "era": pattern_info["era"],
                "size_bytes": file_info["size"],
                "file_type": file_info["type"],
                "is_hero": is_hero,
                "added": datetime.now().isoformat()
            }

            catalog["media"].append(entry)
            catalog["total_items"] += 1

    return catalog


def main():
    catalog = build_catalog()

    output_path = MEDIA_ROOT / "metadata.json"
    with open(output_path, 'w') as f:
        json.dump(catalog, f, indent=2)

    print(f"Catalog built: {catalog['total_items']} images")

    # Print hero images
    heroes = [m for m in catalog["media"] if m["is_hero"]]
    print(f"Hero images: {len(heroes)}")
    for h in heroes:
        print(f"  {h['directory']}: {h['filename']}")

    # Print by pattern
    print("\nBy pattern:")
    for pattern in catalog["patterns"]:
        count = len([m for m in catalog["media"] if pattern in m["patterns"]])
        print(f"  {pattern}: {count} images")


if __name__ == "__main__":
    main()
