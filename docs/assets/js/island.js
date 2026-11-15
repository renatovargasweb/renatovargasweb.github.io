/* Nature Island: the home page model.
   A seven-sector input-output economy drawn as an isometric plate. Clicking a
   district spends 100 million there, pushes it through the Leontief inverse
   and prints what it cost. No libraries; data comes from #island-data. */
(() => {
const svg = document.getElementById('isl');
if (!svg) return;
const D = JSON.parse(document.getElementById('island-data').textContent);
const S = D.sectors, ix = Object.fromEntries(S.map((s, i) => [s.id, i]));
const NS = 'http://www.w3.org/2000/svg', N = 16, HW = 22, HH = 11, ZU = 22;
const $ = (id) => document.getElementById(id);
const tip = $('isl-tip'), stage = svg.parentNode;
const C = {blue: 'var(--blue)', red: 'var(--red)', yel: 'var(--yellow)', grn: 'var(--green)', wht: '#FFFDF6', ink: '#3A3F4B', sand: '#CDBE9A', leaf: '#2F6B4F'};
let rot = 0, year = 0, layer = 'money', busy = false, receiptNo = 41, top;

const LAYERS = {
  money:  {label: 'Money'},
  jobs:   {label: 'Jobs',   c: C.yel,  unit: 'jobs',              get: (s) => s.ts.jobs[year]},
  energy: {label: 'Energy', c: C.red,  unit: 'k barrels oil eq.', get: (s) => s.ts.energy[year]},
  co2:    {label: 'CO₂',    c: C.ink,  unit: 'kt CO₂e',           get: (s) => s.ts.co2[year]},
  water:  {label: 'Water',  c: C.blue, unit: 'million m³',        get: (s) => s.water == null ? null : s.water * s.output / 1000},
};

// ---- geometry -------------------------------------------------------------
const el = (t, a = {}, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
const R = (x, y) => rot === 0 ? [x, y] : rot === 1 ? [N - y, x] : rot === 2 ? [N - x, N - y] : [y, N - x];
const pr = (a, b, z = 0) => [(a - b) * HW, (a + b) * HH - z * ZU];
const P = (x, y, z = 0) => { const [a, b] = R(x, y); return pr(a, b, z); };
const RR = (x, y, w, d) => { const [a1, b1] = R(x, y), [a2, b2] = R(x + w, y + d); return [Math.min(a1, a2), Math.min(b1, b2), Math.abs(a1 - a2), Math.abs(b1 - b2)]; };
const pts = (a) => a.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
const depth = (x, y, w = 0, d = 0) => { const [X, Y, W, Dd] = RR(x, y, w, d); return X + W / 2 + Y + Dd / 2; };
const fmt = (v, d = 0) => v.toLocaleString('en-US', {maximumFractionDigits: d, minimumFractionDigits: d});
const big = (v) => v >= 1e6 ? fmt(v / 1e6, 2) + ' M' : v >= 1e4 ? fmt(v / 1e3, 0) + ' k' : fmt(v, v < 100 ? 1 : 0);

// A box always shows its top and the two faces toward the viewer.
function box(g, x, y, w, d, h, wall, tp, z0 = 0, win = 0) {
  const [X, Y, W, Dd] = RR(x, y, w, d), z1 = z0 + h;
  const b = el('g', {style: `--c:${wall};--t:${tp || wall}`}, g);
  el('polygon', {class: 'fl', points: pts([pr(X, Y + Dd, z1), pr(X + W, Y + Dd, z1), pr(X + W, Y + Dd, z0), pr(X, Y + Dd, z0)])}, b);
  el('polygon', {class: 'fr', points: pts([pr(X + W, Y, z1), pr(X + W, Y + Dd, z1), pr(X + W, Y + Dd, z0), pr(X + W, Y, z0)])}, b);
  el('polygon', {class: 'ft', points: pts([pr(X, Y, z1), pr(X + W, Y, z1), pr(X + W, Y + Dd, z1), pr(X, Y + Dd, z1)])}, b);
  for (let i = 1; i <= win; i++) {
    const z = z0 + h * i / (win + 1);
    el('polyline', {class: 'win', points: pts([pr(X, Y + Dd, z), pr(X + W, Y + Dd, z), pr(X + W, Y, z)])}, b);
  }
  return b;
}
// Any convex solid: faces pointing away from the viewer are dropped.
function solid(g, faces, cen) {
  const rc = (p) => { const [a, b] = R(p[0], p[1]); return [a, b, p[2]]; }, c0 = rc(cen);
  for (const [ps, c] of faces) {
    const q = ps.map(rc), u = [0, 1, 2].map((k) => q[1][k] - q[0][k]), v = [0, 1, 2].map((k) => q[2][k] - q[0][k]);
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = [0, 1, 2].map((k) => q.reduce((s, p) => s + p[k], 0) / q.length);
    if ((m[0] - c0[0]) * n[0] + (m[1] - c0[1]) * n[1] + (m[2] - c0[2]) * n[2] < 0) n = n.map((k) => -k);
    if (n[0] + n[1] + n[2] <= 1e-6) continue;
    const cls = n[0] <= 1e-6 && n[1] <= 1e-6 ? 'ft' : n[1] > n[0] ? 'fl' : 'fr';
    el('polygon', {class: cls, style: `--c:${c}`, points: pts(q.map((p) => pr(p[0], p[1], p[2])))}, g);
  }
}
// A house: walls plus a pitched roof. axis = direction of the ridge; t moves it off centre.
function gable(g, x, y, w, d, wallH, roofH, axis, wall, roof, t = .5) {
  box(g, x, y, w, d, wallH, wall, roof);
  const z1 = wallH, zr = wallH + roofH, cen = [x + w / 2, y + d / 2, wallH + roofH / 3];
  if (axis === 'x') {
    const yr = y + d * t;
    solid(g, [[[[x, y, z1], [x + w, y, z1], [x + w, yr, zr], [x, yr, zr]], roof], [[[x, y + d, z1], [x + w, y + d, z1], [x + w, yr, zr], [x, yr, zr]], roof],
      [[[x, y, z1], [x, y + d, z1], [x, yr, zr]], wall], [[[x + w, y, z1], [x + w, y + d, z1], [x + w, yr, zr]], wall]], cen);
  } else {
    const xr = x + w * t;
    solid(g, [[[[x, y, z1], [x, y + d, z1], [xr, y + d, zr], [xr, y, zr]], roof], [[[x + w, y, z1], [x + w, y + d, z1], [xr, y + d, zr], [xr, y, zr]], roof],
      [[[x, y, z1], [x + w, y, z1], [xr, y, zr]], wall], [[[x, y + d, z1], [x + w, y + d, z1], [xr, y + d, zr]], wall]], cen);
  }
}
function heap(g, x, y, w, d, h, c) {
  const a = [x + w / 2, y + d / 2, h], b = [[x, y, 0], [x + w, y, 0], [x + w, y + d, 0], [x, y + d, 0]];
  solid(g, b.map((p, i) => [[p, b[(i + 1) % 4], a], c]), [x + w / 2, y + d / 2, h / 4]);
}
function cyl(g, x, y, r, h, wall, tp, z0 = 0) {
  const [cx, cb] = P(x, y, z0), ct = P(x, y, z0 + h)[1], rx = r * HW * 1.414, ry = r * HH * 1.414, f = (v) => v.toFixed(1);
  const b = el('g', {style: `--c:${wall};--t:${tp || wall}`}, g);
  el('path', {class: 'fl', d: `M${f(cx - rx)},${f(ct)}V${f(cb)}A${f(rx)},${f(ry)} 0 0 0 ${f(cx + rx)},${f(cb)}V${f(ct)}Z`}, b);
  el('path', {class: 'fr nos', d: `M${f(cx)},${f(ct)}V${f(cb + ry)}A${f(rx)},${f(ry)} 0 0 0 ${f(cx + rx)},${f(cb)}V${f(ct)}Z`}, b);
  el('ellipse', {class: 'ft', cx: f(cx), cy: f(ct), rx: f(rx), ry: f(ry)}, b);
}
function flat(g, x, y, w, d, cls, c) {
  const [X, Y, W, Dd] = RR(x, y, w, d);
  return el('polygon', {class: cls, style: `--c:${c}`, points: pts([pr(X, Y), pr(X + W, Y), pr(X + W, Y + Dd), pr(X, Y + Dd)])}, g);
}
const wire = (g, p3, cls = 'wire') => el('polyline', {class: cls, points: pts(p3.map((p) => P(p[0], p[1], p[2] || 0)))}, g);
function tree(g, x, y, s = 1) {
  const a = P(x, y), b = P(x, y, .55 * s);
  el('line', {class: 'wire', x1: a[0], y1: a[1], x2: b[0], y2: b[1]}, g);
  el('circle', {class: 'tree', cx: b[0].toFixed(1), cy: (b[1] - 3 * s).toFixed(1), r: (5.5 * s).toFixed(1)}, g);
}
function smooth(points) {
  const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n = points.length;
  let d = 'M' + m(points[n - 1], points[0]).map((v) => v.toFixed(1));
  for (let i = 0; i < n; i++) d += ' Q' + points[i].map((v) => v.toFixed(1)) + ' ' + m(points[i], points[(i + 1) % n]).map((v) => v.toFixed(1));
  return d + 'Z';
}

// ---- the island ----------------------------------------------------------
const COAST = [[2, 1], [6, .6], [10, 1], [14, .9], [15.4, 3], [15.2, 6.6], [15.9, 10], [15.3, 13.6], [13.6, 15.5], [9.5, 15.4], [5.5, 15.9], [2.2, 15], [.9, 12], [1.1, 8], [.6, 4]];
const PLOT = {
  water: {c: C.blue, r: [1.9, 1.9, 3.9, 3.6]}, power: {c: C.yel, r: [6.9, 1.5, 3.1, 3.4]}, works: {c: C.red, r: [10.9, 1.9, 3.9, 4.1]},
  farm: {c: C.grn, r: [1.6, 6.6, 5, 6.1]}, town: {c: C.blue, r: [7.6, 6.6, 4.6, 4.3]}, waste: {c: C.sand, r: [13, 7, 2.2, 2.9]}, port: {c: C.ink, r: [6.3, 11.7, 7.6, 3]},
};
// Everything standing on a plot. Each entry: [footprint x, y, w, d, draw(group, growth)].
function scenery() {
  const it = [], add = (id, x, y, w, d, f) => it.push({id, k: depth(x, y, w, d), f});
  const bx = (id, x, y, w, d, h, wall, tp, win = 0, grow = true) => add(id, x, y, w, d, (g, k) => box(g, x, y, w, d, grow ? h * k : h, wall, tp, 0, win));
  const hs = (id, x, y, w, d, wh, rh, ax, wall, roof, t) => add(id, x, y, w, d, (g, k) => gable(g, x, y, w, d, wh * k, rh, ax, wall, roof, t));
  const cy = (id, x, y, r, h, wall, tp, z0 = 0, grow = false) => add(id, x - r, y - r, 2 * r, 2 * r, (g, k) => cyl(g, x, y, r, grow ? h * k : h, wall, tp, z0));
  const tr = (id, x, y, s) => add(id, x, y, 0, 0, (g) => tree(g, x, y, s));

  // Waterworks: dam, pump house, water tower
  bx('water', 4.75, 2.2, .22, 2.4, .5, C.wht, C.wht, 0, false);
  hs('water', 5.05, 2.3, .6, .9, .45, .3, 'y', C.wht, C.blue);
  add('water', 4.9, 4.4, .8, .8, (g) => {
    [[5.05, 4.55], [5.55, 4.55], [5.05, 5.05], [5.55, 5.05]].sort((a, b) => depth(...a) - depth(...b)).forEach(([x, y]) => wire(g, [[x, y, 0], [x, y, 1.25]], 'pole'));
    cyl(g, 5.3, 4.8, .42, .55, C.blue, C.wht, 1.25);
  });
  tr('water', 2.4, 5.1, .9); tr('water', 3.1, 5.2, 1.1); tr('water', 3.9, 5.05, .8);

  // Power: turbines, substation, a line of pylons
  [[7.5, 2.1], [8.7, 2.5], [7.6, 3.5]].forEach(([x, y], i) => add('power', x, y, 0, 0, (g) => {
    const a = P(x, y), b = P(x, y, 2.7);
    el('line', {class: 'pole', x1: a[0], y1: a[1], x2: b[0], y2: b[1]}, g);
    const sp = el('g', {class: 'spin', style: `animation-delay:${-i * 1.7}s`}, el('g', {transform: `translate(${b[0].toFixed(1)},${b[1].toFixed(1)})`}, g));
    el('circle', {r: 15, fill: 'none'}, sp);
    [0, 120, 240].forEach((deg) => el('line', {x2: 0, y2: -14, transform: `rotate(${deg})`}, sp));
  }));
  bx('power', 9, 3.2, .8, .8, .6, C.yel, C.wht, 0, false);
  cy('power', 9.25, 4.35, .14, .45, C.wht, C.ink); cy('power', 9.65, 4.35, .14, .45, C.wht, C.ink);
  [7.3, 8.4].forEach((x) => add('power', x, 4.6, 0, 0, (g) => { wire(g, [[x - .2, 4.6, 0], [x, 4.6, 1.3], [x + .2, 4.6, 0]]); wire(g, [[x - .3, 4.6, 1], [x + .3, 4.6, 1]]); }));
  add('power', 7.85, 4.6, 0, 0, (g) => wire(g, [[7.3, 4.6, 1], [7.85, 4.6, .88], [8.4, 4.6, 1], [9.4, 4.4, .5]], 'cable'));

  // Industry: sawtooth hall, stacks, tank, shed
  [0, 1, 2].forEach((i) => hs('works', 11.3 + i * .8, 2.4, .8, 2.2, .95, .45, 'y', C.wht, C.red, .82));
  add('works', 13.9, 2.5, .4, .4, (g, k) => {
    cyl(g, 14.1, 2.7, .2, 2.9 * k, C.red, C.ink); cyl(g, 14.1, 2.7, .2, .3, C.wht, C.wht, 1.6 * k);
    const p = P(14.1, 2.7, 2.9 * k);
    [0, 1, 2].forEach((i) => el('circle', {class: 'puff', cx: p[0].toFixed(1), cy: (p[1] - 6).toFixed(1), r: 5, style: `animation-delay:${-i * 1.3}s`}, g));
  });
  cy('works', 13.45, 3.35, .16, 2, C.wht, C.ink, 0, true);
  cy('works', 13.8, 4.7, .5, .8, C.ink, C.wht);
  hs('works', 11.3, 4.9, 1.8, .8, .5, .3, 'x', C.wht, C.yel);
  bx('works', 13.2, 5.3, .5, .3, .3, C.blue, C.blue, 0, false); bx('works', 13.8, 5.4, .5, .3, .3, C.yel, C.yel, 0, false);

  // Farms: barn, silo, hay, a tractor, a windbreak
  hs('farm', 2, 11.3, 1.5, 1, .65, .5, 'x', C.red, C.wht);
  cy('farm', 4, 11.8, .33, 1.6, C.wht, C.yel, 0, true);
  [[4.9, 11.5], [5.3, 11.9], [4.8, 12.1]].forEach(([x, y]) => cy('farm', x, y, .17, .22, C.yel, C.yel));
  add('farm', 3.4, 9.2, .5, .3, (g) => { box(g, 3.4, 9.2, .5, .3, .22, C.red, C.red); box(g, 3.4, 9.2, .2, .3, .2, C.wht, C.ink, .22); });
  [[5.9, 11.2], [6.25, 11.8], [5.95, 12.35], [1.85, 12.35]].forEach(([x, y], i) => tr('farm', x, y, .9 + (i % 2) * .25));

  // Town: houses, a civic block, a site with a crane
  [[7.9, 6.9, .9, .8, .5, .4, 'x', C.blue], [9.1, 6.9, .8, 1, .6, .4, 'y', C.red], [10.3, 6.9, 1.1, .8, .5, .4, 'x', C.blue], [11.5, 7.9, .6, .9, .5, .35, 'y', C.yel],
    [7.9, 8.2, 1, .8, .6, .4, 'x', C.yel], [7.9, 9.6, .8, .9, .5, .4, 'y', C.blue], [9.2, 9.8, 1.1, .8, .55, .4, 'x', C.red]]
    .forEach(([x, y, w, d, wh, rh, ax, roof]) => hs('town', x, y, w, d, wh, rh, ax, C.wht, roof));
  bx('town', 9.4, 8.3, 1, 1, 2.1, C.wht, C.blue, 3);
  bx('town', 10.7, 8.3, .7, .7, 1.3, C.wht, C.red, 2);
  add('town', 10.9, 9.8, .9, .9, (g, k) => {
    const h = 1.3 * k, c = [[10.9, 9.8], [11.8, 9.8], [11.8, 10.7], [10.9, 10.7]];
    box(g, 10.9, 9.8, .9, .9, h * .45, C.wht, C.wht);
    c.forEach(([x, y]) => wire(g, [[x, y, 0], [x, y, h]], 'frame'));
    wire(g, [...c, c[0]].map(([x, y]) => [x, y, h]), 'frame');
  });
  add('town', 12, 10.6, 0, 0, (g) => { wire(g, [[12, 10.6, 0], [12, 10.6, 2.9]], 'pole'); wire(g, [[12, 10.9, 2.75], [12, 10.6, 2.9], [12, 9.3, 2.75]]); wire(g, [[12, 10.9, 2.75], [12, 9.3, 2.75]]); wire(g, [[12, 9.6, 2.75], [12, 9.6, 1.7]], 'cable'); });
  [[8.9, 7.95], [10.2, 7.95], [8.95, 9.3], [10.45, 9.95]].forEach(([x, y]) => tr('town', x, y, .8));

  // Salvage yard: heaps, skips, a truck
  add('waste', 13.2, 7.3, 1, 1, (g, k) => heap(g, 13.2, 7.3, 1, 1, .8 * k, C.sand));
  add('waste', 14, 8, 1, 1.1, (g, k) => heap(g, 14, 8, 1, 1.1, 1.1 * k, C.ink));
  bx('waste', 13.2, 8.7, .55, .3, .28, C.red, C.red, 0, false); bx('waste', 13.2, 9.15, .55, .3, .28, C.blue, C.blue, 0, false);
  add('waste', 14, 9.4, .7, .3, (g) => { box(g, 14, 9.4, .45, .3, .3, C.yel, C.yel); box(g, 14.48, 9.4, .22, .3, .24, C.wht, C.wht); });

  // Port & services: towers, sheds, a container yard and its crane
  [[6.8, 12.1, 1.1, 1.1, 3.6, C.blue, C.wht, 6], [8.3, 12.2, 1, 1, 2.6, C.wht, C.blue, 4], [9.6, 12.1, 1.2, 1, 4.4, C.blue, C.wht, 8], [11.2, 12.2, 1, 1.1, 3, C.wht, C.red, 5]]
    .forEach(([x, y, w, d, h, wall, tp, win]) => bx('port', x, y, w, d, h, wall, tp, win));
  hs('port', 6.8, 13.6, 2.2, .8, .5, .3, 'x', C.wht, C.yel); hs('port', 9.3, 13.6, 2.2, .8, .5, .3, 'x', C.wht, C.yel);
  [[12.5, 12.2, C.red, 0], [12.5, 12.6, C.blue, 0], [12.5, 12.2, C.yel, .26], [13.2, 12.3, C.blue, 0], [12.6, 13.2, C.yel, 0], [13.2, 13.3, C.red, 0], [13.2, 13.3, C.wht, .26]]
    .forEach(([x, y, c, z]) => add('port', x, y + z * .01, .55, .3, (g) => box(g, x, y, .55, .3, .26, c, c, z)));
  add('port', 12.2, 14.2, 1, .3, (g) => { [[12.2, 14.2], [13.2, 14.2], [12.2, 14.5], [13.2, 14.5]].forEach(([x, y]) => wire(g, [[x, y, 0], [x, y, 1.3]], 'pole')); wire(g, [[12.2, 14.2, 1.3], [13.2, 14.2, 1.3], [13.2, 14.5, 1.3], [12.2, 14.5, 1.3], [12.2, 14.2, 1.3]]); wire(g, [[12.7, 14.35, 1.3], [12.7, 15.6, 1.3]]); wire(g, [[12.7, 15.3, 1.3], [12.7, 15.3, .5]], 'cable'); });
  return it;
}

// Trade runs on a ring road around the town; each district joins it by a stub.
const RING = [[7.1, 6.05], [12.6, 6.05], [12.6, 11.35], [7.1, 11.35]], RT = [0, 5.5, 10.8, 16.3], RLEN = 21.6;
const GATE = {
  water: {t: 0, stub: [[5, 5.5], [5, 6.05]]}, power: {t: 1.3, stub: [[8.4, 4.9]]}, works: {t: 4.7, stub: [[11.8, 6]]},
  waste: {t: 7.85, stub: [[13, 8.4]]}, port: {t: 12.8, stub: [[10.6, 11.7]]}, town: {t: 13.5, stub: [[9.9, 10.9]]}, farm: {t: 18.65, stub: [[6.6, 9]]},
};
function ringPt(t) {
  let k = 3; while (RT[k] > t) k--;
  const a = RING[k], b = RING[(k + 1) % 4], len = (k === 3 ? RLEN : RT[k + 1]) - RT[k], u = (t - RT[k]) / len;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}
function route(i, j) {
  const A = GATE[S[i].id], B = GATE[S[j].id], fwd = ((B.t - A.t + RLEN) % RLEN) <= RLEN / 2;
  const span = fwd ? (B.t - A.t + RLEN) % RLEN : (A.t - B.t + RLEN) % RLEN, mid = [];
  for (let k = 0; k < 4; k++) { const off = fwd ? (RT[k] - A.t + RLEN) % RLEN : (A.t - RT[k] + RLEN) % RLEN; if (off > 0 && off < span) mid.push([off, RING[k]]); }
  mid.sort((a, b) => a[0] - b[0]);
  return [...A.stub, ringPt(A.t), ...mid.map((m) => m[1]), ringPt(B.t), ...B.stub.slice().reverse()];
}
const PAIRS = [];
S.forEach((a, i) => S.forEach((b, j) => { if (i < j) { const ab = D.Z[i][j], ba = D.Z[j][i]; if (ab + ba > 40) PAIRS.push({i, j, ab, ba}); } }));
PAIRS.sort((a, b) => (b.ab + b.ba) - (a.ab + a.ba));
const line = (pp) => 'M' + pp.map(([x, y]) => P(x, y).map((v) => v.toFixed(1))).join(' L');

function draw() {
  svg.textContent = '';
  svg.classList.toggle('dim', layer !== 'money');
  const growth = (id) => S[ix[id]].ts.va[year] / S[ix[id]].ts.va[0];
  const ship = (g) => { box(g, 9.6, 16.7, 2.6, .7, .45, C.red, C.wht, -1.3); box(g, 9.8, 16.8, .6, .5, .5, C.wht, C.blue, -.85); [[10.6, C.blue], [11.2, C.yel], [11.6, C.wht]].forEach(([x, c]) => box(g, x, 16.85, .4, .4, .26, c, c, -.85)); };
  const shipBehind = depth(9.6, 16.7, 2.6, .7) < N;

  // sea, strata, land
  [1.17, 1.09].forEach((k) => el('path', {class: 'ripple', d: smooth(COAST.map(([x, y]) => P(8 + (x - 8) * k, 8 + (y - 8) * k, -1.35)))}, svg));
  if (shipBehind) ship(el('g', {class: 'bld', 'data-s': 'port'}, svg));
  [[-1.35, 'st3'], [-.9, 'st2'], [-.45, 'st1'], [0, 'coast']].forEach(([z, c]) => el('path', {class: c, d: smooth(COAST.map(([x, y]) => P(x, y, z)))}, svg));
  el('text', {class: 'fig', x: -372, y: 404}, svg).textContent = 'PLATE I · N ' + ['↗', '↘', '↙', '↖'][rot];

  // ground: plots, fields, reservoir, road
  for (const id in PLOT) flat(svg, ...PLOT[id].r, 'plot', PLOT[id].c).dataset.s = id;
  const gf = el('g', {'data-s': 'farm'}, svg);
  for (let i = 0; i < 4; i++) {
    const y = 6.9 + i * 1.05;
    flat(gf, 1.9, y, 4.4, .8, 'flat', i % 2 ? C.yel : C.grn);
    [.2, .4, .6].forEach((o) => wire(gf, [[1.9, y + o], [6.3, y + o]], 'row'));
  }
  const gw = el('g', {'data-s': 'water'}, svg);
  flat(gw, 2.2, 2.2, 2.55, 2.4, 'flat', C.blue);
  [[2.5, 2.9, 1.2], [3.1, 3.6, 1.3], [2.6, 4.1, .9]].forEach(([x, y, l]) => wire(gw, [[x, y], [x + l, y]], 'wave'));
  el('path', {class: 'road', d: line([...RING, RING[0]]) + ' ' + Object.values(GATE).map((g) => line([...g.stub, ringPt(g.t)])).join(' ')}, svg);

  // trade lines
  const gt = el('g', {}, svg);
  PAIRS.forEach((p) => {
    const d = line(route(p.i, p.j)), ends = S[p.i].id + ' ' + S[p.j].id;
    el('path', {class: 'flow', d, 'stroke-width': (1.2 + Math.log10(p.ab + p.ba) * 1.5).toFixed(1), 'data-ends': ends}, gt);
    el('path', {class: 'flow-m', d, 'data-ends': ends}, gt);
  });

  // everything that stands up, back to front
  scenery().sort((a, b) => a.k - b.k).forEach((it) => it.f(el('g', {class: 'bld', 'data-s': it.id}, svg), growth(it.id)));
  if (!shipBehind) ship(el('g', {class: 'bld', 'data-s': 'port'}, svg));

  // account cubes floating over each district: volume = value
  top = el('g', {}, svg);
  const L = LAYERS[layer];
  if (L.get) {
    const vals = S.map((s) => L.get(s)), max = Math.max(...vals.filter((v) => v != null));
    S.map((s, i) => ({s, v: vals[i], k: depth(...PLOT[s.id].r)})).sort((a, b) => a.k - b.k).forEach(({s, v}) => {
      const [x, y, w, d] = PLOT[s.id].r, cx = x + w / 2, cy0 = y + d / 2, z0 = 3.2;
      const side = v == null ? .7 : Math.max(.28, 2.6 * Math.cbrt(v / max));
      const g = el('g', {class: v == null ? 'ghost' : 'cube', 'data-s': s.id}, top), a = P(cx, cy0), b = P(cx, cy0, z0);
      el('line', {class: 'ldr', x1: a[0], y1: a[1], x2: b[0], y2: b[1]}, g);
      box(g, cx - side / 2, cy0 - side / 2, side, side, side, L.c, L.c, z0);
      const t = P(cx, cy0, z0 + side);
      el('text', {class: 'val' + (v == null ? ' nm' : ''), x: t[0], y: t[1] - 14}, g).textContent = v == null ? 'not kept' : big(v);
    });
  }
  S.forEach((s, i) => {
    const [x, y, w, d] = PLOT[s.id].r, c = [[x, y], [x + w, y], [x, y + d], [x + w, y + d]].map(([a, b]) => P(a, b)).sort((a, b) => a[1] - b[1])[0];
    const g = el('g', {class: 'bdg', 'data-s': s.id, transform: `translate(${c[0].toFixed(1)},${(c[1] - 2).toFixed(1)})`}, top);
    el('circle', {r: 8}, g); el('text', {}, g).textContent = i + 1;
  });
}

// ---- parts list and controls ---------------------------------------------
const parts = $('isl-parts');
function drawParts() {
  parts.textContent = '';
  S.forEach((s, i) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span class="n">${i + 1}</span><span>${s.name}</span><span class="v">${fmt(s.ts.va[year])} M</span>`;
    b.dataset.s = s.id; b.title = 'Spend 100 million on ' + s.name;
    li.appendChild(b); parts.appendChild(li);
  });
  $('isl-ph').textContent = 'Value added, year ' + (year + 1);
}
const layersEl = $('isl-layers');
for (const k in LAYERS) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = LAYERS[k].label; b.setAttribute('aria-pressed', k === layer);
  b.onclick = () => { layer = k; [...layersEl.children].forEach((x) => x.setAttribute('aria-pressed', x === b)); draw(); };
  layersEl.appendChild(b);
}
$('isl-yr').oninput = (e) => { year = +e.target.value; $('isl-yrv').textContent = year + 1; draw(); drawParts(); };
const turn = (d) => { rot = (rot + d + 4) % 4; draw(); };
$('isl-rl').onclick = () => turn(1);
$('isl-rr').onclick = () => turn(-1);

// ---- hover ---------------------------------------------------------------
function hot(id) {
  document.querySelectorAll('#isl .hot, #isl-parts li.on').forEach((e) => e.classList.remove('hot', 'on'));
  svg.querySelectorAll('[data-ends]').forEach((e) => e.classList.toggle('off', !!id && !e.dataset.ends.split(' ').includes(id)));
  if (!id) return;
  svg.querySelectorAll(`[data-s="${id}"]`).forEach((e) => e.classList.add('hot'));
  parts.querySelector(`[data-s="${id}"]`)?.parentNode.classList.add('on');
}
svg.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  const t = e.target.closest('[data-s]');
  if (!t) { hot(null); tip.style.opacity = 0; return; }
  const s = S[ix[t.dataset.s]], L = LAYERS[layer], i = ix[s.id]; hot(s.id);
  const cust = S.map((o, k) => [o.name, k === i ? 0 : D.Z[i][k]]).sort((a, b) => b[1] - a[1])[0];
  let extra = `Value added ${fmt(s.ts.va[year])} M · ${big(s.ts.jobs[year])} jobs<br>Best customer: ${cust[0]}, ${fmt(cust[1])} M a year`;
  if (L.get) { const v = L.get(s); extra = v == null ? `${L.label}: no account kept for this district` : `${L.label}: ${big(v)} ${L.unit}`; }
  tip.innerHTML = `<b>${i + 1} · ${s.name}</b>${s.blurb}<br>${extra}`; tip.style.opacity = 1;
  tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = (e.clientY + 16) + 'px';
});
svg.addEventListener('pointerleave', () => { hot(null); tip.style.opacity = 0; });
parts.addEventListener('pointerover', (e) => hot(e.target.closest('[data-s]')?.dataset.s));
parts.addEventListener('pointerleave', () => hot(null));

// ---- click to spend, drag to turn ---------------------------------------
let down = null;
svg.addEventListener('pointerdown', (e) => { down = {x: e.clientX, t: e.target}; });
svg.addEventListener('pointerup', (e) => {
  if (!down) return;
  const dx = e.clientX - down.x, t = down.t.closest?.('[data-s]'); down = null;
  if (Math.abs(dx) > 50) turn(dx > 0 ? 1 : -1);
  else if (Math.abs(dx) < 8 && t) spend(t.dataset.s);
});
parts.addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) spend(b.dataset.s); });

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
function spend(id) {
  if (busy) return;
  $('isl-hint').hidden = true;
  const j = ix[id], dx = D.L.map((row) => row[j] * 100);
  const done = () => { busy = false; pluses(dx); receipt(j, dx); };
  if (still) return done();
  busy = true;
  const coins = [];
  S.forEach((s, i) => {
    if (i === j || dx[i] < .4) return;
    const ln = route(j, i).map(([x, y]) => P(x, y)), n = Math.min(7, Math.max(1, Math.round(dx[i] / 3))), cum = [0];
    for (let k = 1; k < ln.length; k++) cum.push(cum[k - 1] + Math.hypot(ln[k][0] - ln[k - 1][0], ln[k][1] - ln[k - 1][1]));
    for (let c = 0; c < n; c++) coins.push({ln, cum, delay: c * 90 + i * 30, e: el('ellipse', {class: 'coin', rx: 4.5, ry: 2.6, opacity: 0}, top)});
  });
  const t0 = performance.now(), dur = 1300;
  (function tick(now) {
    let live = false;
    for (const c of coins) {
      const u = (now - t0 - c.delay) / dur;
      if (u < 0) { live = true; continue; }
      if (u >= 1) { c.e.setAttribute('opacity', 0); continue; }
      live = true;
      const s = u * c.cum[c.cum.length - 1]; let q = 1; while (q < c.cum.length - 1 && c.cum[q] < s) q++;
      const a = c.ln[q - 1], b = c.ln[q], k = (s - c.cum[q - 1]) / (c.cum[q] - c.cum[q - 1] || 1);
      c.e.setAttribute('cx', a[0] + (b[0] - a[0]) * k);
      c.e.setAttribute('cy', a[1] + (b[1] - a[1]) * k - Math.abs(Math.sin(u * Math.PI * 5)) * 7);
      c.e.setAttribute('opacity', 1);
    }
    if (live) requestAnimationFrame(tick); else { coins.forEach((c) => c.e.remove()); done(); }
  })(t0);
}
function pluses(dx) {
  S.forEach((s, i) => {
    if (dx[i] < .05) return;
    const [x, y, w, d] = PLOT[s.id].r, p = P(x + w / 2, y + d / 2, 1.2);
    const t = el('text', {class: 'plus', x: p[0], y: p[1]}, top);
    t.textContent = '+' + fmt(dx[i], 1); setTimeout(() => t.remove(), 1900);
  });
}
const rc = $('isl-receipt');
function receipt(j, dx) {
  const sum = (key) => S.reduce((v, s, i) => v + (s[key] == null ? 0 : s[key] * dx[i]), 0);
  const tot = dx.reduce((a, b) => a + b, 0), va = sum('va'), imp = sum('import');
  const jobs = sum('jobs'), co2 = sum('co2'), en = sum('energy'), wa = sum('water');
  const row = (a, b) => `<div class="r"><span>${a}</span><span>${b}</span></div>`;
  const went = S.map((s, i) => [s.name, dx[i]]).sort((a, b) => b[1] - a[1]).filter((r) => r[1] >= .05);
  const lines = [
    `<div class="rh">Nature Island</div>`, `<div class="c">Department of Our Future<br>Receipt no. ${String(++receiptNo).padStart(4, '0')}</div>`, `<hr>`,
    `<div class="h">You spent</div>`, row(S[j].name, '100.0 M'), `<hr>`,
    `<div class="h">Where it went</div>`, ...went.map(([n, v]) => row(n, fmt(v, 1))),
    row('<b>Output stirred up</b>', fmt(tot, 1) + ' M'), row('kept as income', fmt(va, 1) + ' M'), row('left on a ship', fmt(imp, 1) + ' M'), `<hr>`,
    `<div class="h">Not on the price tag</div>`,
    row('Jobs supported', fmt(jobs)), row('Greenhouse gas', big(co2) + ' t'), row('Energy', big(en) + ' boe'), row('Water drawn', big(wa * 1000) + ' m³'),
    `<hr>`,
    `<div class="c">Thank you.<br>Nature keeps the carbon copy.</div>`,
  ];
  rc.innerHTML = '<button type="button" class="x" aria-label="Close receipt">×</button>' + lines.map((l, i) => `<div class="ln" style="animation-delay:${i * 45}ms">${l}</div>`).join('');
  rc.hidden = false; stage.classList.add('has-r');
}
rc.addEventListener('click', (e) => { if (e.target.closest('.x')) { rc.hidden = true; stage.classList.remove('has-r'); } });

new IntersectionObserver(([e]) => svg.classList.toggle('idle', !e.isIntersecting)).observe(svg);
draw(); drawParts();

// ?spend=farm&layer=co2&rot=1&year=3 opens the page in a given state
const q = new URLSearchParams(location.search);
if (q.has('layer') || q.has('rot') || q.has('year')) {
  if (LAYERS[q.get('layer')]) { layer = q.get('layer'); [...layersEl.children].forEach((x, i) => x.setAttribute('aria-pressed', Object.keys(LAYERS)[i] === layer)); }
  rot = (+q.get('rot') || 0) % 4; year = Math.min(6, +q.get('year') || 0); $('isl-yr').value = year; $('isl-yrv').textContent = year + 1;
  draw(); drawParts();
}
if (ix[q.get('spend')] != null) setTimeout(() => spend(q.get('spend')), 60);
})();
