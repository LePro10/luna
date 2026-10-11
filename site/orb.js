/**
 * Luna's particle orb — the same sphere as in the Luna app and the Android
 * assistant, ported from React to plain JS. Fibonacci sphere, coloured by
 * latitude, drawn as WebGL points; every particle's motion is closed-form,
 * so a frame is a few uniforms and one draw call.
 *
 * Moods: idle breathes, thinking bands and spins, speaking ripples with each
 * pulse (one pulse per streamed word). The pointer pushes particles away.
 */

const PALETTE = [
  [185, 211, 255], // ice
  [59, 91, 255],   // azure
  [168, 152, 255], // lilac
  [234, 220, 188], // sand
];

const TARGETS = {
  idle: { amp: .035, spin: .12, band: 0, ripple: 0, glow: .55 },
  thinking: { amp: .09, spin: .55, band: 1, ripple: 0, glow: .85 },
  speaking: { amp: .05, spin: .25, band: .2, ripple: 1, glow: 1 },
};

const VERT = `
attribute vec3 a_dir;
attribute float a_seed;
attribute vec3 a_col;
uniform vec2 u_res;
uniform vec4 u_rot;
uniform vec4 u_shape;
uniform vec4 u_frame;
uniform vec3 u_ptr;
varying vec3 v_col;
varying float v_a;
varying vec2 v_c;
varying float v_h;
void main() {
  vec3 d = a_dir; float s = a_seed; float t = u_frame.x; float R = u_frame.y;
  float wob = sin(d.x * 3.1 + t * 1.7 + s * 6.0) * cos(d.y * 2.7 - t * 1.3) * u_shape.x;
  float band = u_shape.y * sin(d.y * 9.0 - t * 3.4 + s * 0.6) * 0.05;
  float rip = u_shape.z * (sin(d.z * 7.0 + d.y * 3.0 - t * 7.0) * 0.025 + u_shape.w * 0.07 * sin(s * 40.0 + t * 10.0));
  vec3 p = d * (R * u_frame.z * (1.0 + wob + band + rip));
  float x1 = p.x * u_rot.x + p.z * u_rot.y, z1 = -p.x * u_rot.y + p.z * u_rot.x;
  float y2 = p.y * u_rot.z - z1 * u_rot.w, z2 = p.y * u_rot.w + z1 * u_rot.z;
  float persp = 1.0 / (1.0 - z2 / (R * 4.2));
  vec2 px = u_res * 0.5 + vec2(x1, y2) * persp;
  if (u_ptr.z > 0.01) {
    vec2 dd = px - u_ptr.xy; float d2 = dot(dd, dd); float pr = 90.0 * u_frame.w;
    if (d2 < pr * pr) px += dd * ((1.0 - d2 / (pr * pr)) * 30.0 * u_frame.w * u_ptr.z / sqrt(d2 + 1.0) * 0.06);
  }
  float depth = (z2 / R + 1.0) / 2.0;
  float a = clamp(floor((0.12 + depth * 0.88) * 11.0 * (0.75 + 0.25 * sin(t * 2.0 + s * 20.0)) + 0.5), 0.0, 11.0);
  v_a = (a + 1.0) / 12.0;
  v_col = a_col;
  float size = (0.55 + depth * 1.25) * u_frame.w * (1.0 + u_shape.w * 0.4);
  v_h = size * 0.5;
  v_c = vec2(px.x, u_res.y - px.y);
  gl_PointSize = size + 2.0;
  gl_Position = vec4(px.x / u_res.x * 2.0 - 1.0, 1.0 - px.y / u_res.y * 2.0, 0.0, 1.0);
}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 v_col;
varying float v_a;
varying vec2 v_c;
varying float v_h;
void main() {
  vec2 o = max(min(gl_FragCoord.xy + 0.5, v_c + v_h) - max(gl_FragCoord.xy - 0.5, v_c - v_h), 0.0);
  float cov = o.x * o.y;
  if (cov <= 0.0) discard;
  gl_FragColor = vec4(v_col, 1.0) * (v_a * cov);
}`;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement | null} glow  element whose opacity/scale follows the mood
 * @returns {{ mood(m: 'idle'|'thinking'|'speaking'): void, pulse(v?: number): void } | null}
 */
