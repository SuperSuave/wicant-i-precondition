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
            # Fall back to single app.js if running before full migration
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