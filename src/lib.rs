//! andrewyao.app. Pages are static assets, served before this Worker runs.
//! `/draw/ws/{room}` reaches the lightdraw room of that name, one Durable
//! Object per room.

mod room;

use worker::{Context, Env, Request, Response, Result, event};

#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let path = req.path();
    if let Some(name) = path.strip_prefix("/draw/ws/") {
        if !room::valid(name) {
            return Response::error("room must match ^[a-z0-9-]{1,64}$", 400);
        }
        if req.headers().get("Upgrade")?.as_deref() != Some("websocket") {
            return Response::error("expected a WebSocket upgrade", 426);
        }
        let stub = env.durable_object("ROOMS")?.get_by_name(name)?;
        return stub.fetch_with_request(req).await;
    }
    env.assets("ASSETS")?.fetch_request(req).await
}
