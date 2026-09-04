# Halyard — harvest sub-national flags from Wikimedia Commons into lazy packs.
#
# These are far too big to sit in the core bundle (the US states alone are
# ~7.7MB of detailed seals), so each set becomes its own pack file that the app
# fetches only when you enable it. The service worker caches it on first use, so
# it is available offline from then on.
#
# Re-runnable:  python build/harvest-subnational.py
import json
import os
import re
import time
import urllib.parse
import urllib.request

UA = "HalyardFlagGame/1.0 (personal hobby project; github.com/RobertWalterJ/halyard)"
API = "https://commons.wikimedia.org/w/api.php"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "app", "data", "packs")
CACHE = os.path.join(ROOT, "sources", "commons")

# code, display name, capital, Commons file title
CA_PROV = [
    ("ca-ab", "Alberta", "Edmonton", "Flag of Alberta.svg"),
    ("ca-bc", "British Columbia", "Victoria", "Flag of British Columbia.svg"),
    ("ca-mb", "Manitoba", "Winnipeg", "Flag of Manitoba.svg"),
    ("ca-nb", "New Brunswick", "Fredericton", "Flag of New Brunswick.svg"),
    ("ca-nl", "Newfoundland and Labrador", "St. John's", "Flag of Newfoundland and Labrador.svg"),
    ("ca-nt", "Northwest Territories", "Yellowknife", "Flag of the Northwest Territories.svg"),
    ("ca-ns", "Nova Scotia", "Halifax", "Flag of Nova Scotia.svg"),
    ("ca-nu", "Nunavut", "Iqaluit", "Flag of Nunavut.svg"),
    ("ca-on", "Ontario", "Toronto", "Flag of Ontario.svg"),
    ("ca-pe", "Prince Edward Island", "Charlottetown", "Flag of Prince Edward Island.svg"),
    ("ca-qc", "Quebec", "Quebec City", "Flag of Quebec.svg"),
    ("ca-sk", "Saskatchewan", "Regina", "Flag of Saskatchewan.svg"),
    ("ca-yt", "Yukon", "Whitehorse", "Flag of Yukon.svg"),
]

US_STATES = [
    ("us-al", "Alabama", "Montgomery"), ("us-ak", "Alaska", "Juneau"),
    ("us-az", "Arizona", "Phoenix"), ("us-ar", "Arkansas", "Little Rock"),
    ("us-ca", "California", "Sacramento"), ("us-co", "Colorado", "Denver"),
    ("us-ct", "Connecticut", "Hartford"), ("us-de", "Delaware", "Dover"),
    ("us-fl", "Florida", "Tallahassee"), ("us-ga", "Georgia", "Atlanta"),
    ("us-hi", "Hawaii", "Honolulu"), ("us-id", "Idaho", "Boise"),
    ("us-il", "Illinois", "Springfield"), ("us-in", "Indiana", "Indianapolis"),
    ("us-ia", "Iowa", "Des Moines"), ("us-ks", "Kansas", "Topeka"),
    ("us-ky", "Kentucky", "Frankfort"), ("us-la", "Louisiana", "Baton Rouge"),
    ("us-me", "Maine", "Augusta"), ("us-md", "Maryland", "Annapolis"),
    ("us-ma", "Massachusetts", "Boston"), ("us-mi", "Michigan", "Lansing"),
    ("us-mn", "Minnesota", "Saint Paul"), ("us-ms", "Mississippi", "Jackson"),
    ("us-mo", "Missouri", "Jefferson City"), ("us-mt", "Montana", "Helena"),
    ("us-ne", "Nebraska", "Lincoln"), ("us-nv", "Nevada", "Carson City"),
    ("us-nh", "New Hampshire", "Concord"), ("us-nj", "New Jersey", "Trenton"),
    ("us-nm", "New Mexico", "Santa Fe"), ("us-ny", "New York", "Albany"),
    ("us-nc", "North Carolina", "Raleigh"), ("us-nd", "North Dakota", "Bismarck"),
    ("us-oh", "Ohio", "Columbus"), ("us-ok", "Oklahoma", "Oklahoma City"),
    ("us-or", "Oregon", "Salem"), ("us-pa", "Pennsylvania", "Harrisburg"),
    ("us-ri", "Rhode Island", "Providence"), ("us-sc", "South Carolina", "Columbia"),
    ("us-sd", "South Dakota", "Pierre"), ("us-tn", "Tennessee", "Nashville"),
    ("us-tx", "Texas", "Austin"), ("us-ut", "Utah", "Salt Lake City"),
    ("us-vt", "Vermont", "Montpelier"), ("us-va", "Virginia", "Richmond"),
    ("us-wa", "Washington", "Olympia"), ("us-wv", "West Virginia", "Charleston"),
    ("us-wi", "Wisconsin", "Madison"), ("us-wy", "Wyoming", "Cheyenne"),
]

