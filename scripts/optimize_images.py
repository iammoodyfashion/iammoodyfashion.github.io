#!/usr/bin/env python3
"""Resize photos and convert them to WebP for the built site.

Called by build-static.js (you normally never run this yourself):

    optimize_images.py --input list.json --out .cache/images --manifest manifest.json

`list.json` is [{"rel": "2024/12/photo.jpg", "src": "/absolute/path/photo.jpg"}, ...].
For every image it writes up to three WebP sizes (640, 1280, 1920 px wide; never upscaled) into --out
and a manifest describing them. Results are cached, so unchanged photos are skipped on the next build.
The original files are never modified. Requires Python 3 with Pillow (pip install pillow).
"""
import argparse
import hashlib
import io
import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image, ImageCms, ImageOps

Image.MAX_IMAGE_PIXELS = None
WIDTHS = [640, 1280, 1920]
JPEG_QUALITY = 78      # photos: visually clean, roughly a third of a typical JPEG's size
GRAPHIC_QUALITY = 90   # PNG sources (flyers, logos, text): keep edges crisp
VERSION = "1"          # bump when the settings above change, to invalidate the cache


def plan_widths(w):
    """640/1280/1920, never larger than the original, skipping sizes too close to the largest to be worth it."""
    top = min(w, WIDTHS[-1])
    return [x for x in WIDTHS if x <= top * 0.8] + [top]


def to_srgb(im):
    """Convert embedded color profiles (Display P3, Adobe RGB...) to sRGB so colors look right everywhere."""
    icc = im.info.get("icc_profile")
    if not icc or im.mode not in ("RGB", "RGBA"):
        return im
    try:
        src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        if "sRGB" in ImageCms.getProfileDescription(src):
            return im
        dst = ImageCms.createProfile("sRGB")
        alpha = im.getchannel("A") if im.mode == "RGBA" else None
        rgb = ImageCms.profileToProfile(im.convert("RGB"), src, dst, outputMode="RGB")
        if alpha is not None:
            rgb.putalpha(alpha)
        return rgb
    except Exception:
        return im  # unreadable profile: keep the pixels as they are


def normalise(im):
    """Upright (EXIF rotation), sRGB, and either RGB or RGBA (only when transparency is really used)."""
    im = ImageOps.exif_transpose(im)
    if im.mode == "P":
        im = im.convert("RGBA" if "transparency" in im.info else "RGB")
    elif im.mode in ("LA", "PA"):
        im = im.convert("RGBA")
    elif im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGB")
    im = to_srgb(im)
    if im.mode == "RGBA" and im.getchannel("A").getextrema()[0] == 255:
        im = im.convert("RGB")  # alpha channel present but fully opaque: drop it
    return im


def encode(im, is_graphic):
    """Return WebP bytes. For PNG-origin graphics try lossless too and keep it when it is not much bigger."""
    def lossy(q):
        b = io.BytesIO()
        im.save(b, "WEBP", quality=q, method=6, alpha_quality=100)
        return b.getvalue()
    if not is_graphic:
        return lossy(JPEG_QUALITY)
    b = io.BytesIO()
    im.save(b, "WEBP", lossless=True, method=6)
    lossless, lossy_data = b.getvalue(), lossy(GRAPHIC_QUALITY)
    return lossless if len(lossless) <= len(lossy_data) * 1.3 else lossy_data


def process(task):
    rel, src, out_dir = task["rel"], task["src"], Path(task["out"])
    st = os.stat(src)
    key = hashlib.sha1(f"{VERSION}|{rel}|{st.st_mtime_ns}|{st.st_size}".encode()).hexdigest()[:16]
    try:
        with Image.open(src) as opened:
            if getattr(opened, "is_animated", False) and opened.n_frames > 1:
                return rel, None, "animated image left as-is"
            orig_w, orig_h = ImageOps.exif_transpose(opened).size
            is_graphic = opened.format == "PNG"
            widths = plan_widths(orig_w)
            files = {w: out_dir / f"{key}-{w}.webp" for w in widths}
            if not all(f.exists() for f in files.values()):
                im = normalise(opened)
                for w in widths:
                    if files[w].exists():
                        continue
                    th = max(1, round(im.height * w / im.width))
                    resized = im if w >= im.width else im.resize((w, th), Image.LANCZOS)
                    files[w].write_bytes(encode(resized, is_graphic))
        variants = []
        for w in widths:
            with Image.open(files[w]) as v:
                variants.append({"w": v.width, "h": v.height, "file": files[w].name, "bytes": files[w].stat().st_size})
        return rel, {"w": orig_w, "h": orig_h, "srcBytes": st.st_size, "variants": variants}, None
    except Exception as e:  # one bad file must not stop the build; the original is used instead
        return rel, None, f"{type(e).__name__}: {e}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--manifest", required=True)
    args = ap.parse_args()

    items = json.loads(Path(args.input).read_text())
    Path(args.out).mkdir(parents=True, exist_ok=True)
    tasks = [{"rel": i["rel"], "src": i["src"], "out": args.out} for i in items]
    manifest, problems = {}, []
    workers = max(1, (os.cpu_count() or 2) - 1)
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for n, (rel, entry, note) in enumerate(pool.map(process, tasks), 1):
            if entry:
                manifest[rel] = entry
            else:
                problems.append((rel, note))
            if n % 10 == 0 or n == len(tasks):
                print(f"  images {n}/{len(tasks)}", file=sys.stderr, flush=True)
    Path(args.manifest).write_text(json.dumps(manifest))
    for rel, note in problems:
        print(f"  WARNING {rel}: {note} (original will be used)", file=sys.stderr)
    src = sum(e["srcBytes"] for e in manifest.values())
    out = sum(v["bytes"] for e in manifest.values() for v in e["variants"])
    top = sum(e["variants"][-1]["bytes"] for e in manifest.values())
    print(f"  {len(manifest)} images: {src / 1e6:.1f} MB originals -> {out / 1e6:.1f} MB WebP (all sizes); "
          f"largest size only: {top / 1e6:.1f} MB", file=sys.stderr)


if __name__ == "__main__":
    main()
