"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { world, type WorldTier } from "./world";
import { markFrag, markVert, terrainFrag, terrainVert } from "./shaders";
import { cameraAt } from "./path";
import { Flow } from "./Flow";

const COL = {
  dark: { line: new THREE.Color("#21F1A8"), coin: new THREE.Color("#FFBE0B") },
  light: { line: new THREE.Color("#004741"), coin: new THREE.Color("#B87700") },
};
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type LightRef = React.MutableRefObject<THREE.Vector3>;

/** Contour terrain, one draw call. Lines are the only thing drawn; the page background shows through. */
function Terrain({ tier, lightRef }: { tier: WorldTier; lightRef: LightRef }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const ambient = useRef(0);
  const geo = useMemo(() => {
    const lite = tier === "lite";
    return new THREE.PlaneGeometry(90, 150, lite ? 70 : 150, lite ? 120 : 260);
  }, [tier]);
  const uniforms = useMemo(
    () => ({
      uFlight: { value: 0 },
      uAmp: { value: 4.2 },
      uLevels: { value: 3.2 },
      uLine: { value: (world.dark ? COL.dark : COL.light).line.clone() },
      uLight: { value: new THREE.Vector3() },
      uCam: { value: new THREE.Vector3() },
      uOpacity: { value: 0 },
    }),
    [],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(({ camera }, dt) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    // ambient drift at rest + travel-coupled flight (bidirectional: scroll back = fly back)
    if (!world.reduced) ambient.current += Math.min(dt, 0.05) * 0.9;
    u.uFlight.value = ambient.current + world.travel * 260;
    u.uLine.value.lerp((world.dark ? COL.dark : COL.light).line, world.reduced ? 1 : 0.12);
    u.uLight.value.copy(lightRef.current);
    u.uCam.value.copy(camera.position);
    u.uOpacity.value = smooth(0, 0.6, world.intro);
  });
  return (
    <mesh geometry={geo} rotation-x={-Math.PI / 2} position={[0, 0, -26]} frustumCulled={false}>
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={terrainVert} fragmentShader={terrainFrag} transparent depthWrite={false} />
    </mesh>
  );
}

type Sample = { pos: Float32Array; coin: Float32Array };

/** Sample the real brand mark (favicon.svg) into particle targets. Coin pixels stay gold. */
async function sampleMark(n: number): Promise<Sample> {
  const pts: number[] = [];
  try {
    const img = new Image();
    img.src = "/favicon.svg";
    await img.decode();
    const S = 196;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S).data;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        const r = d[i], gr = d[i + 1], b = d[i + 2];
        if (d[i + 3] < 128) continue;
        if (Math.abs(r - 244) + Math.abs(gr - 245) + Math.abs(b - 243) < 40) continue; // plate background
        pts.push(x, y, r > gr + 8 && gr > b + 15 && r > 140 ? 1 : 0);
      }
  } catch {
    /* fall through to ring */
  }
  if (pts.length < 30) for (let i = 0; i < 200; i++) pts.push(98 + Math.cos(i) * 40, 98 + Math.sin(i) * 40, 0);
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let i = 0; i < pts.length; i += 3) {
    minX = Math.min(minX, pts[i]);
    maxX = Math.max(maxX, pts[i]);
    minY = Math.min(minY, pts[i + 1]);
    maxY = Math.max(maxY, pts[i + 1]);
  }
  const k = 3.4 / (maxY - minY || 1);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const count = pts.length / 3;
  const pos = new Float32Array(n * 3), coin = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = ((Math.random() * count) | 0) * 3;
    pos[i * 3] = (pts[j] - cx + (Math.random() - 0.5)) * k;
    pos[i * 3 + 1] = -(pts[j + 1] - cy + (Math.random() - 0.5)) * k;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
    coin[i] = pts[j + 2];
  }
  return { pos, coin };
}