DE_STATES = [
    ("de-bw", "Baden-Württemberg", "Stuttgart", "Flag of Baden-Württemberg.svg"),
    ("de-by", "Bavaria", "Munich", "Flag of Bavaria.svg"),
    ("de-be", "Berlin", "Berlin", "Flag of Berlin.svg"),
    ("de-bb", "Brandenburg", "Potsdam", "Flag of Brandenburg.svg"),
    ("de-hb", "Bremen", "Bremen", "Flag of Bremen.svg"),
    ("de-hh", "Hamburg", "Hamburg", "Flag of Hamburg.svg"),
    ("de-he", "Hesse", "Wiesbaden", "Flag of Hesse.svg"),
    ("de-ni", "Lower Saxony", "Hanover", "Flag of Lower Saxony.svg"),
    ("de-mv", "Mecklenburg-Western Pomerania", "Schwerin", "Flag of Mecklenburg-Western Pomerania.svg"),
    ("de-nw", "North Rhine-Westphalia", "Düsseldorf", "Flag of North Rhine-Westphalia.svg"),
    ("de-rp", "Rhineland-Palatinate", "Mainz", "Flag of Rhineland-Palatinate.svg"),
    ("de-sl", "Saarland", "Saarbrücken", "Flag of Saarland.svg"),
    ("de-sn", "Saxony", "Dresden", "Flag of Saxony.svg"),
    ("de-st", "Saxony-Anhalt", "Magdeburg", "Flag of Saxony-Anhalt.svg"),
    ("de-sh", "Schleswig-Holstein", "Kiel", "Flag of Schleswig-Holstein.svg"),
    ("de-th", "Thuringia", "Erfurt", "Flag of Thuringia.svg"),
]

# Only the ones that actually exist as a current flag on Commons — several
# large Canadian cities (Calgary, Halifax, Victoria) simply have none.
# Titles were found by searching Commons, not guessed — guessing resolved only a
# third of them. Deliberately excluded: "Flag of Hamilton.svg", which is
# ambiguous between Hamilton Ontario, Hamilton New Zealand and Hamilton Bermuda.
# A wrong flag is worse than a missing one.
CA_CITIES = [
    ("cac-toronto", "Toronto", "Ontario", "Flag of Toronto, Canada.svg"),
    ("cac-ottawa", "Ottawa", "Ontario", "Flag of Ottawa, Ontario.svg"),
    ("cac-montreal", "Montreal", "Quebec", "Flag of Montreal.svg"),
    ("cac-vancouver", "Vancouver", "British Columbia", "Flag of Vancouver.svg"),
    ("cac-winnipeg", "Winnipeg", "Manitoba", "Flag of Winnipeg.svg"),
    ("cac-quebeccity", "Quebec City", "Quebec", "Flag of Quebec City.svg"),
    ("cac-mississauga", "Mississauga", "Ontario", "Flag of Mississauga, Ontario.svg"),
    ("cac-thunderbay", "Thunder Bay", "Ontario", "Flag of Thunder Bay.svg"),
    ("cac-guelph", "Guelph", "Ontario", "Flag of Guelph.svg"),
    ("cac-charlottetown", "Charlottetown", "Prince Edward Island", "Flag of Charlottetown.svg"),
    ("cac-vaughan", "Vaughan", "Ontario", "Flag of Vaughan,Ontario.svg"),
    ("cac-sudbury", "Greater Sudbury", "Ontario", "Flag of Sudbury Ontario.svg"),
    ("cac-peterborough", "Peterborough", "Ontario", "Flag of Peterborough, Ontario.svg"),
]


def api(params):
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params),
                                 headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def resolve(titles):
    """Commons title -> {url, licence, artist}."""
    out = {}
    for i in range(0, len(titles), 30):
        chunk = titles[i:i + 30]
        d = api({"action": "query", "format": "json", "prop": "imageinfo",
                 "iiprop": "url|size|extmetadata", "redirects": "1",
                 "titles": "|".join("File:" + t for t in chunk)})
        norm = {}
        for n in d.get("query", {}).get("normalized", []) + d.get("query", {}).get("redirects", []):
            norm[n["to"]] = n["from"]
        for _, v in d.get("query", {}).get("pages", {}).items():
            title = v.get("title", "")
            orig = norm.get(title, title).replace("File:", "")
            if "missing" in v:
                out[orig] = None
                continue
            ii = v.get("imageinfo", [{}])[0]
            em = ii.get("extmetadata", {})
            out[orig] = {
                "url": ii.get("url"),
                "size": ii.get("size", 0),
                "licence": (em.get("LicenseShortName", {}) or {}).get("value", "?"),
                "artist": re.sub("<[^>]+>", "", (em.get("Artist", {}) or {}).get("value", "") or "")[:80],
                "title": title.replace("File:", ""),
            }
    return out