export function createOrb(canvas, glow, { density = 1600 } = {}) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const STRIDE = 7 * 4;
  const attr = (name, size, offset) => {
    const loc = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE, offset);
  };
  attr('a_dir', 3, 0); attr('a_seed', 1, 12); attr('a_col', 3, 16);
  const u = (name) => gl.getUniformLocation(program, name);
  const uRes = u('u_res'), uRot = u('u_rot'), uShape = u('u_shape'), uFrame = u('u_frame'), uPtr = u('u_ptr');
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  let W = 0, H = 0, dpr = 1, R = 0, n = 0;
  const build = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(1, Math.round(r.width * dpr));
    H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
    R = Math.min(W, H) * .34;
    const want = Math.round(Math.min(density, Math.max(320, (R / dpr) ** 2 * .1)));
    if (want === n) return;
    n = want;
    const data = new Float32Array(n * 7);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), th = golden * i;
      const t = (y + 1) / 2 + (Math.random() - .5) * .35;
      const [cr, cg, cb] = PALETTE[t > .72 ? 0 : t > .45 ? 2 : t > .2 ? 1 : 3];
      data.set([Math.cos(th) * rad, y, Math.sin(th) * rad, Math.random(), cr / 255, cg / 255, cb / 255], i * 7);
    }
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  };
  build();

  const live = { mood: 'idle', pulse: 0 };
  const cur = { ...TARGETS.idle };
  const pointer = { x: -1e9, y: -1e9, on: 0 };
  let raf = 0, t = 0, last = performance.now(), inView = true, glowO = '', glowT = '';

  function draw(now) {
    raf = 0;
    if (gl.isContextLost()) return;
    const dt = Math.min((now - last) / 1000, .05);
    last = now;
    const tgt = TARGETS[live.mood];
    const k = 1 - Math.exp(-dt * 3.2);
    cur.amp += (tgt.amp - cur.amp) * k; cur.spin += (tgt.spin - cur.spin) * k;
    cur.band += (tgt.band - cur.band) * k; cur.ripple += (tgt.ripple - cur.ripple) * k;
    cur.glow += (tgt.glow - cur.glow) * k;
    live.pulse *= Math.exp(-dt * 3.5);
    t += dt * (reduced ? .2 : 1);
    pointer.on += ((pointer.x > -1e8 ? 1 : 0) - pointer.on) * k;

    const ay = t * cur.spin, ax = -.38 + Math.sin(t * .21) * .06;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uRes, W, H);
    gl.uniform4f(uRot, Math.cos(ay), Math.sin(ay), Math.cos(ax), Math.sin(ax));
    gl.uniform4f(uShape, cur.amp, cur.band, cur.ripple, live.pulse);
    gl.uniform4f(uFrame, t, R, 1 + Math.sin(t * 1.3) * .012 + live.pulse * .045, dpr);
    gl.uniform3f(uPtr, pointer.x, pointer.y, pointer.on);
    gl.drawArrays(gl.POINTS, 0, n);

    if (glow) {
      const o = (cur.glow * .9).toFixed(3), tr = `scale(${(1 + live.pulse * .12 + cur.band * .06).toFixed(3)})`;
      if (o !== glowO) { glow.style.opacity = o; glowO = o; }
      if (tr !== glowT) { glow.style.transform = tr; glowT = tr; }
    }
    if (inView && document.visibilityState === 'visible') raf = requestAnimationFrame(draw);
  }
  const request = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(draw); } };

  new ResizeObserver(() => { build(); request(); }).observe(canvas);
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) request(); }).observe(canvas);
  document.addEventListener('visibilitychange', request);

  const move = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) * dpr; pointer.y = (e.clientY - r.top) * dpr;
  };
  const leave = () => { pointer.x = -1e9; pointer.y = -1e9; };
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerdown', move);
  canvas.addEventListener('pointerleave', leave);
  canvas.addEventListener('pointerup', leave);
  canvas.addEventListener('pointercancel', leave);
  request();

  return {
    mood(m) { live.mood = m; },
    pulse(v = 1) { live.pulse = Math.max(live.pulse, v); },
  };
}
