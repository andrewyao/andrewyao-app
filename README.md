# andrewyao.app

One Cloudflare Worker. Static pages live in `public/`. `/draw/` is
[lightdraw](https://github.com/andrewyao/lightdraw): its client is built into
`public/draw`, and `/draw/ws/{room}` opens a room, one Durable Object per room
name. A room's edit log and snapshots live in that object's SQLite storage.
Anyone with a room's URL can edit it.

## Layout

- `src/lib.rs` routes `/draw/ws/{room}` to the room's Durable Object. Every other path is a static asset.
- `src/room.rs` is the Cloudflare port of lightdraw's `crates/server` room. It logs each record before sending it and snapshots every 1000 records or when the last socket leaves.
- `scripts/build.sh` (`npm run build`) builds the lightdraw client into `public/draw` with `--public-url /draw/`, and the Worker into `build/`.

The build output in `public/draw` and `build/` is committed, so Cloudflare's
builder deploys it with only Node and doesn't need Rust. After changing `src/` or
lightdraw, run `npm run build` and commit the result.

The Worker depends on lightdraw's `doc` crate by path, so lightdraw must be
checked out at `../../lightdraw` (or set `LIGHTDRAW` for the client build) to build.
Client and Worker must come from the same lightdraw revision, since they share
the wire format.

## Setup

```sh
npm install
cargo install worker-build --version 0.9.0 --locked --root .tools
```

Also needed: `trunk` and the `wasm32-unknown-unknown` Rust target.

## Run locally

```sh
npm run build
npm run dev
```

Opens on http://localhost:8787. Rooms persist under `.wrangler/state`.

## Deploy

```sh
npx wrangler login
npm run build
npm run deploy
```

Pushing to `main` also deploys, through Cloudflare's Workers Builds, which
deploys the committed build output as is.

`wrangler.toml` binds the Worker to the `andrewyao.app` custom domain, whose DNS
is on Cloudflare.
