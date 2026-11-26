import * as THREE from "three";

// Room interior: x across, y up, z from the entrance (+) to the back wall (-).
const ROOM = { w: 11, h: 4.5, front: 7, back: -14 };
const HANG_Y = 2.1;
const ENTRANCE = { pos: new THREE.Vector3(0, 1.7, 6), look: new THREE.Vector3(0, 1.9, -14) };

// One slot per exhibit, in the list's order. `x`/`z` is where the picture hangs; the plaque sits to its right.
const half = ROOM.w / 2;
const SLOTS = [
  { x: -half, z: -1, ry: Math.PI / 2 },
  { x: -half, z: -8, ry: Math.PI / 2 },
  { x: -1, z: ROOM.back, ry: 0 },
  { x: half, z: -11, ry: -Math.PI / 2 },
  { x: half, z: -4, ry: -Math.PI / 2 },
];

const PLAQUE = { w: 1.2, h: 1.5, gap: 0.45 };
const FRAME = 0.12;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const exhibits = [...document.querySelectorAll("#exhibits > li")].map((li) => {
  const img = li.querySelector("img");
  return {
    id: li.id,
    name: li.querySelector("h2").textContent,
    built: li.dataset.built,
    openLabel: li.dataset.open,
    description: li.querySelector("p").textContent.trim(),
    href: li.querySelector("a").href,
    src: img.getAttribute("src"),
    aspect: +img.getAttribute("width") / +img.getAttribute("height"),
    link: li.querySelector("a"),
  };
});

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch {
  // No WebGL: the exhibit list stays as the page.
}
if (renderer) start();

function start() {
  document.body.classList.add("room");
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0c0a);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  buildRoom(scene, maxAniso);
  const paintings = exhibits.map((ex, i) => hang(scene, ex, SLOTS[i], maxAniso));
  const pickable = paintings.flatMap((p) => [p.picture, p.frame]);

  // Camera: tween between poses; `look` adds a little pointer parallax on top.
  const pose = { pos: ENTRANCE.pos.clone(), look: ENTRANCE.look.clone() };
  let tween = null;
  const pointer = new THREE.Vector2(0, 0);
  const lookOffset = new THREE.Vector3();

  function frameFor(p) {
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const d = 1.25 * Math.max(p.span.w / 2 / Math.tan(hfov / 2), p.span.h / 2 / Math.tan(vfov / 2));
    return {
      pos: p.group.localToWorld(new THREE.Vector3(p.span.cx, 0, d)),
      look: p.group.localToWorld(new THREE.Vector3(p.span.cx, 0, 0)),
    };
  }

  function moveTo(target) {
    if (reducedMotion) {
      pose.pos.copy(target.pos);
      pose.look.copy(target.look);
      tween = null;
      return;
    }
    tween = { from: { pos: pose.pos.clone(), look: pose.look.clone() }, to: target, t0: performance.now(), ms: 1000 };
  }

  // State lives in the URL hash, so Back, deep links and reloads all agree.
  let focused = null;
  const backBtn = document.getElementById("back");
  const openLink = document.getElementById("open");

  function sync() {
    const id = decodeURIComponent(location.hash.slice(1));
    focused = paintings.find((p) => p.ex.id === id) ?? null;
    document.body.classList.toggle("focused", !!focused);
    if (focused) {
      openLink.href = focused.ex.href;
      openLink.textContent = `${focused.ex.openLabel} ↗`;
    }
    moveTo(focused ? frameFor(focused) : ENTRANCE);
  }

  function focus(id) {
    history.pushState({ museum: true }, "", `#${id}`);
    sync();
  }

  function backToRoom() {
    if (!focused) return;
    if (history.state?.museum) history.back();
    else {
      history.replaceState(null, "", location.pathname + location.search);
      sync();
    }
  }

  addEventListener("popstate", sync);
  addEventListener("hashchange", sync);
  backBtn.addEventListener("click", backToRoom);
  // Full screen. iPhone Safari has no element full screen, so the button stays hidden there.
  const fsBtn = document.getElementById("fullscreen");
  const toggleFullscreen = () =>
    (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  if (document.fullscreenEnabled) {
    fsBtn.hidden = false;
    fsBtn.addEventListener("click", toggleFullscreen);
    addEventListener("fullscreenchange", () => {
      const on = !!document.fullscreenElement;
      fsBtn.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
      fsBtn.title = on ? "Exit full screen (F)" : "Full screen (F)";
    });
  }

  addEventListener("keydown", (e) => {
    if (e.key === "f" && document.fullscreenEnabled && !e.metaKey && !e.ctrlKey && !e.altKey) toggleFullscreen();
    if (e.key === "Escape") backToRoom();
    if (!focused || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const i = paintings.indexOf(focused) + (e.key === "ArrowRight" ? 1 : -1);
    history.replaceState({ museum: true }, "", `#${paintings[(i + paintings.length) % paintings.length].ex.id}`);
    sync();
  });

  // Keyboard users tab through the (visually hidden) exhibit links; show which picture they're on.
  for (const p of paintings) {
    p.ex.link.addEventListener("focus", () => setHover(p));
    p.ex.link.addEventListener("blur", () => setHover(null));
  }

  const raycaster = new THREE.Raycaster();
  let hovered = null;

  function pick(e) {
    const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pickable, false)[0];
    return hit ? paintings.find((p) => p.ex.id === hit.object.userData.id) : null;
  }

  function setHover(p) {
    if (hovered === p) return;
    if (hovered) hovered.frame.material.emissiveIntensity = 0;
    hovered = p;
    if (hovered) hovered.frame.material.emissiveIntensity = 0.35;
  }

  const canvas = renderer.domElement;
  canvas.addEventListener("pointermove", (e) => {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (e.pointerType !== "mouse") return;
    const p = pick(e);
    setHover(p);
    canvas.style.cursor = p ? "pointer" : "";
    canvas.title = p ? (p === focused ? `${p.ex.openLabel}` : p.ex.name) : "";
  });

  let downAt = null;
  canvas.addEventListener("pointerdown", (e) => (downAt = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener("click", (e) => {
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
    const p = pick(e);
    if (!p) return backToRoom();
    if (p === focused) location.href = p.ex.href;
    else if (focused) {
      history.replaceState({ museum: true }, "", `#${p.ex.id}`);
      sync();
    } else focus(p.ex.id);
  });

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    // Keep enough width in view on narrow screens to see both side walls.
    const minHalfH = THREE.MathUtils.degToRad(46);
    const vfov = 2 * Math.atan(Math.tan(minHalfH) / camera.aspect);
    camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vfov), 55, 90);
    camera.updateProjectionMatrix();
    if (focused) {
      const t = frameFor(focused);
      pose.pos.copy(t.pos);
      pose.look.copy(t.look);
      tween = null;
    }
  }
  addEventListener("resize", resize);
  resize();
  // Walk in from just outside the door on first load.
  pose.pos.add(new THREE.Vector3(0, 0.3, 3));
  sync();

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  renderer.setAnimationLoop((now) => {
    if (tween) {
      const t = Math.min(1, (now - tween.t0) / tween.ms);
      const k = ease(t);
      pose.pos.lerpVectors(tween.from.pos, tween.to.pos, k);
      pose.look.lerpVectors(tween.from.look, tween.to.look, k);
      if (t === 1) tween = null;
    }
    // Narrow screens see less of the room, so pointer / touch drags look further around.
    const sway = focused ? 0 : 1.2 / Math.min(camera.aspect, 1) ** 2;
    lookOffset.lerp(new THREE.Vector3(pointer.x * sway * 1.6, pointer.y * sway * 0.5, 0), reducedMotion ? 1 : 0.06);
    camera.position.copy(pose.pos);
    camera.lookAt(pose.look.clone().add(lookOffset.clone().applyQuaternion(camera.quaternion)));
    renderer.render(scene, camera);
  });
}

