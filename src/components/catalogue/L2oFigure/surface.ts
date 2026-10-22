import recorded from '../../../data/research/l2o-training-snapshots.json';
import { whenFigureReady } from '../../../lib/figure-ready';
import { enhanceNear } from '../../../lib/lifecycle';
import { createLoop } from '../../../lib/loop';
import { reducedMotionQuery, watchActivity } from '../../../lib/motion';
import { createPredictionHud, predictionHudAt } from './hud';
import { trainingCadence, trainingReset, trainingTimeline } from './timing';
import { trajectoryLengths, trajectoryPoint, trajectoryProgress } from './trajectory';

type V = [number, number, number];
type P = [number, number];
enhanceNear<HTMLElement>('[data-l2o-surface]', init);
function init(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('.surface-gl')!;
  const overlay = root.querySelector<HTMLCanvasElement>('.surface-annotations')!;
  const ctx = overlay.getContext('2d')!;
  const gl = canvas.getContext('webgl', {
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
  });
  if (!gl) {
    root.querySelector<HTMLElement>('.surface-fallback')!.hidden = false;
    return;
  }
  const gpu = gl;
  const { a, b } = recorded.parameters;
  let reduced = reducedMotionQuery().matches;
  const clamp = (t: number) => Math.max(0, Math.min(1, t));
  const ease = (t: number) => {
    t = clamp(t);
    return t * t * (3 - 2 * t);
  };
  const out = (t: number) => 1 - (1 - clamp(t)) ** 3;
  const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a: V, t: number): V => [a[0] * t, a[1] * t, a[2] * t];
  const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: V, b: V): V => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const norm = (a: V): V => mul(a, 1 / (Math.hypot(...a) || 1));
  const f = (x: number, y: number) => (a - x) ** 2 + 50 * (y - x * x) ** 2;
  const z = (x: number, y: number) => 0.24 + (Math.log1p(f(x, y)) / Math.log(5001)) * 2.15;
  const world = (x: number, y: number, lift = 0): V => [
    (x + 1.25) * 1.3,
    (y - 2.2) * 0.65,
    z(x, y) + lift,
  ];
  const feasible = (x: number, y: number) =>
    x >= -Math.sqrt(b) - 1e-7 && x <= 1e-7 && y >= b / 2 - 1e-7;
  const rgb = (s: string): V => [
    parseInt(s.slice(1, 3), 16) / 255,
    parseInt(s.slice(3, 5), 16) / 255,
    parseInt(s.slice(5, 7), 16) / 255,
  ];
  type Stop = [number, string];
  const terrain: Stop[] = [
    [0, '#243952'],
    [0.3, '#2f6477'],
    [0.58, '#459486'],
    [0.79, '#9ab99a'],
    [1, '#d6cc8a'],
  ];
  const integer: Stop[] = [
    [0, '#4c83c8'],
    [0.3, '#31a7c6'],
    [0.58, '#31c895'],
    [0.79, '#b1d976'],
    [1, '#f0d657'],
  ];
  const neutral: Stop[] = [
    [0, '#242c32'],
    [0.3, '#343f45'],
    [0.58, '#465156'],
    [0.79, '#576260'],
    [1, '#69726a'],
  ];
  const neutralLine: Stop[] = [
    [0, '#49545c'],
    [0.3, '#59656c'],
    [0.58, '#6d797d'],
    [0.79, '#84908d'],
    [1, '#9aa29a'],
  ];
  // Match the existing 2D field, including its perceptual interpolation and bands.
  function lab(c: V): V {
    const l = c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    const L = Math.cbrt(0.4122214708 * l[0] + 0.5363325363 * l[1] + 0.0514459929 * l[2]),
      M = Math.cbrt(0.2119034982 * l[0] + 0.6806995451 * l[1] + 0.1073969566 * l[2]),
      S = Math.cbrt(0.0883024619 * l[0] + 0.2817188376 * l[1] + 0.6299787005 * l[2]);
    return [
      0.2104542553 * L + 0.793617785 * M - 0.0040720468 * S,
      1.9779984951 * L - 2.428592205 * M + 0.4505937099 * S,
      0.0259040371 * L + 0.7827717662 * M - 0.808675766 * S,
    ];
  }
  function unlab(c: V): V {
    const L = (c[0] + 0.3963377774 * c[1] + 0.2158037573 * c[2]) ** 3,
      M = (c[0] - 0.1055613458 * c[1] - 0.0638541728 * c[2]) ** 3,
      S = (c[0] - 0.0894841775 * c[1] - 1.291485548 * c[2]) ** 3;
    return [
      4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
      -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
      -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
    ].map((v) =>
      clamp(v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055),
    ) as V;
  }
  const labs = new Map<string, V>();
  function color(stops: Stop[], t: number): V {
    t = clamp(t);
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const p = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
    const get = (s: string) => {
      if (!labs.has(s)) labs.set(s, lab(rgb(s)));
      return labs.get(s)!;
    };
    return unlab(add(mul(get(stops[i][1]), 1 - p), mul(get(stops[i + 1][1]), p)));
  }
  const tone = (v: number) => clamp(Math.log(3200 / Math.max(12, v)) / Math.log(3200 / 12));
  const relaxed = rgb('#d3ad87'),
    ivory = rgb('#edf4f7');
  const vs = `attribute vec3 position;attribute vec3 normal;attribute vec3 color;attribute float arrival;uniform vec3 right;uniform vec3 up;uniform vec3 forward;uniform vec3 center;uniform vec2 scale;varying vec3 vColor;varying vec3 vNormal;varying vec3 vPosition;varying float vArrival;varying float vTone;uniform vec3 problem;uniform float material;uniform vec3 translation;void main(){vPosition=position+translation;vTone=0.;if(material<.1){float x=position.x/1.3-1.25,y=position.y/.65+2.2;float value=(problem.x-x)*(problem.x-x)+50.*(y-x*x)*(y-x*x);vTone=clamp(log(3200./max(12.,value))/log(3200./12.),0.,1.);}vec3 d=vPosition-center;gl_Position=vec4(dot(d,right)*scale.x,dot(d,up)*scale.y,-dot(d,forward)*.13,1.);vColor=color;vNormal=normal;vArrival=arrival;}`;
  const fs = `precision highp float;
 varying vec3 vColor;varying vec3 vNormal;varying vec3 vPosition;varying float vArrival;varying float vTone;
 uniform float time;uniform float material;uniform float opacity;
 uniform sampler2D palette;uniform vec3 problem;
 void main(){
  if(vArrival>time)discard;
  vec3 c=vColor;
  if(material<.1){
   float x=vPosition.x/1.3-1.25,y=vPosition.y/.65+2.2;
   float t=clamp(vTone,0.,1.);
   float inside=step(problem.y,x)*step(x,0.)*step(problem.z,y);
   float q=t*16.,band=min(15.,floor(q));
   vec2 uv=vec2((band+.5)/16.,mix(.25,.75,inside));
   vec2 next=vec2((min(15.,band+1.)+.5)/16.,uv.y);
   // Quantize the continuous field per fragment, avoiding vertex-band zigzags.
   c=mix(texture2D(palette,uv).rgb,texture2D(palette,next).rgb,smoothstep(.965,1.,fract(q)));
  }
  float light=.90+.10*max(0.,dot(normalize(vNormal),normalize(vec3(-.3,-.5,1.))));
  gl_FragColor=vec4(c*mix(light,1.,material),opacity);
 }`;

  function shader(type: number, source: string) {
    const s = gpu.createShader(type)!;
    gpu.shaderSource(s, source);
    gpu.compileShader(s);
    if (!gpu.getShaderParameter(s, gpu.COMPILE_STATUS))
      throw new Error(gpu.getShaderInfoLog(s) || 'Surface shader failed');
    return s;
  }
  const program = gpu.createProgram()!;
  gpu.attachShader(program, shader(gpu.VERTEX_SHADER, vs));
  gpu.attachShader(program, shader(gpu.FRAGMENT_SHADER, fs));
  gpu.linkProgram(program);
  if (!gpu.getProgramParameter(program, gpu.LINK_STATUS))
    throw new Error(gpu.getProgramInfoLog(program) || 'Surface program failed');
  gpu.useProgram(program);
  const uniforms = Object.fromEntries(
    [
      'translation',
      'right',
      'up',
      'forward',
      'center',
      'scale',
      'time',
      'material',
      'opacity',
      'palette',
      'problem',
    ].map((n) => [n, gpu.getUniformLocation(program, n)]),
  );
  const paletteData = new Uint8Array(16 * 2 * 4);
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 16; i++) {
      const c = color(row ? terrain : neutral, i / 16),
        offset = (row * 16 + i) * 4;
      for (let j = 0; j < 3; j++) paletteData[offset + j] = Math.round(c[j] * 255);
      paletteData[offset + 3] = 255;
    }
  const paletteTexture = gpu.createTexture();
  gpu.activeTexture(gpu.TEXTURE0);
  gpu.bindTexture(gpu.TEXTURE_2D, paletteTexture);
  gpu.texImage2D(gpu.TEXTURE_2D, 0, gpu.RGBA, 16, 2, 0, gpu.RGBA, gpu.UNSIGNED_BYTE, paletteData);
  gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_MIN_FILTER, gpu.NEAREST);
  gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_MAG_FILTER, gpu.NEAREST);
  gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_WRAP_S, gpu.CLAMP_TO_EDGE);
  gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_WRAP_T, gpu.CLAMP_TO_EDGE);
  gpu.uniform1i(uniforms.palette, 0);
  gpu.uniform3f(uniforms.problem, a, -Math.sqrt(b), b / 2);
  const attrs = ['position', 'normal', 'color', 'arrival'].map((n) =>
    gpu.getAttribLocation(program, n),
  );
  type Mesh = { buffer: WebGLBuffer; count: number; material: number };
  function mesh(data: number[], material = 0): Mesh {
    const buffer = gpu.createBuffer()!;
    gpu.bindBuffer(gpu.ARRAY_BUFFER, buffer);
    gpu.bufferData(gpu.ARRAY_BUFFER, new Float32Array(data), gpu.STATIC_DRAW);
    return { buffer, count: data.length / 10, material };
  }
  function vertex(data: number[], p: V, n: V, c: V, t = -100) {
    data.push(...p, ...n, ...c, t);
  }
  const origin: V = [0, 0, 0];
  function draw(m: Mesh, time: number, opacity = 1, translation: V = origin) {
    gpu.bindBuffer(gpu.ARRAY_BUFFER, m.buffer);
    const widths = [3, 3, 3, 1],
      offsets = [0, 12, 24, 36];
    attrs.forEach((loc, i) => {
      gpu.enableVertexAttribArray(loc);
      gpu.vertexAttribPointer(loc, widths[i], gpu.FLOAT, false, 40, offsets[i]);
    });
    gpu.uniform3fv(uniforms.translation, translation);
    gpu.uniform1f(uniforms.material, m.material);
    gpu.uniform1f(uniforms.time, time);
    gpu.uniform1f(uniforms.opacity, opacity);
    gpu.drawArrays(gpu.TRIANGLES, 0, m.count);
  }
  function tube(data: number[], pts: V[], colors: V | V[], radius: number, times?: number[]) {
    for (let j = 0; j < pts.length - 1; j++) {
      const p = pts[j],
        q = pts[j + 1],
        dir = norm(sub(q, p)),
        axis = Math.abs(dir[2]) > 0.9 ? ([1, 0, 0] as V) : ([0, 0, 1] as V),
        ex = norm(cross(dir, axis)),
        ey = norm(cross(dir, ex));
      for (let k = 0; k < 6; k++) {
        const n1 = add(mul(ex, Math.cos((k * Math.PI) / 3)), mul(ey, Math.sin((k * Math.PI) / 3))),
          n2 = add(
            mul(ex, Math.cos(((k + 1) * Math.PI) / 3)),
            mul(ey, Math.sin(((k + 1) * Math.PI) / 3)),
          );
        const c1 = Array.isArray(colors[0]) ? (colors as V[])[j] : (colors as V),
          c2 = Array.isArray(colors[0]) ? (colors as V[])[j + 1] : (colors as V);
        for (const [point, n, c, t] of [
          [p, n1, c1, times?.[j] ?? -100],
          [q, n1, c2, times?.[j + 1] ?? -100],
          [p, n2, c1, times?.[j] ?? -100],
          [p, n2, c1, times?.[j] ?? -100],
          [q, n1, c2, times?.[j + 1] ?? -100],
          [q, n2, c2, times?.[j + 1] ?? -100],
        ] as [V, V, V, number][])
          vertex(data, add(point, mul(n, radius)), n, c, t);
      }
    }
  }
  const xs = [
    ...Array.from({ length: 101 }, (_, i) => -3 + (3.5 * i) / 100),
    -Math.sqrt(b),
    0,
  ].sort((a, b) => a - b);
  const ys = [...Array.from({ length: 141 }, (_, i) => -1.3 + (7 * i) / 140), b / 2].sort(
    (a, b) => a - b,
  );
  const terrainData: number[] = [],
    fitPoints: V[] = [];
  for (let iy = 0; iy < ys.length - 1; iy++)
    for (let ix = 0; ix < xs.length - 1; ix++) {
      const x = (xs[ix] + xs[ix + 1]) / 2,
        y = (ys[iy] + ys[iy + 1]) / 2,
        inside = feasible(x, y);
      const corners: P[] = [
        [xs[ix], ys[iy]],
        [xs[ix + 1], ys[iy]],
        [xs[ix + 1], ys[iy + 1]],
        [xs[ix], ys[iy + 1]],
      ];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const [px, py] = corners[k],
          p = world(px, py),
          eps = 0.001;
        const dzx = (z(px + eps, py) - z(px - eps, py)) / (2 * eps * 1.3),
          dzy = (z(px, py + eps) - z(px, py - eps)) / (2 * eps * 0.65);
        const band = Math.min(15, Math.floor(tone(f(px, py)) * 16)) / 16;
        vertex(terrainData, p, norm([-dzx, -dzy, 1]), color(inside ? terrain : neutral, band));
      }
      if (ix % 4 === 0 && iy % 4 === 0) fitPoints.push(world(x, y));
    }
  const surface = mesh(terrainData);
  const guides: number[] = [],
    boundaries: number[] = [];
  for (const y of [-1, 0, 1, 2, 3, 4, 5]) {
    const pts: V[] = [],
      cs: V[] = [];
    for (let i = 0; i <= 220; i++) {
      const x = -3 + (3.5 * i) / 220;
      pts.push(world(x, y, 0.014));
      cs.push(color(feasible(x, y) ? integer : neutralLine, tone(f(x, y))));
    }
    tube(guides, pts, cs, 0.0075);
  }
  for (const x of [-Math.sqrt(b), 0]) {
    const pts = Array.from({ length: 221 }, (_, i) => world(x, -1.3 + (7 * i) / 220, 0.02));
    tube(boundaries, pts, rgb('#a3a7ad'), 0.009);
  }
  tube(
    boundaries,
    Array.from({ length: 221 }, (_, i) => world(-3 + (3.5 * i) / 220, b / 2, 0.02)),
    rgb('#a3a7ad'),
    0.009,
  );
  const slices = mesh(guides, 1),
    constraints = mesh(boundaries, 1);
  const samples = recorded.relaxed.flatMap((p, i) => [p as P, recorded.corrected[i] as P]);
  const hudSnapshots = createPredictionHud(recorded);
  const trajectory = {
    pathRadius: 0.013,
    relaxedRadius: 0.04,
    integerRadius: 0.046,
  };
  const azimuth = -0.96,
    elevation = 0.9;
  const forward: V = [
    Math.cos(azimuth) * Math.cos(elevation),
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
  ];
  const right = norm(cross([0, 0, 1], forward));
  const up = norm(cross(forward, right));
  const traceData: number[] = [];
  const segments: { points: V[]; lengths: number[] }[] = [];
  for (let i = 1; i < samples.length; i++) {
    const p = samples[i - 1],
      q = samples[i],
      pts: V[] = [];
    for (let j = 0; j <= 100; j++) {
      const fraction = j / 100;
      pts.push(world(p[0] + (q[0] - p[0]) * fraction, p[1] + (q[1] - p[1]) * fraction, 0.045));
    }
    const lengths = trajectoryLengths(pts, (point) => [dot(point, right), dot(point, up)]);
    segments.push({ points: pts, lengths });
  }
  const { arrivals, beats, cycle, speed } = trainingTimeline(
    segments.map((segment) => segment.lengths[segment.lengths.length - 1]),
  );
  const reset = trainingReset(cycle);
  const traceSegments = segments.map((segment, i) => {
    const from = arrivals[i],
      to = arrivals[i + 1];
    const times = segment.lengths.map((length) => from + length / speed);
    tube(traceData, segment.points, ivory, trajectory.pathRadius, times);
    return { ...segment, from, to };
  });
  const trace = mesh(traceData, 1);
  function sphere(p: V, r: number, c: V) {
    const data: number[] = [];
    for (let a = 0; a < 10; a++)
      for (let b = 0; b < 16; b++) {
        const v = (i: number, j: number): V => [
          Math.sin((i * Math.PI) / 10) * Math.cos((j * Math.PI) / 8),
          Math.sin((i * Math.PI) / 10) * Math.sin((j * Math.PI) / 8),
          Math.cos((i * Math.PI) / 10),
        ];
        for (const [i, j] of [
          [a, b],
          [a + 1, b],
          [a + 1, b + 1],
          [a, b],
          [a + 1, b + 1],
          [a, b + 1],
        ]) {
          const n = v(i, j);
          vertex(data, add(p, mul(n, r)), n, c);
        }
      }
    return mesh(data, 0.8);
  }
  const pointMeshes = samples.map((p, i) =>
    sphere(
      world(...p, 0.045),
      i % 2 ? trajectory.integerRadius : trajectory.relaxedRadius,
      i % 2 ? ivory : relaxed,
    ),
  );
  let width = 600,
    height = 500,
    ratio = 1;
  const movingHead = sphere(origin, trajectory.integerRadius * 0.9, ivory);
  let center: V = [0, 0, 1],
    scale = 80;
  function view() {
    const all = fitPoints.concat([
        world(-3, -1.3),
        world(0.5, -1.3),
        world(0.5, 5.7),
        world(-3, 5.7),
      ]),
      rx = all.map((p) => dot(p, right)),
      uy = all.map((p) => dot(p, up));
    const minX = Math.min(...rx),
      maxX = Math.max(...rx),
      minY = Math.min(...uy),
      maxY = Math.max(...uy);
    center = add(mul(right, (minX + maxX) / 2), mul(up, (minY + maxY) / 2));
    scale = Math.min((width - 30) / (maxX - minX), (height - 80) / (maxY - minY));
    // Use the lower-right negative space; keep the surface large on a phone.
    const targetY = 24 + ((maxY - minY) * scale) / 2;
    center = add(add(center, mul(right, 8 / scale)), mul(up, (targetY - height / 2) / scale));
    gpu.uniform3fv(uniforms.right, right);
    gpu.uniform3fv(uniforms.up, up);
    gpu.uniform3fv(uniforms.forward, forward);
    gpu.uniform3fv(uniforms.center, center);
    gpu.uniform2f(uniforms.scale, (2 * scale) / width, (2 * scale) / height);
  }
  function project(p: V): P {
    const d = sub(p, center);
    return [width / 2 + dot(d, right) * scale, height / 2 - dot(d, up) * scale];
  }
  let time = 0,
    lastHudIndex = -2;
  const stepSlot = root.querySelector<HTMLElement>('[data-training-step]')!;

  const legendKeys = Array.from(root.querySelectorAll<HTMLElement>('.surface-legend [data-kind]'));
  const stateSlot = root.querySelector<HTMLElement>('[data-feasibility]')!;

  const displayedValues = new WeakMap<HTMLElement, string>();
  const instrument = root.closest<HTMLElement>('[data-training-composition]');
  const liveSlots = Array.from(instrument?.querySelectorAll<HTMLElement>('[data-reading]') ?? []);
  const reading = (n: number) => n.toFixed(3).replace('-', '−');
  function updateNumber(slot: HTMLElement, value: string, refresh = false) {
    const previous = displayedValues.get(slot) ?? slot.textContent?.trim() ?? '—';
    if (previous === value && !refresh) return;
    displayedValues.set(slot, value);
    slot.dataset.readingValue = value;
    slot.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    slot.replaceChildren();
    slot.setAttribute('aria-label', value);
    if (reduced) {
      slot.textContent = value;
      return;
    }
    if (slot === stateSlot) {
      const old = document.createElement('span'),
        current = document.createElement('span');
      old.className = 'hud-status-old';
      current.className = 'hud-status-current';
      old.textContent = previous;
      current.textContent = value;
      old.setAttribute('aria-hidden', 'true');
      current.setAttribute('aria-hidden', 'true');
      slot.append(old, current);
      const exit = old.animate(
        [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(-2px)' },
        ],
        { duration: 120, easing: 'ease-out', fill: 'both' },
      );
      const enter = current.animate(
        [
          { opacity: 0, transform: 'translateY(2px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        {
          duration: trainingCadence.reading * 1000,
          easing: 'ease-out',
          fill: 'both',
        },
      );
      exit.onfinish = () => old.remove();
      enter.onfinish = () => enter.cancel();
      return;
    }
    // Preserve the Step counter's units column, including its waiting dash.
    const hudNumber = slot === stepSlot;
    const length = Math.max(hudNumber ? 5 : 0, previous.length, value.length);
    const oldValue = hudNumber ? previous.padStart(length) : previous.padEnd(length);
    const newValue = hudNumber ? value.padStart(length) : value.padEnd(length);
    const strip = document.createElement('span');
    strip.className = 'readout-strip';
    strip.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < length; i++) {
      const cell = document.createElement('span');
      cell.className = 'readout-cell';
      const old = document.createElement('span'),
        current = document.createElement('span');
      old.className = 'readout-old';
      old.textContent = oldValue[i] === ' ' ? '\u00a0' : oldValue[i];
      current.className = 'readout-current';
      current.textContent = newValue[i] === ' ' ? '\u00a0' : newValue[i];
      cell.append(old, current);
      strip.append(cell);
      const delay = hudNumber ? 0 : (i / Math.max(1, length - 1)) * trainingCadence.stagger * 1000,
        duration = trainingCadence.reading * 1000;
      old.animate(
        [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(-90%)' },
        ],
        { duration: 170, delay, fill: 'both', easing: 'ease-in' },
      );
      const enter = current.animate(
        hudNumber
          ? [
              { opacity: 0, transform: 'translateY(75%)' },
              { opacity: 1, transform: 'translateY(0)' },
            ]
          : [
              { opacity: 0, transform: 'translateY(100%)', textShadow: 'none' },
              { opacity: 0, offset: 0.16 },
              { opacity: 1, offset: 0.43, textShadow: '0 0 1px #e2edf3' },
              { opacity: 0.58, offset: 0.55 },
              { opacity: 1, transform: 'translateY(0)', textShadow: 'none' },
            ],
        { duration, delay, fill: 'both', easing: 'cubic-bezier(.2,.7,.25,1)' },
      );
      enter.onfinish = () => {
        old.remove();
        enter.cancel();
      };
    }
    slot.append(strip);
  }
  let previousTime = -1;
  const shown: Record<string, number> = {
    mapping: -1,
    relaxed: -1,
    hidden: -1,
    integer: -1,
    loss: -1,
  };
  function resize() {
    const r = canvas.getBoundingClientRect();
    width = r.width;
    height = r.height;
    ratio = Math.min(devicePixelRatio || 1, 2);
    for (const c of [canvas, overlay]) {
      const resolution = c === canvas ? Math.min(ratio, 1.5) : ratio;
      c.width = Math.round(width * resolution);
      c.height = Math.round(height * resolution);
    }
    gpu.viewport(0, 0, canvas.width, canvas.height);
    view();
    render();
  }
  function label(s: string, p: P, color = '#a3a7ad', align: CanvasTextAlign = 'center', size = 11) {
    ctx.font = `${size}px "Geist Mono Variable",monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(16,17,19,.35)';
    ctx.strokeText(s, ...p);
    ctx.fillStyle = color;
    ctx.fillText(s, ...p);
  }
  function render() {
    const t = reduced ? arrivals[arrivals.length - 1] + 1 : time % cycle,
      fade = reduced ? 1 : 1 - ease((t - reset.relaxed) / (cycle - reset.relaxed));
    const hudSnapshot = predictionHudAt(hudSnapshots, arrivals, t, reset.hud);
    gpu.clearColor(0, 0, 0, 0);
    gpu.clear(gpu.COLOR_BUFFER_BIT | gpu.DEPTH_BUFFER_BIT);
    gpu.enable(gpu.DEPTH_TEST);
    gpu.enable(gpu.BLEND);
    gpu.blendFunc(gpu.SRC_ALPHA, gpu.ONE_MINUS_SRC_ALPHA);
    draw(surface, t);
    draw(slices, t);
    draw(constraints, t);
    draw(trace, t, fade);
    let at = -1;
    for (let i = 0; i < arrivals.length; i++) if (t >= arrivals[i]) at = i;
    for (const key of legendKeys) {
      const kind = at % 2 ? 'integer' : 'relaxed';
      key.classList.toggle(
        'is-arriving',
        !reduced &&
          at >= 0 &&
          key.dataset.kind === kind &&
          t - arrivals[at] < trainingCadence.action,
      );
    }
    pointMeshes.forEach((m, i) => {
      if (i <= at) draw(m, t, fade * out((t - arrivals[i]) / 0.18));
    });
    const travelling = traceSegments.find((segment) => t >= segment.from && t < segment.to);
    if (travelling && !reduced) {
      const progress = trajectoryProgress(
        (t - travelling.from) / (travelling.to - travelling.from),
      );
      draw(movingHead, t, fade, trajectoryPoint(travelling.points, travelling.lengths, progress));
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const labels: [string, V, number, number][] = [
      ['x² ≤ b', world(-Math.sqrt(b), 5.7), -13, -13],
      ['x ≤ 0', world(0, 5.7), 16, -9],
      ['y ≥ b/2', world(-3, b / 2), -4, width < 430 ? 24 : 8],
    ];
    labels.forEach(([s, v, dx, dy]) => {
      const p = project(v);
      label(s, [p[0] + dx, p[1] + dy], '#a3a7ad', 'center', width < 430 ? 10 : 11);
    });
    const optimal = project(world(recorded.optimum.x, recorded.optimum.y, 0.055));
    ctx.beginPath();
    for (let j = 0; j < 10; j++) {
      const angle = -Math.PI / 2 + (j * Math.PI) / 5,
        r = j % 2 ? 3.3 : 7.5;
      const x = optimal[0] + Math.cos(angle) * r,
        y = optimal[1] + Math.sin(angle) * r;
      j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#ee6677';
    ctx.fill();
    label('Optimal', [optimal[0], optimal[1] + 20], '#ee6677', 'center', 11);
    for (let i = 0; i < samples.length; i++) {
      const age = t - arrivals[i];
      if (age < 0 || age > 0.825 || reduced) continue;
      const alpha = out(age / 0.065) * (1 - ease((age - 0.075) / 0.75)) * fade;
      const p = project(world(...samples[i], 0.045)),
        r = (i % 2 ? trajectory.integerRadius : trajectory.relaxedRadius) * scale;
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
    if (hudSnapshot) {
      const selected = project(world(...hudSnapshot.point, 0.045));
      ctx.beginPath();
      ctx.arc(selected[0], selected[1], trajectory.integerRadius * scale + 1.6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(237,244,247,${fade * 0.45})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    if (t < previousTime) {
      Object.keys(shown).forEach((key) => (shown[key] = -1));
      for (const slot of liveSlots) updateNumber(slot, '—');
    }
    previousTime = t;
    let index = 0;
    for (let i = 1; i < beats.length; i++) if (t >= beats[i].mapping) index = i;
    const beat = beats[index],
      relaxedPoint = recorded.relaxed[index],
      integerPoint = recorded.corrected[index];
    const reveal = (group: string, when: number, values: Record<string, string>) => {
      if (t < when || shown[group] === index) return;
      shown[group] = index;
      for (const slot of liveSlots) {
        const value = values[slot.dataset.reading!];
        if (value !== undefined) updateNumber(slot, value, true);
      }
      if (instrument) instrument.dataset.readingStage = group;
    };
    if (t >= beat.mapping && shown.mapping !== index) {
      shown.mapping = index;
      if (instrument) instrument.dataset.readingStage = 'mapping';
    }
    reveal('relaxed', beat.relaxed, {
      'relaxed-x': reading(relaxedPoint[0]),
      'relaxed-y': reading(relaxedPoint[1]),
    });
    reveal('hidden', beat.hidden, {
      'delta-x': reading(recorded.hidden[index][0]),
      'hidden-y': reading(recorded.hidden[index][1]),
    });
    reveal('integer', beat.integer, {
      'integer-x': reading(integerPoint[0]),
      'integer-y': String(integerPoint[1]).replace('-', '−'),
    });
    const integerResidual = Math.max(
      0,
      b / 2 - integerPoint[1],
      integerPoint[0] ** 2 - b,
      integerPoint[0],
      -integerPoint[1],
    );
    reveal('loss', beat.loss, {
      objective: f(integerPoint[0], integerPoint[1]).toFixed(2),
      violation: integerResidual.toFixed(2),
      gap:
        integerResidual <= 1e-6
          ? (f(integerPoint[0], integerPoint[1]) - recorded.optimum.objective).toFixed(2)
          : '—',
    });
    const hudIndex = hudSnapshot?.index ?? -1;
    if (hudIndex !== lastHudIndex) {
      lastHudIndex = hudIndex;
      updateNumber(
        stepSlot,
        hudSnapshot ? String(hudSnapshot.step) : '\u2014',
        Boolean(hudSnapshot),
      );
      updateNumber(stateSlot, hudSnapshot?.status ?? '\u2014');
      root.dataset.hudIndex = String(hudIndex);
      root.dataset.hudStep = hudSnapshot ? String(hudSnapshot.step) : '';
      root.dataset.feasible = String(Boolean(hudSnapshot && hudSnapshot.status !== 'Infeasible'));
      root.dataset.integerFeasible = String(hudSnapshot?.status === 'Integer feasible');
    }
    if (!reduced && t >= reset.relaxed) {
      const groups: Record<string, string> = {
        'relaxed-x': 'relaxed',
        'relaxed-y': 'relaxed',
        'delta-x': 'hidden',
        'hidden-y': 'hidden',
        'integer-x': 'integer',
        'integer-y': 'integer',
        objective: 'loss',
        violation: 'loss',
        gap: 'loss',
      };
      for (const slot of liveSlots) {
        const group = groups[slot.dataset.reading!] as keyof typeof reset;
        if (group && t >= reset[group]) updateNumber(slot, '—');
      }
    }
    if (instrument) instrument.dataset.resetting = String(!reduced && t >= reset.relaxed);
    if (instrument) instrument.dataset.iteration = String(recorded.savedIndices[index] + 1);
    root.dataset.point = String(at);
    root.dataset.phase = t.toFixed(3);
    instrument?.dispatchEvent(new CustomEvent('l2o:tick', { detail: { t, at, beat, index } }));
    root.dataset.camera = 'fixed';
    root.dataset.azimuth = String(azimuth);
    root.dataset.elevation = String(elevation);
  }
  new ResizeObserver(resize).observe(canvas);
  document.fonts.ready.then(resize);
  let lastElapsed = 0;
  const loop = createLoop((elapsed) => {
    time += Math.min(0.06, (elapsed - lastElapsed) / 1000);
    lastElapsed = elapsed;
    render();
  });
  resize();
  whenFigureReady(() =>
    watchActivity(root, ({ inView, hidden, reduced: nextReduced }) => {
      reduced = nextReduced;
      if (!hidden && !reduced && inView.has(root)) loop.start();
      else loop.stop();
      if (reduced) render();
    }),
  );
}
