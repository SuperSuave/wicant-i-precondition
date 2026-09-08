#!/usr/bin/env python3
"""
Lightweight, dependency-free HTML/CSS/JS bundler and minifier for WiCAN firmware web assets.
Assembles files from main/ui_src/, minifies them, and generates gzipped firmware payloads.
"""

import gzip
import os
import re
import sys


def bundle_and_minify(
    src_dir="main/ui_src",
    full_dst_path="main/homepage_full.html",
    min_dst_path="main/homepage.html",
    catalog_path="main/can_do_catalog.json",
):
    # Guard against legacy invocations passing a file path instead of a directory
    if os.path.isfile(src_dir) or not os.path.isdir(src_dir):
        # Fall back to finding ui_src relative to the file or project root
        candidate_dir = os.path.join(os.path.dirname(src_dir), "ui_src")
        if os.path.isdir(candidate_dir):
            src_dir = candidate_dir
        elif os.path.isdir("main/ui_src"):
            src_dir = "main/ui_src"
        else:
            print(f"Error: Source directory '{src_dir}' not found.")
            sys.exit(1)

    required_files = {
        "html": os.path.join(src_dir, "index.html"),
        "css": os.path.join(src_dir, "styles.css"),
        "svg": os.path.join(src_dir, "icons.svg"),
        "js": os.path.join(src_dir, "app.js"),
    }

    for name, path in required_files.items():
        if not os.path.exists(path):
            print(f"Error: Missing required component: {path}")
            sys.exit(1)

    with open(required_files["html"], "r", encoding="utf-8") as f:
        html_content = f.read()
    with open(required_files["css"], "r", encoding="utf-8") as f:
        css_content = f.read()
    with open(required_files["svg"], "r", encoding="utf-8") as f:
        svg_content = f.read()
    with open(required_files["js"], "r", encoding="utf-8") as f:
        js_content = f.read()

    # 1. Assemble individual assets into full HTML
    content = html_content
    content = content.replace("<!-- BUILD_CSS -->", f"<style>\n{css_content}\n</style>")
    content = content.replace(
        "<!-- BUILD_ICONS -->",
        f'<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">\n{svg_content}\n</svg>',
    )
    content = content.replace("<!-- BUILD_JS -->", f"<script>\n{js_content}\n</script>")

    # Save full unminified version for local browser preview/debugging
    with open(full_dst_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)

    # 2. Compress the external catalog if present
    if os.path.exists(catalog_path):
        cat_gz = catalog_path + ".gz"
        with open(catalog_path, "rb") as f_in, gzip.open(cat_gz, "wb", compresslevel=9) as f_out:
            f_out.write(f_in.read())
        cat_orig = os.path.getsize(catalog_path)
        cat_gz_sz = os.path.getsize(cat_gz)
        cat_pct = ((cat_orig - cat_gz_sz) / cat_orig) * 100 if cat_orig > 0 else 0
        print(f"Compressed {catalog_path} -> {cat_gz}: {cat_orig:,} B -> {cat_gz_sz:,} B (-{cat_pct:.1f}%)")

    # 3. Strip HTML comments
    content = re.sub(r"<!--(?!\[if).*?-->", "", content, flags=re.DOTALL)

    # 4. Minify embedded <style> blocks
    def minify_css(match):
        css = match.group(1)
        css = re.sub(r"/\*.*?\*/", "", css, flags=re.DOTALL)
        css = re.sub(r"\s+", " ", css)
        css = re.sub(r"\s*([\{\}:;,])\s*", r"\1", css)
        return f"<style>{css.strip()}</style>"

    content = re.sub(r"<style[^>]*>(.*?)</style>", minify_css, content, flags=re.DOTALL)

    # 5. Minify embedded <script> blocks
    def minify_js(match):
        js = match.group(1)
        js = re.sub(r"/\*.*?\*/", "", js, flags=re.DOTALL)
        lines = []
        for line in js.splitlines():
            l = line.strip()
            if not l or l.startswith("//"):
                continue
            lines.append(l)
        return "<script>\n" + "\n".join(lines) + "\n</script>"

    content = re.sub(r"<script[^>]*>(.*?)</script>", minify_js, content, flags=re.DOTALL)

    # 6. Collapse redundant whitespace and blank lines
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    minified = "\n".join(lines)

    with open(min_dst_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(minified)

    # 7. Gzip compress HTML for ESP32 flash embedding
    gz_path = min_dst_path if min_dst_path.endswith(".gz") else (min_dst_path + ".gz")
    with open(min_dst_path, "rb") as f_in, gzip.open(gz_path, "wb", compresslevel=9) as f_out:
        f_out.write(f_in.read())

    orig_sz = os.path.getsize(full_dst_path)
    min_sz = os.path.getsize(min_dst_path)
    gz_sz = os.path.getsize(gz_path)
    saved = orig_sz - gz_sz
    pct = (saved / orig_sz) * 100 if orig_sz > 0 else 0
    print(
        f"Bundled & Gzipped {src_dir} -> {gz_path}: {orig_sz:,} B -> {gz_sz:,} B (Saved {saved/1024:.1f} KB, -{pct:.1f}%)"
    )


if __name__ == "__main__":
    # If the first argument passed was a file (e.g. main/homepage_full.html), route src_dir to main/ui_src
    first_arg = sys.argv[1] if len(sys.argv) > 1 else "main/ui_src"
    if first_arg.endswith(".html"):
        src = "main/ui_src"
        full_dst = first_arg
        min_dst = sys.argv[2] if len(sys.argv) > 2 else "main/homepage.html"
    else:
        src = first_arg
        full_dst = sys.argv[2] if len(sys.argv) > 2 else "main/homepage_full.html"
        min_dst = sys.argv[3] if len(sys.argv) > 3 else "main/homepage.html"

    catalog = "main/can_do_catalog.json"
    bundle_and_minify(src, full_dst, min_dst, catalog)