def fetch(url, cache_name):
    """Download once, then serve from sources/commons/ on every later run.

    Commons rate-limits, so this backs off on 429 rather than hammering, and
    caches to disk so a re-run costs no requests at all.
    """
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, cache_name)
    if os.path.exists(path):
        return open(path, encoding="utf-8").read()
    # HALYARD_OFFLINE=1 builds strictly from what is already cached. Commons
    # throttles hard, so this makes the build reproducible without re-hitting it.
    if os.environ.get("HALYARD_OFFLINE") == "1":
        raise FileNotFoundError(f"not cached: {cache_name}")
    delay = 1.0
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as r:
                body = r.read().decode("utf-8", "replace")
            open(path, "w", encoding="utf-8").write(body)
            time.sleep(1.0)      # ~1 req/sec sustained
            return body
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503):
                raise
            print(f"      rate-limited, waiting {delay:.0f}s")
            time.sleep(delay)
            delay = min(delay * 2, 30)
    raise RuntimeError(f"gave up fetching {url}")


ID_ATTR = re.compile(r'\bid\s*=\s*"([^"]+)"')


def prepare(svg, code):
    """Strip cruft, guarantee a viewBox, and namespace every internal id.

    The id work is not optional: Browse renders hundreds of flags into one
    document, and Commons files reuse generic ids like "a" or "path1". Without
    namespacing, url(#a) in one flag resolves against another flag's gradient
    and the artwork corrupts.
    """
    svg = re.sub(r"<\?xml[^>]*\?>", "", svg)
    # Some Commons files carry a DOCTYPE with an internal subset declaring XML
    # entities. A naive <!DOCTYPE[^>]*> stops at the first ">" inside that
    # subset and leaves the declarations behind, and the entity references it
    # defines (xmlns="&ns_svg;") cannot resolve once the markup is injected as
    # innerHTML — the flag then renders as nothing at all.
    svg = re.sub(r"<!DOCTYPE[^>\[]*(\[[\s\S]*?\])?\s*>", "", svg, flags=re.I)
    svg = re.sub(r"^\s*\]>", "", svg)          # stray close of an internal subset
    svg = svg.replace("&ns_svg;", "http://www.w3.org/2000/svg")
    svg = svg.replace("&ns_xlink;", "http://www.w3.org/1999/xlink")
    if "&ns_" in svg:
        raise ValueError("unresolved XML entity reference")
    svg = re.sub(r"<!--.*?-->", "", svg, flags=re.S)
    svg = re.sub(r"<metadata>.*?</metadata>", "", svg, flags=re.S | re.I)
    svg = re.sub(r"<sodipodi:namedview[^>]*/>", "", svg, flags=re.I)
    svg = re.sub(r">\s+<", "><", svg)
    svg = re.sub(r"\s{2,}", " ", svg).strip()

    m = re.search(r"<svg\b[^>]*>", svg)
    if not m:
        raise ValueError(f"{code}: no <svg> element")
    tag = m.group(0)

    # guarantee a viewBox so the flag scales into our 4:3 card
    if "viewBox" not in tag:
        w = re.search(r'\bwidth\s*=\s*"([\d.]+)', tag)
        h = re.search(r'\bheight\s*=\s*"([\d.]+)', tag)
        if not (w and h):
            raise ValueError(f"{code}: no viewBox and no usable width/height")
        newtag = tag[:-1] + f' viewBox="0 0 {w.group(1)} {h.group(1)}">'
        svg = svg.replace(tag, newtag, 1)
        tag = newtag

    # drop fixed pixel sizes; the container decides how big a flag is
    newtag = re.sub(r'\s\b(width|height)\s*=\s*"[^"]*"', "", tag)
    svg = svg.replace(tag, newtag, 1)

    ids = set(ID_ATTR.findall(svg))
    for i in sorted(ids, key=len, reverse=True):
        safe = f"{code}-{i}"
        svg = svg.replace(f'id="{i}"', f'id="{safe}"')
        svg = svg.replace(f"url(#{i})", f"url(#{safe})")
        svg = svg.replace(f'href="#{i}"', f'href="#{safe}"')
        svg = svg.replace(f'xlink:href="#{i}"', f'xlink:href="#{safe}"')
    return svg