function hang(scene, ex, slot, maxAniso) {
  const portrait = ex.aspect < 1;
  const ph = portrait ? 2.7 : Math.min(2.4, 3.4 / ex.aspect);
  const pw = ph * ex.aspect;

  const group = new THREE.Group();
  group.position.set(slot.x, HANG_Y, slot.z);
  group.rotation.y = slot.ry;
  scene.add(group);

  const tex = new THREE.TextureLoader().load(ex.src);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  const picture = new THREE.Mesh(
    new THREE.PlaneGeometry(pw, ph),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  picture.position.z = 0.09;
  picture.userData.id = ex.id;

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(pw + FRAME * 2, ph + FRAME * 2, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.45, metalness: 0.2, emissive: 0xe8c77a, emissiveIntensity: 0 }),
  );
  frame.position.z = 0.04;
  frame.userData.id = ex.id;

  const mat = new THREE.Mesh(
    new THREE.PlaneGeometry(pw + 0.04, ph + 0.04),
    new THREE.MeshBasicMaterial({ color: 0x0b0907 }),
  );
  mat.position.z = 0.084;

  const plaqueX = pw / 2 + FRAME + PLAQUE.gap + PLAQUE.w / 2;
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(PLAQUE.w, PLAQUE.h),
    new THREE.MeshBasicMaterial({ map: plaqueTexture(ex, maxAniso), toneMapped: false }),
  );
  plaque.position.set(plaqueX, -0.25, 0.03);

  group.add(frame, mat, picture, plaque);

  const left = -pw / 2 - FRAME;
  const right = plaqueX + PLAQUE.w / 2;
  const span = { w: right - left, h: ph + FRAME * 2, cx: (left + right) / 2 };

  const spot = new THREE.SpotLight(0xfff1d6, 40, 0, 0.55, 0.7, 2);
  spot.position.copy(group.localToWorld(new THREE.Vector3(span.cx, ROOM.h - HANG_Y - 0.1, 1.8)));
  spot.target.position.copy(group.localToWorld(new THREE.Vector3(span.cx, -0.4, 0)));
  scene.add(spot, spot.target);

  return { ex, group, picture, frame, span };
}

