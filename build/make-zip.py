# Halyard — package dist/web as a deployable zip.
# Uses POSIX separators in the archive: Windows tooling writes backslashes,
# which some static hosts expand into files literally named "data\flags.json"
# instead of a data/ directory.
# Run from the project root:  python build/make-zip.py
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "dist", "web")
OUT = os.path.join(ROOT, "dist", "halyard-web.zip")

if not os.path.isdir(SITE):
    raise SystemExit("dist/web missing — run build/bundle-single.mjs and the copy step first")

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for dirpath, _, files in os.walk(SITE):
        for f in sorted(files):
            full = os.path.join(dirpath, f)
            arc = os.path.relpath(full, SITE).replace(os.sep, "/")
            z.write(full, arc)

with zipfile.ZipFile(OUT) as z:
    names = sorted(z.namelist())
    bad = [n for n in names if chr(92) in n]
    print("entries:", len(names))
    for n in names:
        print("   ", n)
    print("backslash paths:", bad if bad else "none")

print("size: %.0f KB" % (os.path.getsize(OUT) / 1024))
print("wrote:", OUT)
