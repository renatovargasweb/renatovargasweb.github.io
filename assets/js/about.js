/* The service record: engagements and publications from data/cv/*.csv,
   drawn as a timeline, a map and two linked lists. No libraries. */
(() => {
const src = document.getElementById('cv-data');
if (!src) return;
const D = JSON.parse(src.textContent), EX = D.experience, PB = D.publications, W = D.world;
const NS = 'http://www.w3.org/2000/svg', $ = (id) => document.getElementById(id);
const el = (t, a = {}, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const list = (s) => (s || '').split(';').map((x) => x.trim()).filter(Boolean);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
// The CSVs keep the CV's own Markdown; this covers the little of it they use.
const md = (s) => esc(s).replace(/\\([()\[\]])/g, '$1').replace(/---/g, '—').replace(/--/g, '–')
  .replace(/\[([^\]]+)\]\(\(?([^)\s]+)\)\)?/g, '<a href="$2" rel="noopener">$1</a>')
  .replace(/\*\*\s*_?(.+?)_?\s*\*\*/g, '<b>$1</b>').replace(/(^|[\s(>"])[*_]([^*_]+)[*_]/g, '$1<i>$2</i>');

const GROUPS = {'World Bank': 'var(--blue)', 'UN system': 'var(--green)', 'IDB': 'var(--red)', 'Academia': 'var(--yellow)',
  'Private sector': '#8A8D93', 'Government': '#CDBE9A', 'Bilateral cooperation': '#FFFDF6', 'NGO / think tank': '#9B6A8C'};
const THEMES = {seea: 'Environmental accounts', bioeconomy: 'Bioeconomy', io: 'Input-output', cge: 'General equilibrium', surveys: 'Household surveys',
  climate: 'Climate', energy: 'Energy', data: 'Data tools', training: 'Training', writing: 'Writing', fiscal: 'Fiscal', gis: 'GIS',
  ecosystems: 'Ecosystem services', agriculture: 'Agriculture', monitoring: 'Monitoring & evaluation', policy: 'Policy'};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ym = (s) => { const [y, m] = s.split('-').map(Number); return y + (m - 1) / 12; };
const nice = (s) => { const [y, m] = s.split('-').map(Number); return MON[m - 1] + ' ' + y; };
const cname = (iso) => W.names[iso] || iso;

EX.forEach((e) => {
  e.t0 = ym(e.start); e.t1 = ym(e.end) + 1 / 12;
  e.C = list(e.countries); e.T = list(e.themes); e.P = list(e.publications);
  e.when = e.dates_note || (e.start === e.end ? nice(e.start) : nice(e.start) + ' – ' + nice(e.end));
});
const pubFrom = {};
EX.forEach((e) => e.P.forEach((k) => (pubFrom[k] = pubFrom[k] || []).push(e)));
const F = {theme: null, group: null, country: null};
const match = (e) => (!F.theme || e.T.includes(F.theme)) && (!F.group || e.org_group === F.group) && (!F.country || e.C.includes(F.country));

// ---- headline numbers ------------------------------------------------------
const first = Math.min(...EX.map((e) => +e.start.slice(0, 4))), last = Math.max(...EX.map((e) => +e.end.slice(0, 4)));
const nC = new Set(EX.flatMap((e) => e.C)).size;
$('stats').innerHTML = [[last - first, 'years'], [EX.length, 'engagements'], [nC, 'countries'], [PB.length, 'publications']]
  .map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');

// ---- filters ---------------------------------------------------------------
function chips(host, key, items) {
  items.forEach(([val, label, colour]) => {
    const b = h('button', 'chip', (colour ? `<i style="--c:${colour}"></i>` : '') + label);
    b.type = 'button'; b.dataset.v = val; b.setAttribute('aria-pressed', 'false');
    b.onclick = () => { F[key] = F[key] === val ? null : val; apply(); };
    host.appendChild(b);
  });
}
const tCount = {}; EX.forEach((e) => e.T.forEach((t) => tCount[t] = (tCount[t] || 0) + 1));
chips($('f-theme'), 'theme', Object.keys(tCount).sort((a, b) => tCount[b] - tCount[a]).map((t) => [t, THEMES[t] || t]));
chips($('f-group'), 'group', Object.keys(GROUPS).filter((g) => EX.some((e) => e.org_group === g)).map((g) => [g, g, GROUPS[g]]));
$('f-clear').onclick = () => { F.theme = F.group = F.country = null; apply(); };

// ---- timeline: every engagement packed into as few rows as fit -------------
const tl = $('tl'), X0 = first, X1 = last + 1, TW = 760, PADL = 8, ROW = 15;
const tx = (t) => PADL + (t - X0) / (X1 - X0) * (TW - 2 * PADL);
const rows = [];
[...EX].sort((a, b) => a.t0 - b.t0).forEach((e) => {
  const w = Math.max(e.t1, e.t0 + .35);
  let r = rows.findIndex((end) => end <= e.t0); if (r < 0) { r = rows.length; rows.push(0); }
  rows[r] = w + .08; e.row = r; e.tw = w;
});
const TH = rows.length * ROW + 26;
tl.setAttribute('viewBox', `0 0 ${TW} ${TH}`);
for (let y = X0; y <= X1; y++) {
  el('line', {class: 'axis', x1: tx(y), x2: tx(y), y1: 0, y2: TH - 16}, tl);
  if (y < X1 && (y - X0) % 2 === 0) el('text', {class: 'yr', x: tx(y + .5), y: TH - 4}, tl).textContent = y;
}
EX.forEach((e) => {
  const r = el('rect', {class: 'bar', x: tx(e.t0).toFixed(1), y: (rows.length - 1 - e.row) * ROW + 2, width: (tx(e.tw) - tx(e.t0)).toFixed(1), height: ROW - 4, style: `--c:${GROUPS[e.org_group] || '#ccc'}`, tabindex: 0, 'data-id': e.id}, tl);
  el('title', {}, r).textContent = `${e.role} · ${e.organization} · ${e.when}`;
  e.bar = r;
});

// ---- map: country outlines; the ones worked on are filled and clickable ---
const map = $('map'), cg = {}, worked = new Set(EX.flatMap((e) => e.C));
map.setAttribute('viewBox', `0 0 ${W.w} ${W.h}`);
for (const iso of Object.keys(W.paths).sort((a, b) => worked.has(a) - worked.has(b))) {
  const g = el('g', {class: 'c', 'data-iso': iso}, map);
  el('path', {class: 'land', d: W.paths[iso]}, g);
  // small countries get a wide invisible outline so they can be hit
  if (worked.has(iso)) el('path', {class: 'hit', d: W.paths[iso]}, g);
  el('title', {}, g).textContent = cname(iso);
  cg[iso] = g;
}
chips($('f-country'), 'country', [...worked].sort((a, b) => cname(a).localeCompare(cname(b))).map((k) => [k, cname(k)]));

// ---- the two lists ----------------------------------------------------------
const exHost = $('ex-list'), pbHost = $('pb-list');
EX.forEach((e) => {
  const c = h('article', 'rec'); c.id = e.id;
  const where = [e.location, e.C.map(cname).join(', ')].filter(Boolean);
  c.innerHTML = `<span class="id">${e.id.toUpperCase()}</span>
    <div class="meta"><i style="--c:${GROUPS[e.org_group] || '#ccc'}"></i>${e.when}</div>
    <h3>${esc(e.role)}</h3>
    <div class="org">${esc(e.organization)}${e.location ? ' · ' + esc(e.location) : ''}</div>
    <ul>${e.highlights.split(' | ').map((b) => `<li>${md(b)}</li>`).join('')}</ul>
    <div>${e.C.map((k) => `<span class="chip">${cname(k)}</span>`).join('')}${e.T.map((t) => `<span class="chip">${THEMES[t] || t}</span>`).join('')}</div>` +
    (e.P.length ? `<div class="pubs">Publications from this work:${e.P.map((k) => `<button type="button" data-go="pub-${k}">${esc(PB.find((p) => p.key === k).title)}</button>`).join('')}</div>` : '');
  exHost.appendChild(c); e.card = c;
});
const byLang = {};
PB.forEach((p) => (byLang[p.Language] = byLang[p.Language] || []).push(p));
Object.keys(byLang).forEach((lang) => {
  pbHost.appendChild(h('h3', 'lang-h', `${lang}<span>${byLang[lang].length} titles</span>`));
  byLang[lang].sort((a, b) => (b.year || 0) - (a.year || 0)).forEach((p) => {
    const d = h('div', 'pub'); d.id = 'pub-' + p.key;
    const from = pubFrom[p.key] || [];
    d.innerHTML = `<span class="yr">${p.year || 'n.d.'}</span><span class="ty">${p.type}</span>
      <a class="ti" href="${esc(p.url)}" rel="noopener">${esc(p.title.replace(/^"|"\.?$|\.$/g, ''))}</a>
      <details><summary class="ty">Full reference</summary><div class="ci">${md(p.citation)}</div></details>` +
      from.map((e) => `<button type="button" class="from" data-go="${e.id}">From: ${esc(e.role)}, ${e.start.slice(0, 4)}</button>`).join('<br>');
    pbHost.appendChild(d); p.node = d;
  });
});

// ---- linking ---------------------------------------------------------------
function flash(node) {
  document.querySelectorAll('.rec.hot, .pub.hot').forEach((n) => n.classList.remove('hot'));
  node.classList.add('hot'); node.scrollIntoView({behavior: 'smooth', block: 'center'});
}
document.addEventListener('click', (ev) => {
  const go = ev.target.closest('[data-go]');
  if (go) { const n = document.getElementById(go.dataset.go); if (n) { if (n.hidden) { F.theme = F.group = F.country = null; apply(); } flash(n); } return; }
  const bar = ev.target.closest('.bar');
  if (bar) return flash(document.getElementById(bar.dataset.id));
  const c = ev.target.closest('#map .c.on');
  if (c) { F.country = F.country === c.dataset.iso ? null : c.dataset.iso; apply(); }
});
tl.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.dataset.id) flash(document.getElementById(ev.target.dataset.id)); });
const hover = (id, on) => { const e = EX.find((x) => x.id === id); if (!e) return; e.bar.classList.toggle('hot', on); e.C.forEach((k) => cg[k]?.classList.toggle('hot', on)); };
tl.addEventListener('pointerover', (ev) => ev.target.dataset.id && hover(ev.target.dataset.id, true));
tl.addEventListener('pointerout', (ev) => ev.target.dataset.id && hover(ev.target.dataset.id, false));
exHost.addEventListener('pointerover', (ev) => { const c = ev.target.closest('.rec'); if (c) hover(c.id, true); });
exHost.addEventListener('pointerout', (ev) => { const c = ev.target.closest('.rec'); if (c) hover(c.id, false); });

function apply() {
  const any = F.theme || F.group || F.country, shown = EX.filter(match), keys = new Set(shown.flatMap((e) => e.P));
  EX.forEach((e) => { const ok = match(e); e.card.hidden = !ok; e.bar.classList.toggle('off', !ok); });
  const lit = new Set(shown.flatMap((e) => e.C));
  for (const iso in cg) { cg[iso].classList.toggle('on', worked.has(iso)); cg[iso].classList.toggle('off', worked.has(iso) && !lit.has(iso)); }
  PB.forEach((p) => p.node.classList.toggle('off', !!any && !keys.has(p.key)));
  document.querySelectorAll('#f-theme .chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === F.theme));
  document.querySelectorAll('#f-group .chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === F.group));
  document.querySelectorAll('#f-country .chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === F.country));
  $('f-clear').hidden = !any;
  $('f-count').textContent = `${shown.length} of ${EX.length} engagements` + (F.country ? ' · ' + cname(F.country) : '');
}
apply();
})();