function plaqueTexture(ex, maxAniso) {
  const W = 600, H = 750, pad = 54;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#f3ece0";
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "#c9bca6";
  g.lineWidth = 6;
  g.strokeRect(3, 3, W - 6, H - 6);

  g.fillStyle = "#1d1711";
  g.font = "600 64px Georgia, 'Times New Roman', serif";
  g.fillText(ex.name, pad, pad + 56);

  g.fillStyle = "#8a6a2e";
  g.font = "600 26px system-ui, sans-serif";
  g.fillText(`BUILT ${ex.built.toUpperCase()}`, pad, pad + 110);

  g.fillStyle = "#3b3128";
  g.font = "30px system-ui, sans-serif";
  let y = pad + 180;
  for (const line of wrap(g, ex.description, W - pad * 2)) {
    g.fillText(line, pad, y);
    y += 44;
  }

  g.fillStyle = "#8a6a2e";
  g.font = "italic 26px Georgia, serif";
  g.fillText("Click the picture to open →", pad, H - pad);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function wrap(g, text, width) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function buildRoom(scene, maxAniso) {
  const len = ROOM.front - ROOM.back;
  const zc = (ROOM.front + ROOM.back) / 2;

  const wall = new THREE.MeshStandardMaterial({ color: 0xe9e2d6, roughness: 0.95 });
  const floorTex = woodTexture(maxAniso);
  floorTex.repeat.set(ROOM.w / 2.5, len / 2.5);
  const floor = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 });
  const ceiling = new THREE.MeshStandardMaterial({ color: 0x2a2520, emissive: 0x6d645a, roughness: 1 });

  // BoxGeometry faces: +x, -x, +y, -y, +z, -z. Seen from inside, so BackSide.
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM.w, ROOM.h, len),
    [wall, wall, ceiling, floor, wall, wall].map((m) => {
      const c = m.clone();
      c.side = THREE.BackSide;
      return c;
    }),
  );
  room.position.set(0, ROOM.h / 2, zc);
  scene.add(room);

  // Baseboards and a picture rail give the walls some depth.
  const trim = new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 0.7 });
  const addTrim = (y, h) => {
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, len), trim);
      b.position.set(s * (half - 0.02), y, zc);
      scene.add(b);
    }
    const b = new THREE.Mesh(new THREE.BoxGeometry(ROOM.w, h, 0.04), trim);
    b.position.set(0, y, ROOM.back + 0.02);
    scene.add(b);
  };
  addTrim(0.09, 0.18);
  addTrim(ROOM.h - 0.5, 0.05);

  // Ceiling light strips.
  const glow = new THREE.MeshBasicMaterial({ color: 0xfff6e6 });
  for (const x of [-2.2, 2.2]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, len - 3), glow);
    strip.position.set(x, ROOM.h - 0.02, zc);
    scene.add(strip);
  }

  // A bench in the middle of the gallery.
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a7150, roughness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.8 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 3.2), wood);
  seat.position.set(0, 0.46, -5.5);
  scene.add(seat);
  for (const dz of [-1.3, 1.3]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.08), steel);
    leg.position.set(0, 0.21, -5.5 + dz);
    scene.add(leg);
  }

  scene.add(new THREE.HemisphereLight(0xfff4e2, 0x3a2e24, 1.1));
  const fill = new THREE.DirectionalLight(0xfff1dc, 0.6);
  fill.position.set(0, ROOM.h, ROOM.front);
  scene.add(fill);
}

function woodTexture(maxAniso) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  const plank = 64;
  for (let row = 0; row < 512 / plank; row++) {
    let x = -((row * 173) % 300);
    while (x < 512) {
      const len = 220 + ((row * 97 + x * 13) % 180);
      const shade = 0.85 + (((row * 31 + x * 7) % 100) / 100) * 0.25;
      g.fillStyle = `rgb(${Math.round(128 * shade)} ${Math.round(88 * shade)} ${Math.round(58 * shade)})`;
      g.fillRect(x, row * plank, len, plank);
      g.fillStyle = "rgb(0 0 0 / .05)";
      for (let i = 0; i < 6; i++) g.fillRect(x, row * plank + 6 + i * 10 + (x % 5), len, 2);
      g.fillStyle = "rgb(30 18 10 / .55)";
      g.fillRect(x, row * plank, 2, plank);
      x += len;
    }
    g.fillStyle = "rgb(30 18 10 / .55)";
    g.fillRect(0, row * plank, 512, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}
