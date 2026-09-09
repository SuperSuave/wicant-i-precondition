import gzip
import os
import re
import sys


def minify_js_code(js_code):
    # Strip block comments /* ... */
    js_code = re.sub(r'/\*.*?\*/', '', js_code, flags=re.DOTALL)

    lines = []
    for line in js_code.splitlines():
        l = line.strip()
        if not l:
            continue
        # Strip pure single-line comment lines
        if l.startswith('//'):
            continue
        # Remove trailing comments if space preceded and not in URL
        if ' //' in l and not ('http://' in l or 'https://' in l):
            l = l.split(' //')[0].strip()
        lines.append(l)
    return '\n'.join(lines)


def minify_css_code(css_code):
    css = re.sub(r'/\*.*?\*/', '', css_code, flags=re.DOTALL)
    css = re.sub(r'\s+', ' ', css)
    css = re.sub(r'\s*([\{\}:;,])\s*', r'\1', css)
    return css.strip()


def bundle_and_minify(
    src_dir="main/ui_src",
    full_dst_path="main/homepage_full.html",
    min_dst_path="main/homepage.html",
    catalog_path="main/can_do_catalog.json",
):
    if os.path.isfile(src_dir) or not os.path.isdir(src_dir):
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

    # Concatenate modular JS files in dependency order
    js_modules = [
        "js/network.js",
        "js/ui.js",
        "js/wifi.js",
        "js/system.js",
        "js/time.js",
        "js/can_hardware.js",
        "js/auto_pid.js",
        "js/dashboard.js",
        # --- CAN Do Sub-System ---
        "js/can_do/catalog.js",
        "js/can_do/byte_grid.js",
        "js/can_do/elements.js",
        "js/can_do/dialog.js",
        "js/can_do/rules_engine.js",
        "js/can_do/storage.js",
        # --- App Bootstrap ---
        "js/app.js",
    ]

    js_parts = []
    for rel_path in js_modules:
        full_path = os.path.join(src_dir, rel_path)
        if os.path.exists(full_path):
            with open(full_path, "r", encoding="utf-8") as f:
                js_parts.append(f"/* === {rel_path} === */\n" + f.read())
        else:
            single_app = os.path.join(src_dir, "app.js")
            if os.path.exists(single_app) and not js_parts:
                with open(single_app, "r", encoding="utf-8") as f:
                    js_parts.append(f.read())
                break
            else:
                print(f"Error: Missing required JS module: {full_path}")
                sys.exit(1)

    js_content = "\n\n".join(js_parts)

    # 1. Assemble individual assets into full HTML
    content = html_content
    content = content.replace("<!-- BUILD_CSS -->", f"<style>\n{css_content}\n</style>")
    content = content.replace(
        "<!-- BUILD_ICONS -->",
        f'<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">\n{svg_content}\n</svg>',
    )
    content = content.replace("<!-- BUILD_JS -->", f"<script>\n{js_content}\n</script>")

    # Save full unminified assembly
    with open(full_dst_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)

    # 2. Minify HTML content
    minified = re.sub(r'<!--(?!\[if).*?-->', '', content, flags=re.DOTALL)

    def css_replacer(match):
        return f'<style>{minify_css_code(match.group(1))}</style>'

    minified = re.sub(r'<style[^>]*>(.*?)</style>', css_replacer, minified, flags=re.DOTALL)

    def js_replacer(match):
        return f'<script>\n{minify_js_code(match.group(1))}\n</script>'

    minified = re.sub(r'<script[^>]*>(.*?)</script>', js_replacer, minified, flags=re.DOTALL)

    lines = [line.strip() for line in minified.splitlines() if line.strip()]
    minified_final = '\n'.join(lines)

    # Save minified HTML
    with open(min_dst_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(minified_final)

    # Gzip compress minified HTML
    gz_path = min_dst_path + ".gz"
    with open(min_dst_path, "rb") as f_in, gzip.open(gz_path, "wb", compresslevel=9) as f_out:
        f_out.write(f_in.read())

    orig_sz = len(content.encode("utf-8"))
    min_sz = os.path.getsize(min_dst_path)
    gz_sz = os.path.getsize(gz_path)
    saved = orig_sz - gz_sz
    pct = (saved / orig_sz) * 100 if orig_sz > 0 else 0
    print(f"Bundled & Minified HTML -> {gz_path}: {orig_sz:,} B -> {min_sz:,} B (Minified) -> {gz_sz:,} B (Gzipped) (Saved {saved:,} B / {saved/1024:.1f} KB, -{pct:.1f}%)")

    # Gzip compress can_do_catalog.json if present
    if os.path.exists(catalog_path):
        catalog_gz = catalog_path + ".gz"
        with open(catalog_path, "rb") as f_in, gzip.open(catalog_gz, "wb", compresslevel=9) as f_out:
            f_out.write(f_in.read())
        cat_sz = os.path.getsize(catalog_path)
        cat_gz_sz = os.path.getsize(catalog_gz)
        print(f"Compressed Catalog -> {catalog_gz}: {cat_sz:,} B -> {cat_gz_sz:,} B")


if __name__ == "__main__":
    bundle_and_minify()
