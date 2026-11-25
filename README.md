# andrewyao.app

Static files only. Cloudflare serves `public/` from the `andrewyao-app` Worker,
bound to the `andrewyao.app` custom domain. Pushing to `main` deploys it through
Workers Builds.

`public/draw/` is the [lightdraw](https://github.com/andrewyao/lightdraw)
client, built and copied here by lightdraw's `scripts/deploy-web.sh`. Its rooms,
at `/draw/ws/{room}`, are a separate Worker in lightdraw (`crates/cloudflare`),
routed at `andrewyao.app/draw/ws/*` in front of this one.

## Update lightdraw

```sh
cd ../../lightdraw && scripts/deploy-web.sh
```

That deploys the rooms Worker and rebuilds `public/draw`. Then commit and push
here, so the client and the Worker come from the same lightdraw revision.

## Run locally

```sh
npm install
npm run dev
```

Opens on http://localhost:8787. Rooms don't run here, so `/draw/` can't join one.
