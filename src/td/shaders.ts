/**
 * A tiny TouchDesigner style network in GLSL ES 3.00, black and white only:
 *   Noise (domain warped, read as contour lines) -> Feedback (slow trails) -> Level (two colours, vignette, grain).
 * It is decorative, so it is rendered soft and at low resolution. No text ever sits on it.
 */
export const VERT = `#version 300 es
in vec2 p;
out vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

export const FIELD = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D prev;
uniform vec2 res; uniform float t; uniform vec2 light;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*vn(p); p = p*2.03 + 7.1; a *= 0.5; } return s; }
void main(){
  vec2 q = (uv - 0.5) * vec2(res.x / res.y, 1.0);
  vec2 w = vec2(fbm(q*1.6 + t*0.03), fbm(q*1.6 - t*0.025 + 3.3));
  float n = fbm(q*1.9 + w*1.4 + vec2(0.0, t*0.02));
  float c = abs(fract(n*7.0) - 0.5) * 2.0;
  float line = 1.0 - smoothstep(0.0, 0.11, c);
  float d = length((uv - light) * vec2(res.x / res.y, 1.0));
  float lamp = exp(-d*d*5.0);
  float cur = line * (0.25 + 0.75*lamp);
  float tr = texture(prev, uv).r;
  o = vec4(max(cur, tr * 0.93), 0.0, 0.0, 1.0);
}`;

export const LEVEL = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D tex;
uniform vec3 ground; uniform vec3 ink; uniform float amount; uniform float seed;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  float v = texture(tex, uv).r;
  float vig = smoothstep(1.15, 0.2, length(uv - vec2(0.5, 0.42)));
  float k = v * amount * vig;
  vec3 col = mix(ground, ink, k);
  col += (h(gl_FragCoord.xy + seed) - 0.5) * 0.012;
  o = vec4(col, 1.0);
}`;
