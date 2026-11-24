#!/bin/sh
# Builds lightdraw's client into public/draw and the Worker into build/. Both
# are committed, so Cloudflare deploys them without a Rust toolchain. Run this
# and commit its output after changing src/ or lightdraw. LIGHTDRAW names the
# checkout.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
lightdraw=${LIGHTDRAW:-$here/../../lightdraw}
cd "$here"
rm -rf public/draw
(cd "$lightdraw/crates/client" && trunk build --release --public-url /draw/ --dist "$here/public/draw")
PATH=.tools/bin:$PATH worker-build --release
# worker-build ignores its own output and adds a shim that wrangler doesn't need.
rm -rf build/.gitignore build/worker
