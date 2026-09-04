#!/usr/bin/env bash
# Fetch any still-missing Commons SVGs into sources/commons/ using curl.
# The Python harvester's urllib fetch stalled on a couple of files; curl handles
# the same requests fine. Running this then re-running the harvester lets it
# build purely from cache.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="$ROOT/sources/commons"
UA="HalyardFlagGame/1.0 (personal hobby project)"
mkdir -p "$CACHE"

# code<TAB>Commons title
grab() {
  local code="$1" title="$2"
  local out="$CACHE/$code.svg"
  if [ -s "$out" ]; then printf "  cached  %s\n" "$code"; return 0; fi
  local enc url
  enc=$(python -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$title")
  url=$(curl -sS --max-time 30 -A "$UA" \
        "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&redirects=1&titles=File:$enc" \
        | python -c "
import json,sys
d=json.load(sys.stdin)
for _,v in d.get('query',{}).get('pages',{}).items():
    if 'missing' in v: print(''); break
    print(v.get('imageinfo',[{}])[0].get('url',''))
    break
")
  if [ -z "$url" ]; then printf "  MISSING %-16s %s\n" "$code" "$title"; return 1; fi
  # Wikimedia serves an HTML error page when it throttles. A non-empty check
  # happily saves that as a .svg, so the content itself must be checked.
  if curl -sS --max-time 60 -A "$UA" -o "$out" "$url" && [ -s "$out" ] \
     && head -c 300 "$out" | grep -qiE '<svg|<\?xml'; then
    printf "  got     %-16s %6s bytes\n" "$code" "$(stat -c%s "$out")"
  else
    rm -f "$out"; printf "  FAILED  %-16s %s\n" "$code" "$title"; return 1
  fi
  sleep 4
}

grab de-nw "Flag of North Rhine-Westphalia.svg"
grab de-rp "Flag of Rhineland-Palatinate.svg"
grab de-sl "Flag of Saarland.svg"
grab de-sn "Flag of Saxony.svg"
grab de-st "Flag of Saxony-Anhalt.svg"
grab de-sh "Flag of Schleswig-Holstein.svg"
grab de-th "Flag of Thuringia.svg"

grab cac-toronto       "Flag of Toronto, Canada.svg"
grab cac-ottawa        "Flag of Ottawa, Ontario.svg"
grab cac-montreal      "Flag of Montreal.svg"
grab cac-vancouver     "Flag of Vancouver.svg"
grab cac-winnipeg      "Flag of Winnipeg.svg"
grab cac-quebeccity    "Flag of Quebec City.svg"
grab cac-mississauga   "Flag of Mississauga, Ontario.svg"
grab cac-thunderbay    "Flag of Thunder Bay.svg"
grab cac-guelph        "Flag of Guelph.svg"
grab cac-charlottetown "Flag of Charlottetown.svg"
grab cac-vaughan       "Flag of Vaughan,Ontario.svg"
grab cac-sudbury       "Flag of Sudbury Ontario.svg"
grab cac-peterborough  "Flag of Peterborough, Ontario.svg"

echo "cached total: $(ls "$CACHE" | wc -l)"
