# andrewyao.app

Static files only. Cloudflare serves `public/` from the `andrewyao-app` Worker,
bound to the `andrewyao.app` custom domain. Pushing to `main` deploys it through
Workers Builds.

`public/draw/` is the [lightdraw](https://github.com/andrewyao/lightdraw)
client, built and copied here by lightdraw's `scripts/deploy-web.sh`. Its rooms,
at `/draw/ws/{room}`, are a separate Worker in lightdraw (`crates/cloudflare`),
routed at `andrewyao.app/draw/ws/*` in front of this one.

`public/seek/` is the [lightandseek](https://github.com/andrewyao/lightandseek)
client, built the same way by lightandseek's `scripts/deploy-web.sh`. Its rooms,
at `/seek/ws/{room}`, are a Worker in lightandseek (`crates/cloudflare`), routed
at `andrewyao.app/seek/ws/*`.

## Update lightdraw

```sh
cd ../lightdraw && scripts/deploy-web.sh
```

That deploys the rooms Worker and rebuilds `public/draw`. Then commit and push
here, so the client and the Worker come from the same lightdraw revision.

## Update lightandseek

```sh
cd ../lightandseek && scripts/deploy-web.sh
```

Then commit and push here, as for lightdraw.

## The museum

`public/index.html` is a 3D gallery (Three.js, `public/museum/museum.js`). Each
app is a framed screenshot from `public/museum/*.jpg`, with a plaque built from
its entry in the page's `#exhibits` list. That list is also the page when WebGL
isn't available. To add an app, add an `<li>` there and a slot in `SLOTS`.

Three.js is vendored as one file. After bumping `three` in `package.json`:

```sh
npm install && npm run vendor
```

## Run locally

```sh
npm install
npm run dev
```

Opens on http://localhost:8787. Rooms don't run here, so `/draw/` and `/seek/`
can't join one.
