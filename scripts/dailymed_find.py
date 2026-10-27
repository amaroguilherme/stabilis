"""Finds FDA drug labels (SPL) on DailyMed to register as sources in knowledge/sources.json.

    python -I scripts/dailymed_find.py fluoxetine --title PROZAC
    python -I scripts/dailymed_find.py amitriptyline --title "AMITRIPTYLINE HYDROCHLORIDE" --limit 5

Prints setid, publication date and title of the matching labels, most recent first.
"""

from __future__ import annotations

import argparse
import datetime as dt
import sys

import requests

API = "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json"
HEADERS = {"User-Agent": "stabilis-knowledge-fetcher/0.1 (+https://github.com/amaroguilherme/stabilis)"}


def search(ingredient: str, title_filter: str | None, limit: int, prefix: str | None = None) -> list[dict]:
    found: list[dict] = []
    page = 1
    while True:
        response = requests.get(API, params={"drug_name": ingredient, "pagesize": 100, "page": page}, headers=HEADERS, timeout=60)
        response.raise_for_status()
        payload = response.json()
        for item in payload["data"]:
            if title_filter and title_filter.upper() not in item["title"].upper():
                continue
            if prefix and not item["title"].upper().startswith(prefix.upper()):
                continue
            found.append(item)
        if page >= payload["metadata"].get("total_pages", 1) or page >= 10:
            break
        page += 1
    found.sort(key=lambda i: dt.datetime.strptime(i["published_date"], "%b %d, %Y"), reverse=True)
    return found[:limit]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("ingredient")
    parser.add_argument("--title", help="trecho que precisa aparecer no título (ex.: marca)")
    parser.add_argument("--prefix", help="o título precisa começar com este texto")
    parser.add_argument("--limit", type=int, default=3)
    args = parser.parse_args()
    for item in search(args.ingredient, args.title, args.limit, args.prefix):
        print(f"{item['setid']}  {item['published_date']:>12}  {item['title']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
