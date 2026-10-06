"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { world, type WorldTier } from "./world";
import { flowVert, markFrag } from "./shaders";
import { INCOME, INCOME_TOTAL } from "./sample";

const LINE = { dark: new THREE.Color("#21F1A8"), light: new THREE.Color("#004741") };
const COIN = { dark: new THREE.Color("#FFBE0B"), light: new THREE.Color("#B87700") };
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const bump = (x: number, c: number, w: number) => clamp01(1 - Math.abs(x - c) / w);

/**
 * Scenes 1-2 (Income -> Money flow). Particle count per source and thread width are
 * proportional to that source's amount; threads fall from above, merge at one point and
 * run down the valley as a single river. Pure GPU animation: one draw call.
 */
export function Flow({ tier }: { tier: WorldTier }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const n = tier === "lite" ? 3000 : 8500;

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const src = new Float32Array(n), r = new Float32Array(n * 4), size = new Float32Array(n);
    let k = 0;
    INCOME.forEach((s, si) => {
      const count = Math.max(1, Math.round((s.amount / INCOME_TOTAL) * n));
      for (let j = 0; j < count && k < n; j++, k++) {
        src[k] = si;
        r[k * 4] = Math.random();
        r[k * 4 + 1] = Math.random() * Math.PI * 2;
        r[k * 4 + 2] = Math.sqrt(Math.random());
        r[k * 4 + 3] = Math.random() < 0.07 ? 1 : 0; // a few coins ride the river
        size[k] = 1.1 + Math.random() * 1.3;
      }
    });
    for (; k < n; k++) src[k] = 0;
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aSrc", new THREE.BufferAttribute(src, 1));
    g.setAttribute("aR", new THREE.BufferAttribute(r, 4));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    return g;
  }, [n]);
  useEffect(() => () => geo.dispose(), [geo]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uVis: { value: 0 },
      uSrc: { value: 0 },
      uRiv: { value: 0 },
      uPx: { value: 1 },
      uFocus: { value: -1 },
      uStart: { value: [[-3.2, 9, -14], [2.6, 9.6, -14], [-7, 10.2, -15], [6.8, 10.8, -15]].map((v) => new THREE.Vector3(...v)) },
      uSpread: { value: INCOME.map((s) => 0.06 + 0.5 * (s.amount / INCOME_TOTAL)) },
      uCol: { value: LINE.dark.clone() },
      uCoin: { value: COIN.dark.clone() },
    }),
    [],
  );

  const focus = useRef(-1);
  useFrame(({ clock, gl, size }) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    const s = world.scene;
    // 3D flow is skipped under reduced motion: the table and figures carry the content
    const vis = world.reduced ? 0 : clamp01((s - 0.45) / 0.5) * (1 - clamp01((s - 3.0) / 0.8));
    if (mat.current) mat.current.visible = vis > 0.003;
    u.uVis.value = vis;
    u.uSrc.value = bump(s, 1, 1.1);
    u.uRiv.value = Math.max(bump(s, 2, 1.1), s > 2 ? clamp01(1 - (s - 2) / 1.6) * 0.8 : 0);
    u.uTime.value = clock.elapsedTime;
    u.uPx.value = gl.getPixelRatio() * (size.height / 900) * 3.0;
    focus.current += (world.focusSrc - focus.current) * 0.2;
    u.uFocus.value = world.focusSrc < 0 ? -1 : focus.current;
    const pal = world.dark ? "dark" : "light";
    u.uCol.value.lerp(LINE[pal], world.reduced ? 1 : 0.12);
    u.uCoin.value.lerp(COIN[pal], world.reduced ? 1 : 0.12);
  });

  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={flowVert} fragmentShader={markFrag} transparent depthWrite={false} visible={false} />
    </points>
  );
}