function Mark({ tier }: { tier: WorldTier }) {
  const n = tier === "lite" ? 2600 : 7000;
  const [sample, setSample] = useState<Sample | null>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const { size, viewport } = useThree();
  useEffect(() => {
    let live = true;
    sampleMark(n).then((s) => live && setSample(s));
    return () => {
      live = false;
    };
  }, [n]);
  const geo = useMemo(() => {
    if (!sample) return null;
    const g = new THREE.BufferGeometry();
    const scatter = new Float32Array(n * 3), meta = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      // income arrives from above and far: scatter is a wide volume
      scatter[i * 3] = (Math.random() - 0.5) * 22;
      scatter[i * 3 + 1] = 2 + Math.random() * 14;
      scatter[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
      meta[i * 2] = Math.random();
      meta[i * 2 + 1] = sample.coin[i];
    }
    g.setAttribute("position", new THREE.BufferAttribute(sample.pos, 3));
    g.setAttribute("aTarget", new THREE.BufferAttribute(sample.pos, 3));
    g.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
    g.setAttribute("aMeta", new THREE.BufferAttribute(meta, 2));
    return g;
  }, [sample, n]);
  useEffect(() => () => geo?.dispose(), [geo]);
  const uniforms = useMemo(
    () => ({
      uForm: { value: 0 },
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uPx: { value: 1 },
      uPointer: { value: new THREE.Vector2(99, 99) },
      uCol: { value: (world.dark ? COL.dark : COL.light).line.clone() },
      uCoin: { value: (world.dark ? COL.dark : COL.light).coin.clone() },
    }),
    [],
  );
  const aspect = size.width / size.height;
  const desktop = aspect > 1.15;
  const gx = desktop ? Math.min(2.7, viewport.width * 0.22) : 0;
  const gy = desktop ? 0 : 1.7; // offset above the camera's eye height
  const gs = desktop ? 1 : Math.min(0.85, aspect * 1.25);
  useFrame(({ clock, gl }) => {
    const u = mat.current?.uniforms;
    if (!u || !group.current) return;
    u.uForm.value = world.form;
    u.uTime.value = world.reduced ? 0 : clock.elapsedTime;
    u.uScroll.value = world.scroll;
    u.uPx.value = gl.getPixelRatio() * (size.height / 900) * 3.2;
    u.uCol.value.lerp((world.dark ? COL.dark : COL.light).line, world.reduced ? 1 : 0.12);
    u.uCoin.value.lerp((world.dark ? COL.dark : COL.light).coin, world.reduced ? 1 : 0.12);
    if (world.hasPointer && !world.reduced) {
      const halfH = Math.tan((50 * Math.PI) / 360) * 8;
      u.uPointer.value.set((world.px * halfH * aspect - gx) / gs, (world.py * halfH - gy) / gs);
    } else u.uPointer.value.set(99, 99);
    const sway = world.reduced ? 0 : Math.sin(clock.elapsedTime * 0.35) * 0.05;
    group.current.rotation.y = world.px * 0.12 + sway;
    group.current.rotation.x = -world.py * 0.06;
  });
  if (!geo) return null;
  return (
    <group ref={group} position={[gx, 3.4 + gy, 0]} scale={gs}>
      <points geometry={geo} frustumCulled={false}>
        <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={markVert} fragmentShader={markFrag} transparent depthWrite={false} />
      </points>
    </group>
  );
}

function ThemeInvalidate() {
  const invalidate = useThree((t) => t.invalidate);
  useEffect(() => {
    const mo = new MutationObserver(() => invalidate());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, [invalidate]);
  return null;
}

function Rig({ lightRef }: { lightRef: LightRef }) {
  const P = useRef(new THREE.Vector3());
  const L = useRef(new THREE.Vector3());
  const m = useRef({ x: 0, y: 0 }); // smoothed pointer
  useFrame((state, dt) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 3);
    m.current.x += (world.px - m.current.x) * k;
    m.current.y += (world.py - m.current.y) * k;
    const e = 1 - Math.pow(1 - world.intro, 3);
    // the journey: spline position for the current scene, then arrival offset + cursor parallax
    const fov = cameraAt(world.reduced ? 0 : world.scene, P.current, L.current);
    P.current.x += m.current.x * 0.35;
    P.current.y += -(1 - e) * 1.6 + m.current.y * 0.18;
    P.current.z += (1 - e) * 5;
    L.current.x += m.current.x * 0.8;
    camera.position.copy(P.current);
    camera.lookAt(L.current);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    // cursor-follow light on the terrain
    const lx = world.hasPointer ? world.px * 11 : 0;
    const lz = world.hasPointer ? -2 - (world.py * 0.5 + 0.5) * 22 : -8;
    lightRef.current.x += (lx - lightRef.current.x) * k;
    lightRef.current.z += (lz - lightRef.current.z) * k;
  });
  return null;
}

export default function WorldCanvas({ tier }: { tier: WorldTier }) {
  const wrap = useRef<HTMLDivElement>(null);
  const light = useRef(new THREE.Vector3(0, 0, -8));
  const [paused, setPaused] = useState(false);
  const [dpr, setDpr] = useState(tier === "lite" ? 1 : 1.5);

  // The world persists for the whole journey; it only pauses when the tab is hidden.
  useEffect(() => {
    const check = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

  // World veil (set by the master timeline): written straight to the DOM, never React state.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (wrap.current) wrap.current.style.opacity = String(world.veil);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={wrap} className="pointer-events-none absolute inset-0" aria-hidden="true">
      <Canvas
        frameloop={paused ? "never" : world.reduced ? "demand" : "always"}
        dpr={dpr}
        camera={{ fov: 50, near: 0.1, far: 120, position: [0, 3.6, 13] }}
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <PerformanceMonitor
          onDecline={() => setDpr((d) => Math.max(1, d - 0.25))}
          onIncline={() => setDpr((d) => Math.min(tier === "lite" ? 1 : 1.75, d + 0.25))}
        />
        <Terrain tier={tier} lightRef={light} />
        <Mark tier={tier} />
        <Flow tier={tier} />
        <Rig lightRef={light} />
        <ThemeInvalidate />
      </Canvas>
    </div>
  );
}
