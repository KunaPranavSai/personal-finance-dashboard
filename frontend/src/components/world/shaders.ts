export const terrainVert = /* glsl */ `
uniform float uFlight;
uniform float uAmp;
varying float vH;
varying vec3 vW;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.,0.)), f.x), mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

void main(){
  vec2 q = vec2(position.x, position.y + uFlight);
  // A low valley runs down the centre: this becomes the river of money in later scenes.
  float valley = smoothstep(1.5, 14.0, abs(position.x));
  float h = fbm(q * 0.07) * uAmp * (0.12 + valley * 0.88);
  h += fbm(q * 0.21 + 7.0) * 0.35 * valley;
  vH = h;
  vec4 wp = modelMatrix * vec4(position.xy, h, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const terrainFrag = /* glsl */ `
uniform vec3 uLine;
uniform vec3 uLight;
uniform vec3 uCam;
uniform float uLevels;
uniform float uOpacity;
varying float vH;
varying vec3 vW;

void main(){
  float s = vH * uLevels;
  float d = abs(fract(s - 0.5) - 0.5) / max(fwidth(s), 1e-4);
  float line = 1.0 - clamp(d - 0.35, 0.0, 1.0);
  float major = 1.0 - step(0.01, fract(floor(s + 0.5) / 5.0));
  float dist = length(vW.xz - uCam.xz);
  float fog = smoothstep(75.0, 14.0, dist) * smoothstep(0.0, 6.0, dist);
  float g = exp(-dot(vW.xz - uLight.xz, vW.xz - uLight.xz) / 18.0);
  float a = line * (0.3 + 0.25 * major + 0.7 * g) * fog * uOpacity;
  a += 0.05 * g * fog * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uLine, a);
  #include <colorspace_fragment>
}`;

export const markVert = /* glsl */ `
attribute vec3 aTarget;
attribute vec3 aScatter;
attribute vec2 aMeta; // x: seed 0..1, y: coin 0/1
uniform float uForm;
uniform float uTime;
uniform float uScroll;
uniform vec2 uPointer;
uniform float uPx;
uniform vec3 uCol;
uniform vec3 uCoin;
varying vec3 vCol;
varying float vA;

void main(){
  float seed = aMeta.x;
  float f = smoothstep(seed * 0.55, seed * 0.55 + 0.45, uForm);
  vec3 p = mix(aScatter, aTarget, f);
  float t = uTime;
  p += vec3(sin(t * 0.7 + seed * 40.0), cos(t * 0.6 + seed * 25.0), sin(t * 0.5 + seed * 13.0)) * 0.025 * f;
  // cursor: particles lean away from the pointer and ease back
  vec2 dd = p.xy - uPointer;
  float r = length(dd);
  p.xy += normalize(dd + 1e-4) * smoothstep(1.3, 0.0, r) * 0.4 * f;
  // scrolling away: the mark loosens into the downward flow of the next scene
  p.y -= uScroll * uScroll * (1.5 + seed * 9.0);
  p.z += uScroll * (2.0 + seed * 5.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * (1.4 + seed * 1.6) * (8.0 / -mv.z);
  vCol = mix(uCol, uCoin, aMeta.y);
  vA = (0.35 + 0.65 * f) * (1.0 - uScroll);
}`;

export const markFrag = /* glsl */ `
varying vec3 vCol;
varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.15, d) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCol, a);
  #include <colorspace_fragment>
}`;

export const flowVert = /* glsl */ `
attribute float aSrc;
attribute vec4 aR;    // x phase, y angle, z radius 0..1, w coin
attribute float aSize;
uniform float uTime;
uniform float uVis;
uniform float uSrc;
uniform float uRiv;
uniform float uPx;
uniform float uFocus;
uniform vec3 uStart[4];
uniform float uSpread[4];
uniform vec3 uCol;
uniform vec3 uCoin;
varying vec3 vCol;
varying float vA;

void main(){
  int k = int(aSrc + 0.5);
  vec3 S = uStart[k];
  float t = fract(aR.x + uTime * 0.045);
  const float F = 0.36;
  vec3 M = vec3(0.0, 0.9, -6.0);
  vec3 p;
  float spread = uSpread[k];
  float seg;
  float fade = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.88, 1.0, t));
  if (t < F) {
    float u = t / F;
    // fall: x converges late, y accelerates, z drifts linearly
    p = mix(S, M, vec3(smoothstep(0.3, 1.0, u), u * u, u));
    spread *= (1.0 - 0.55 * u);
    seg = 0.0;
  } else {
    float u = (t - F) / (1.0 - F);
    p = M + vec3(-sin(u * 5.5) * 3.6 * smoothstep(0.0, 0.35, u) + sin(u * 9.0 + aR.y) * 0.1, 0.0, -u * 52.0);
    spread = (0.12 + 0.3 * uRiv) * (1.0 + u * 3.0);
    seg = 1.0;
  }
  vec2 o = vec2(cos(aR.y), sin(aR.y)) * aR.z * spread;
  p.x += o.x;
  p.y += o.y * 0.6;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * aSize * clamp(10.0 / -mv.z, 0.3 + 0.7 * seg, 3.0);
  float a = mix(mix(0.3, 1.0, uSrc), mix(0.45, 1.0, uRiv), seg);
  float f = uFocus < 0.0 ? 1.0 : (abs(aSrc - uFocus) < 0.5 ? 1.7 : 0.3);
  vA = clamp(uVis * a * fade * f, 0.0, 1.0);
  vCol = mix(uCol, uCoin, aR.w);
}`;