def build(pack_id, label, note, region, entries, parent_of, title_of, capital_of=lambda e: e[2], extra=None):
    titles = [title_of(e) for e in entries]
    if os.environ.get("HALYARD_OFFLINE") == "1":
        # cached files are named by code, so no lookup is needed
        meta = {title_of(e): {"url": "", "title": title_of(e), "licence": "see Commons",
                              "artist": "", "size": 0} for e in entries}
    else:
        meta = resolve(titles)
    flags, svgs, credits = [], {}, []
    missing = []
    for e in entries:
        code = e[0]
        title = title_of(e)
        info = meta.get(title)
        if not info:
            missing.append(title)
            continue
        try:
            raw = fetch(info["url"], code + ".svg")
            svg = prepare(raw, code)
        except (ValueError, FileNotFoundError) as err:
            missing.append(f"{title} ({err})")
            continue
        flags.append({
            "code": code, "name": e[1], "group": "subdivision", "pack": pack_id,
            "region": region, "subregion": parent_of(e), "capital": capital_of(e),
            "pop": None, "tier": 2, "colours": [], "near": [], "parent": parent_of(e),
        })
        svgs[code] = svg
        credits.append({"code": code, "file": info["title"],
                        "licence": info["licence"], "artist": info["artist"]})
    # A second group folded into the same pack (Canadian cities alongside the
    # provinces): 3 city flags cannot fill a 4-option question on their own, and
    # they have no capital so Capitals mode skips them automatically.
    for spec in (extra or []):
        emeta = ({spec["title_of"](e): {"url": "", "title": spec["title_of"](e),
                                        "licence": "see Commons", "artist": "", "size": 0}
                  for e in spec["entries"]}
                 if os.environ.get("HALYARD_OFFLINE") == "1"
                 else resolve([spec["title_of"](e) for e in spec["entries"]]))
        for e in spec["entries"]:
            info = emeta.get(spec["title_of"](e))
            if not info:
                missing.append(spec["title_of"](e))
                continue
            try:
                raw = fetch(info["url"], e[0] + ".svg")
                svg = prepare(raw, e[0])
            except (ValueError, FileNotFoundError) as err:
                missing.append(f"{spec['title_of'](e)} ({err})")
                continue
            flags.append({
                "code": e[0], "name": e[1], "group": "subdivision", "pack": pack_id,
                "region": region, "subregion": spec["parent_of"](e),
                "capital": spec["capital_of"](e), "pop": None, "tier": 2,
                "colours": [], "near": [], "parent": spec["parent_of"](e),
            })
            svgs[e[0]] = svg
            credits.append({"code": e[0], "file": info["title"],
                            "licence": info["licence"], "artist": info["artist"]})

    out = {"pack": pack_id, "label": label, "note": note,
           "source": "Wikimedia Commons", "credits": credits,
           "flags": flags, "svgs": svgs}
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, pack_id + ".json")
    body = json.dumps(out)
    open(path, "w", encoding="utf-8").write(body)
    print(f"  {pack_id:12} {len(flags):3} flags  {len(body)/1024/1024:5.2f} MB"
          + (f"   MISSING: {len(missing)}" if missing else ""))
    for m in missing:
        print(f"      - {m}")
    return {"id": pack_id, "label": label, "note": note, "count": len(flags),
            "bytes": len(body)}


if __name__ == "__main__":
    print("harvesting sub-national packs from Wikimedia Commons")
    summary = []
    summary.append(build("ca-prov", "Canada", "Provinces, territories & cities", "Americas",
                         CA_PROV, lambda e: "Canada", lambda e: e[3],
                         extra=[{"entries": CA_CITIES,
                                 "parent_of": lambda e: e[2],
                                 "capital_of": lambda e: None,
                                 "title_of": lambda e: e[3]}]))
    summary.append(build("us-states", "United States", "States", "Americas",
                         [(c, n, cap) for c, n, cap in US_STATES],
                         lambda e: "United States",
                         lambda e: f"Flag of {e[1]}.svg" if e[1] != "Georgia" else "Flag of Georgia (U.S. state).svg"))
    summary.append(build("de-states", "Germany", "States", "Europe",
                         DE_STATES, lambda e: "Germany", lambda e: e[3]))

    print("\nsummary:")
    for s in summary:
        print(f"  {s['id']:12} {s['count']:3} flags  {s['bytes']/1024/1024:5.2f} MB")
    print(f"  TOTAL        {sum(s['count'] for s in summary):3} flags  "
          f"{sum(s['bytes'] for s in summary)/1024/1024:5.2f} MB")
