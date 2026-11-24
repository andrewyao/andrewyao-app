#!/bin/sh
# Builds lightdraw's client into public/draw. LIGHTDRAW names the checkout.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
lightdraw=${LIGHTDRAW:-$here/../../lightdraw}
rm -rf "$here/public/draw"
cd "$lightdraw/crates/client"
trunk build --release --public-url /draw/ --dist "$here/public/draw"
