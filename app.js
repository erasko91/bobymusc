'use strict';
/* BobyMusc — carnet de musculation 100 % gratuit. Toutes les données restent sur le téléphone. */

const VERSION = '1.9.0';
window.BOBY_VERSION = VERSION;
// Ancienne page restée en mémoire avec le nouveau code (fichiers manquants) : on recharge une page neuve
if ((typeof MOTIV_ACTIONS === 'undefined' || typeof TIMER_ACTIONS === 'undefined') && !/[?&]fresh=/.test(location.search)) {
  location.replace(location.pathname + '?fresh=' + Date.now() + location.hash);
  throw new Error('Ancienne page en mémoire : rechargement');
}
const APP_URL = 'https://bobymusc-app.web.app/';
const KEY = 'bobmusc-data-v1';
const LB = 2.20462;
const DAY = 86400000;
const ACCENTS = { orange: '#FF6B1A', rouge: '#EF4444', vert: '#22C55E', violet: '#8B5CF6', rose: '#EC4899', jaune: '#EAB308' };
const SET_TYPES = { n: 'Normale', w: 'Échauffement', d: 'Dégressive', f: 'Jusqu’à l’échec' };
const SET_CODES = { w: 'É', d: 'D', f: 'X' };
const REST_CHOICES = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
const MEASURES = [
  ['weight', 'Poids du corps', 'w'], ['fat', 'Masse grasse', '%'], ['waist', 'Tour de taille', 'cm'],
  ['chest', 'Tour de poitrine', 'cm'], ['arm', 'Tour de bras', 'cm'], ['thigh', 'Tour de cuisse', 'cm'],
  ['hips', 'Tour de hanches', 'cm'],
];

/* ---------- Outils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const fmtN = n => nf.format(n || 0);
const num = v => {
  if (v === '' || v == null) return '';
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? '' : n;
};

/* ---------- Données ---------- */
const defaults = () => ({
  v: 1,
  settings: {
    name: '', unit: 'kg', dist: 'km', theme: 'dark', accent: 'orange', textSize: 100, weekStart: 'mon',
    rest: 90, autoRest: true, sound: 'bip', warn10: true, vibrate: true, wakelock: true,
    defSets: 3, prefill: false,
  },
  custom: [], routines: [], workouts: [], measures: [], active: null,
});
let db;
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* données illisibles : on repart à zéro */ }
  const def = defaults();
  db = { ...def, ...(d || {}) };
  db.settings = { ...def.settings, ...((d && d.settings) || {}) };
  // Ancienne version : le son était un simple oui/non
  if (db.settings.sound === true) db.settings.sound = 'bip';
  if (db.settings.sound === false) db.settings.sound = 'none';
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Impossible d’enregistrer : la mémoire du téléphone est pleine ?'); }
  schedulePrivatePush();
}

/* ---------- Unités et formats ---------- */
const U = () => db.settings.unit;
const toDisp = kg => (kg === '' || kg == null) ? '' : Math.round((U() === 'lb' ? kg * LB : kg) * 100) / 100;
const fromDisp = v => { const n = num(v); return n === '' ? '' : (U() === 'lb' ? n / LB : n); };
const fmtW = kg => fmtN(toDisp(kg || 0)) + ' ' + U();
// Distances : stockées en km, affichées en km ou en miles
const MI = 0.621371;
const UD = () => db.settings.dist === 'mi' ? 'mi' : 'km';
const toDispD = km => (km === '' || km == null) ? '' : Math.round((UD() === 'mi' ? km * MI : km) * 100) / 100;
const fromDispD = v => { const n = num(v); return n === '' ? '' : (UD() === 'mi' ? n / MI : n); };
const fmtD = km => fmtN(toDispD(km || 0)) + ' ' + UD();
const pad2 = n => String(n).padStart(2, '0');
function fmtClock(ms) {
  const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}
function fmtDur(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return m + ' min';
  return Math.floor(m / 60) + ' h ' + pad2(m % 60);
}
function fmtSec(s) {
  s = Math.round(+s || 0);
  if (s < 60) return s + ' s';
  return Math.floor(s / 60) + ' min' + (s % 60 ? ' ' + pad2(s % 60) : '');
}
const fmtRest = s => s ? fmtSec(s) : 'désactivé';
const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const dateFmtY = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
function fmtDate(t) {
  const d = new Date(t), now = new Date();
  const s = d.getFullYear() === now.getFullYear() ? dateFmt.format(d) : dateFmtY.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const isoDay = t => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
function weekStart(t) {
  const d = new Date(t); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dayShift(d));
  return d.getTime();
}
// Nombre de jours depuis le début de semaine (lundi ou dimanche selon le réglage)
const dayShift = d => db.settings.weekStart === 'sun' ? d.getDay() : (d.getDay() + 6) % 7;

/* ---------- Exercices ---------- */
let EXMAP = {};
function rebuildEx() {
  EXMAP = {};
  for (const e of EXERCISES) EXMAP[e.id] = e;
  for (const e of db.custom) EXMAP[e.id] = e;
}
const ex = id => EXMAP[id] || { id, name: 'Exercice supprimé', muscle: 'Corps entier', equip: 'Autre', type: 'wr' };
const allEx = () => [...EXERCISES, ...db.custom].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
const FIELDS = { wr: ['w', 'r'], bw: ['r'], time: ['s'], cardio: ['d', 'm'] };
const fieldLabel = f => ({ w: U().toUpperCase(), r: 'REPS', s: 'SEC', d: UD().toUpperCase(), m: 'MIN' }[f]);
// Valeur affichée dans une case de saisie / valeur enregistrée depuis la case
const inDisp = (f, v) => f === 'w' ? toDisp(v) : f === 'd' ? toDispD(v) : (v ?? '');
const inStore = (f, v) => f === 'w' ? fromDisp(v) : f === 'd' ? fromDispD(v) : num(v);
function setValid(s, type) {
  if (type === 'wr' || type === 'bw') return +s.r > 0;
  if (type === 'time') return +s.s > 0;
  return +s.d > 0 || +s.m > 0;
}
function fmtSet(s, type) {
  if (type === 'wr') return `${fmtW(s.w)} × ${fmtN(s.r)}`;
  if (type === 'bw') return `${fmtN(s.r)} reps`;
  if (type === 'time') return fmtSec(s.s);
  return [s.d ? fmtD(s.d) : '', s.m ? fmtN(s.m) + ' min' : ''].filter(Boolean).join(' · ');
}
const e1rm = (w, r) => r > 0 && w > 0 ? (r === 1 ? w : w * (1 + r / 30)) : 0;

function statsOf(sets) {
  const s = { maxW: 0, best1: 0, vol: 0, bestSetVol: 0, maxR: 0, maxS: 0, maxD: 0, totM: 0, n: 0 };
  for (const x of sets) {
    if (x.t === 'w') continue;
    const w = +x.w || 0, r = +x.r || 0;
    s.n++;
    s.maxW = Math.max(s.maxW, w);
    s.best1 = Math.max(s.best1, e1rm(w, r));
    s.vol += w * r;
    s.bestSetVol = Math.max(s.bestSetVol, w * r);
    s.maxR = Math.max(s.maxR, r);
    s.maxS = Math.max(s.maxS, +x.s || 0);
    s.maxD = Math.max(s.maxD, +x.d || 0);
    s.totM += +x.m || 0;
  }
  return s;
}
const PR_KEYS = {
  wr: [['maxW', 'Poids max', fmtW], ['best1', '1RM estimé', fmtW], ['bestSetVol', 'Meilleure série (volume)', fmtW]],
  bw: [['maxR', 'Répétitions max', v => fmtN(v) + ' reps']],
  time: [['maxS', 'Durée max', fmtSec]],
  cardio: [['maxD', 'Distance max', v => fmtD(v)]],
};

const sortedWorkouts = () => [...db.workouts].sort((a, b) => b.start - a.start);
function sessionsOf(exId) {
  return db.workouts.filter(w => w.exercises.some(e => e.ex === exId))
    .sort((a, b) => a.start - b.start)
    .map(w => ({ w, sets: w.exercises.filter(e => e.ex === exId).flatMap(e => e.sets) }));
}
function lastSets(exId, before = Infinity, excludeId = null) {
  let best = null;
  for (const w of db.workouts) {
    if (w.id === excludeId || w.start >= before) continue;
    const e = w.exercises.find(x => x.ex === exId);
    if (e && (!best || w.start > best.start)) best = { start: w.start, sets: e.sets };
  }
  return best ? best.sets : [];
}
// Une séance d'ami contient le nom/muscle/type de chaque exercice (n, m, t)
const exName = e => e.n || ex(e.ex).name;
const exMuscle = e => e.m || ex(e.ex).muscle;
const exType = e => e.t || ex(e.ex).type;
function workoutTotals(w) {
  let vol = 0, sets = 0;
  for (const e of w.exercises) {
    for (const s of e.sets) {
      if (w === db.active && !s.done) continue;
      sets++;
      if (exType(e) === 'wr') vol += (+s.w || 0) * (+s.r || 0);
    }
  }
  return { vol, sets };
}
function computePRs(w) {
  const prs = [];
  const ids = [...new Set(w.exercises.map(e => e.ex))];
  for (const id of ids) {
    const type = ex(id).type;
    const before = db.workouts.filter(o => o.id !== w.id && o.start < w.start)
      .flatMap(o => o.exercises.filter(e => e.ex === id).flatMap(e => e.sets));
    if (!before.length) continue;
    const old = statsOf(before), now = statsOf(w.exercises.filter(e => e.ex === id).flatMap(e => e.sets));
    for (const [k, label] of PR_KEYS[type]) {
      if (now[k] > old[k] + 1e-9) prs.push({ ex: id, k, label, v: now[k] });
    }
  }
  return prs;
}

/* ---------- Thème ---------- */
function applyTheme() {
  const t = db.settings.theme;
  const dark = t === 'auto' ? matchMedia('(prefers-color-scheme: dark)').matches : t === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.setProperty('--accent', ACCENTS[db.settings.accent] || ACCENTS.orange);
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#0E0F12' : '#F4F5F7';
  // Taille de l'affichage (plus gros = plus lisible à la salle)
  document.body.style.zoom = (+db.settings.textSize || 100) / 100;
}

/* ---------- Fenêtres (feuilles du bas) ---------- */
let modalFns = [];
function openSheet(html, cls = '') {
  $('#modal').innerHTML = `<div class="backdrop" data-a="close-modal"></div><div class="sheet ${cls}">${html}</div>`;
  $('#modal').classList.add('open');
}
function closeModal() {
  $('#modal').classList.remove('open');
  $('#modal').innerHTML = '';
  picker = null;
}
function menu(title, items) {
  modalFns = items.map(i => i.fn);
  openSheet(`${title ? `<div class="menu-title">${esc(title)}</div>` : ''}
    <div class="menu">${items.map((it, i) => `<button class="menu-item ${it.danger ? 'danger' : ''} ${it.on ? 'on' : ''}" data-a="menu-pick" data-i="${i}">${it.label}</button>`).join('')}</div>
    <button class="btn ghost block" data-a="close-modal">Annuler</button>`);
}
function confirmBox(msg, okLabel, fn, danger = true) {
  modalFns = [fn];
  openSheet(`<p class="confirm-msg">${msg}</p>
    <button class="btn ${danger ? 'danger' : 'primary'} block" data-a="menu-pick" data-i="0">${okLabel}</button>
    <button class="btn ghost block" data-a="close-modal">Annuler</button>`);
}
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- Graphiques ---------- */
let chartN = 0;
function lineChart(pts, fmt = fmtN) {
  if (pts.length < 2) return `<div class="empty small">Il faut au moins 2 séances pour afficher un graphique.</div>`;
  const W = 340, H = 170, pl = 10, pr = 10, pt = 22, pb = 24, id = 'g' + (++chartN);
  const xs = pts.map(p => p.t), ys = pts.map(p => p.v);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x1 === x0) x1 = x0 + 1;
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const padY = (y1 - y0) * 0.15 || Math.max(1, y1 * 0.1);
  y0 = Math.max(0, y0 - padY); y1 += padY;
  const X = t => pl + (t - x0) / (x1 - x0) * (W - pl - pr);
  const Y = v => pt + (1 - (v - y0) / (y1 - y0)) * (H - pt - pb);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ');
  const area = `${line} L${X(pts[pts.length - 1].t).toFixed(1)} ${H - pb} L${X(pts[0].t).toFixed(1)} ${H - pb} Z`;
  const grid = [0, 1, 2].map(i => { const y = pt + i * (H - pt - pb) / 2; return `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" class="grid"/>`; }).join('');
  const maxP = pts.reduce((a, b) => b.v > a.v ? b : a);
  const last = pts[pts.length - 1];
  const dots = pts.length <= 40 ? pts.map(p => `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3" class="dot"/>`).join('') : '';
  const lx = Math.min(Math.max(X(maxP.t), 40), W - 40);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.35"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#${id})"/><path d="${line}" class="line"/>${dots}
    <circle cx="${X(last.t).toFixed(1)}" cy="${Y(last.v).toFixed(1)}" r="5" class="dot big"/>
    <text x="${lx}" y="${Math.max(12, Y(maxP.v) - 9)}" text-anchor="middle" class="lbl strong">${esc(fmt(maxP.v))}</text>
    <text x="${pl}" y="${H - 6}" class="lbl">${esc(fmtDate(pts[0].t))}</text>
    <text x="${W - pr}" y="${H - 6}" text-anchor="end" class="lbl">${esc(fmtDate(last.t))}</text>
  </svg>`;
}
function barChart(items, fmt = fmtN) {
  const W = 340, H = 160, pb = 22, pt = 20, n = items.length, gap = 6;
  const bw = (W - gap * (n - 1)) / n;
  const max = Math.max(...items.map(i => i.v), 1);
  const bars = items.map((it, i) => {
    const h = (H - pb - pt) * it.v / max, x = i * (bw + gap), y = H - pb - h;
    const isLast = i === n - 1;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, it.v ? 2 : 0).toFixed(1)}" rx="4" class="bar ${isLast ? 'on' : ''}"/>
      ${it.v && (isLast || it.v === max) ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" class="lbl strong">${esc(fmt(it.v))}</text>` : ''}
      <text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="lbl">${esc(it.label)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img"><line x1="0" x2="${W}" y1="${H - pb}" y2="${H - pb}" class="grid"/>${bars}</svg>`;
}
function weekBuckets(n) {
  const cur = weekStart(Date.now()), out = [];
  for (let i = n - 1; i >= 0; i--) {
    const s = cur - i * 7 * DAY, e = s + 7 * DAY;
    const ws = db.workouts.filter(w => w.start >= s && w.start < e);
    const d = new Date(s);
    out.push({
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      n: ws.length,
      dur: ws.reduce((a, w) => a + (w.end - w.start), 0),
      vol: ws.reduce((a, w) => a + workoutTotals(w).vol, 0),
    });
  }
  return out;
}

/* ---------- Petits morceaux d'interface ---------- */
function chips(list, cur, action, extra = '') {
  return `<div class="chips">${list.map(([v, l]) => `<button class="chip ${v === cur ? 'on' : ''}" data-a="${action}" data-v="${esc(v)}" ${extra}>${esc(l)}</button>`).join('')}</div>`;
}
function stat(label, value) { return `<div class="stat"><div class="stat-v">${value}</div><div class="stat-l">${label}</div></div>`; }
// Photo de l'exercice si on en a une, sinon ses initiales sur la couleur du muscle
const hasPhoto = id => typeof EX_IMG !== 'undefined' && EX_IMG.has(id);
function exIcon(e) {
  if (hasPhoto(e.id)) return `<img class="ex-icon ex-photo" src="img/ex/${e.id}-t.jpg" alt="" loading="lazy">`;
  const letters = e.name.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return `<div class="ex-icon m-${norm(e.muscle).replace(/[^a-z]/g, '')}">${esc(letters)}</div>`;
}
// Consignes : étapes numérotées, puis le conseil ou l'erreur à éviter dans un encadré
function exTips(id) {
  const t = typeof EX_TIPS !== 'undefined' && EX_TIPS[id];
  if (!t) return '';
  const steps = t.filter(x => !/^(⚠️|💡)/.test(x)), notes = t.filter(x => /^(⚠️|💡)/.test(x));
  return `<div class="card tips"><div class="card-title">Comment faire</div>
    <ol>${steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    ${notes.map(x => `<div class="tip-note ${x.startsWith('⚠️') ? 'warn' : ''}">${esc(x)}</div>`).join('')}</div>`;
}
// Démonstration animée : position de départ et d'arrivée qui s'alternent
function exDemo(id) {
  if (!hasPhoto(id)) return '';
  return `<div class="ex-demo" data-a="demo-toggle" title="Appuie pour mettre en pause">
    <img src="img/ex/${id}-0.jpg" alt="Position de départ"><img class="b" src="img/ex/${id}-1.jpg" alt="Position d’arrivée">
    <span class="demo-tag">Départ ⇄ arrivée</span></div>`;
}
// author : nom de l'ami qui a fait la séance (fil d'actualité)
function workoutCard(w, author = null, authorImg = null) {
  const t = workoutTotals(w);
  const href = w.owner ? `#/fworkout/${w.owner}/${w.id}` : `#/workout/${w.id}`;
  const lines = w.exercises.slice(0, 4).map(e => `<li><span class="muted">${e.sets.length} ×</span> ${esc(exName(e))}</li>`).join('');
  const more = w.exercises.length > 4 ? `<li class="muted">et ${w.exercises.length - 4} autre${w.exercises.length > 5 ? 's' : ''}…</li>` : '';
  const reacts = reactionSummary(w);
  return `<a class="card wcard" href="${href}">
    ${author ? `<div class="author">${avatarHtml(author, authorImg, 'sm')}<b>${esc(author)}</b></div>` : ''}
    <div class="wcard-top"><div><div class="wcard-name">${esc(w.name)}</div><div class="muted small">${fmtDate(w.start)} · ${timeFmt.format(new Date(w.start))}</div></div>
    ${w.prs && w.prs.length ? `<span class="badge">🏆 ${w.prs.length}</span>` : ''}</div>
    <div class="mini-stats"><span>⏱ ${fmtDur(w.end - w.start)}</span>${t.vol ? `<span>🏋️ ${fmtW(t.vol)}</span>` : ''}<span>✔ ${t.sets} série${t.sets > 1 ? 's' : ''}</span></div>
    <ul class="wcard-ex">${lines}${more}</ul>
    ${reacts ? `<div class="react-sum">${reacts}</div>` : ''}</a>`;
}
const REACTIONS = ['💪', '🔥', '👏', '😮'];
function reactionSummary(w) {
  const r = Object.values(w.reactions || {});
  if (!r.length) return '';
  const counts = {};
  for (const x of r) counts[x.e] = (counts[x.e] || 0) + 1;
  return Object.entries(counts).map(([e, n]) => `${e} ${n}`).join('  ');
}
function workoutBlocks(w, own) {
  const prKey = new Set((w.prs || []).map(p => p.ex));
  return w.exercises.map(e => {
    const e0 = { id: e.ex, name: exName(e), muscle: exMuscle(e), type: exType(e) };
    let n = 0;
    const rows = e.sets.map(s => {
      const code = s.t && s.t !== 'n' ? SET_CODES[s.t] : String(++n);
      return `<div class="set-line"><span class="set-n t-${s.t || 'n'}">${code}</span><span>${fmtSet(s, e0.type)}</span>
        ${e0.type === 'wr' && s.t !== 'w' ? `<span class="muted small">1RM ${fmtW(e1rm(+s.w, +s.r))}</span>` : ''}</div>`;
    }).join('');
    const prs = (w.prs || []).filter(p => p.ex === e.ex);
    const head = `${exIcon(e0)}<div><div class="ex-name">${esc(e0.name)} ${prKey.has(e.ex) ? '🏆' : ''}</div><div class="muted small">${esc(e0.muscle)}</div></div>`;
    return `<div class="card">
      ${own ? `<a class="ex-row" href="#/exercise/${e.ex}">${head}</a>` : `<div class="ex-row">${head}</div>`}
      ${e.note ? `<p class="note">${esc(e.note)}</p>` : ''}
      ${rows}
      ${prs.length ? `<div class="pr-list">${prs.map(p => `<span class="badge">🏆 ${esc(p.label)} : ${esc(PR_KEYS[e0.type].find(k => k[0] === p.k)[2](p.v))}</span>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
}
function workoutHead(w) {
  const t = workoutTotals(w);
  return `<div class="wd-head"><h2>${esc(w.name)}</h2><div class="muted">${fmtDate(w.start)} · ${timeFmt.format(new Date(w.start))}</div>
      ${w.note ? `<p class="note">${esc(w.note)}</p>` : ''}</div>
      <div class="card"><div class="stats3">${stat('Durée', fmtDur(w.end - w.start))}${stat('Volume', fmtW(t.vol))}${stat('Records', (w.prs || []).length)}</div></div>`;
}

/* ---------- Vues ---------- */
let route = [], lastHash = '', draft = null, picker = null;
const ui = { histLimit: 20, profChart: 'n', exChart: 'best1', calMonth: null, exQ: '', exM: '', measure: 'weight' };

function vHome() {
  const ws = sortedWorkouts();
  const weeks = weekBuckets(8);
  const tw = weeks[weeks.length - 1];
  const name = db.settings.name ? esc(db.settings.name) : 'champion';
  const list = ws.slice(0, ui.histLimit).map(w => workoutCard(w)).join('');
  return {
    title: '<span class="logo">Boby<b>Musc</b></span>',
    actions: `<a class="icon" href="#/settings" aria-label="Réglages">⚙️</a>`,
    html: `<p class="hello">Salut ${name} 👋</p>
    ${db.active ? '' : `<button class="btn primary block big" data-a="start-empty">＋ Démarrer une séance</button>`}
    ${homeMotivation()}
    <div class="card">
      <div class="card-title">Cette semaine</div>
      <div class="stats3">${stat('Séances', tw.n)}${stat('Durée', fmtDur(tw.dur))}${stat('Volume', fmtW(tw.vol))}</div>
      ${barChart(weeks.map(w => ({ label: w.label, v: w.n })), v => v)}
    </div>
    <h2 class="section">Historique</h2>
    ${ws.length ? list : `<div class="empty">Aucune séance pour l’instant.<br>Appuie sur « Démarrer une séance » ou choisis un programme dans l’onglet Entraînement.</div>`}
    ${ws.length > ui.histLimit ? `<button class="btn ghost block" data-a="more-hist">Voir plus</button>` : ''}`,
  };
}

function vWorkout(id) {
  const w = db.workouts.find(x => x.id === id);
  if (!w) return vNotFound();
  // Réactions des amis (si connecté) : chargées en ligne
  let reacts = '';
  if (C()?.state.user) {
    const cw = fetchOnce(`fw/${C().state.user.uid}/${id}`, () => C().friendWorkout(C().state.user.uid, id));
    const list = Object.values((cw && cw.reactions) || {});
    if (list.length) reacts = `<div class="card"><div class="card-title">Réactions de tes amis</div>${list.map(r => `<div class="react-line"><span class="react-e">${r.e}</span>${esc(r.n)}</div>`).join('')}</div>`;
  }
  return {
    title: 'Séance', back: '#/home',
    actions: `<button class="icon" data-a="workout-menu" data-id="${w.id}" aria-label="Options">⋯</button>`,
    html: `${workoutHead(w)}${reacts}
      ${workoutBlocks(w, true)}
      <button class="btn primary block" data-a="redo" data-id="${w.id}">↻ Refaire cette séance</button>`,
  };
}

/* ---------- Amis (en ligne) ---------- */
const C = () => window.Cloud || null;
let cloudFailed = false;
// Petit cache des données en ligne : la vue s'affiche tout de suite puis se met à jour
const net = {};
function fetchOnce(key, fn, maxAge = 60000) {
  const c = net[key];
  if (c && (c.loading || Date.now() - c.at < maxAge)) return c.data;
  net[key] = { loading: true, at: 0, data: c ? c.data : undefined };
  fn().then(d => { net[key] = { loading: false, at: Date.now(), data: d }; refreshIfVisible(); })
    .catch(e => { net[key] = { loading: false, at: Date.now(), data: c ? c.data : null, err: e }; refreshIfVisible(); });
  return net[key].data;
}
const isLoading = key => net[key] && net[key].loading && net[key].data === undefined;
function refreshIfVisible() {
  // Dans une discussion, on ne redessine que les messages (le texte en cours d'écriture reste en place)
  if (route[0] === 'group' && $('#msgs') && C().state.groups.some(g => g.id === route[1])) { drawMessages(); return; }
  if (!['friends', 'friend', 'fworkout', 'workout', 'settings', 'group', 'groupinfo'].includes(route[0])) return;
  const a = document.activeElement;
  if (a && a.closest && a.closest('#view') && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}
const loader = `<div class="empty small"><span class="spinner"></span> Chargement…</div>`;

function vFriends() {
  const cl = C();
  if (!cl || !cl.state.ready) {
    return { title: 'Amis', html: cloudFailed ? `<div class="empty">Impossible de charger la partie en ligne.<br>Vérifie ta connexion internet puis rouvre l’appli.</div>` : loader };
  }
  const st = cl.state;
  if (!st.user) {
    return {
      title: 'Amis',
      html: `<div class="friends-hero"><div class="big-emoji">🤝</div><h2>Entraîne-toi avec tes amis</h2>
        <p class="muted">Crée un compte gratuit pour voir les séances et les records de tes amis, leur envoyer des 💪 et sauvegarder tes séances en ligne.</p></div>
        <button class="btn primary block big" data-a="acc-signup">Créer un compte</button>
        <button class="btn ghost block" data-a="acc-login">J’ai déjà un compte</button>
        <p class="muted small center">Tes séances restent privées : seuls les amis que tu acceptes peuvent les voir.</p>`,
    };
  }
  const p = st.profile || {};
  const feed = st.friends.length ? fetchOnce('feed', () => cl.feed(10), 30000) : [];
  const profs = friendProfiles();
  const reqs = st.requests.map(r => `<div class="card req"><div class="avatar sm">${esc((r.name || '?')[0].toUpperCase())}</div>
      <div class="grow"><b>${esc(r.name)}</b><div class="muted small">veut devenir ton ami</div></div>
      <button class="btn primary small" data-a="req-ok" data-uid="${r.uid}">Accepter</button>
      <button class="icon" data-a="req-no" data-uid="${r.uid}" aria-label="Refuser">✕</button></div>`).join('');
  const tab = ui.friendsTab || 'feed';
  let body;
  if (tab === 'feed') {
    if (!st.friends.length) body = `<div class="empty">Ajoute ta conjointe ou tes amis avec leur code ami pour voir leurs séances ici.</div>`;
    else if (feed === undefined) body = loader;
    else if (!feed || !feed.length) body = `<div class="empty">Tes amis n’ont pas encore enregistré de séance.</div>`;
    else body = feed.slice(0, 40).map(w => workoutCard(w, (st.friends.find(f => f.uid === w.owner) || {}).name || 'Ami', (profs[w.owner] || {}).avatar)).join('');
  } else if (tab === 'groups') {
    body = groupsList();
  } else {
    body = st.friends.length ? `<div class="menu-links">${st.friends.map(f => {
        const pr = profs[f.uid] || {};
        return `<a class="list-item" href="#/friend/${f.uid}">${avatarHtml(f.name, pr.avatar, 'sm')}
          <span class="grow"><b>${esc(pr.name || f.name)}</b>${pr.bio ? `<span class="muted small ellipsis block">${esc(pr.bio)}</span>` : ''}</span><span class="muted">›</span></a>`;
      }).join('')}</div>`
      : `<div class="empty">Aucun ami pour l’instant.</div>`;
  }
  return {
    title: 'Amis',
    actions: `<button class="icon" data-a="feed-refresh" aria-label="Actualiser">↻</button>`,
    html: `<div class="card code-card">
        <div class="muted small">Ton code ami</div>
        <div class="row-between"><div class="friend-code">${esc(p.code || '…')}</div>
        <button class="btn primary small" data-a="share-code">Partager</button></div>
        <div class="add-friend"><input id="friend-code" placeholder="Code d’un ami (ex. BOBY-4F2K)" autocomplete="off" autocapitalize="characters">
        <button class="btn ghost" data-a="add-friend">Ajouter</button></div>
      </div>
      ${reqs ? `<h2 class="section">Demandes reçues</h2>${reqs}` : ''}
      ${chips([['feed', 'Fil d’actualité'], ['groups', `Groupes${unreadCount() ? ' 🔴' : ''}`], ['list', `Mes amis (${st.friends.length})`]], tab, 'friends-tab')}
      ${body}`,
  };
}

// Profils (photo, bio, pseudo à jour) de tous mes amis, gardés 2 minutes
function friendProfiles() {
  const cl = C();
  const key = 'fprofiles:' + cl.state.friends.map(f => f.uid).join(',');
  const data = fetchOnce(key, async () => {
    const out = {};
    await Promise.all(cl.state.friends.map(async f => { try { out[f.uid] = await cl.friendProfile(f.uid); } catch (e) { /* ignore */ } }));
    return out;
  }, 120000);
  // Un profil n'a pas pu être lu : on réessaiera au prochain affichage plutôt que d'attendre 2 minutes
  if (data && cl.state.friends.some(f => !data[f.uid]) && Date.now() - net[key].at > 5000) delete net[key];
  return data || {};
}

function vFriend(fid) {
  const cl = C();
  if (!cl || !cl.state.user) { location.hash = '#/friends'; return { title: '', html: '' }; }
  const f = cl.state.friends.find(x => x.uid === fid);
  if (!f) return { title: 'Ami', back: '#/friends', html: `<div class="empty">Cette personne ne fait plus partie de tes amis.</div>` };
  const ws = fetchOnce('fws/' + fid, () => cl.friendWorkouts(fid, 100));
  let html;
  if (ws === undefined) html = loader;
  else if (!ws) {
    const err = net['fws/' + fid] && net['fws/' + fid].err;
    html = err && err.code === 'permission-denied'
      ? `<div class="empty">🔒 ${esc(f.name)} a choisi de garder ses séances privées.</div>`
      : `<div class="empty">Impossible de charger ses séances. Vérifie ta connexion internet.</div>`;
  }
  else {
    const totVol = ws.reduce((a, w) => a + workoutTotals(w).vol, 0);
    const totDur = ws.reduce((a, w) => a + (w.end - w.start), 0);
    const cur = weekStart(Date.now()), weeks = [];
    for (let i = 11; i >= 0; i--) {
      const s = cur - i * 7 * DAY, d = new Date(s);
      weeks.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, v: ws.filter(w => w.start >= s && w.start < s + 7 * DAY).length });
    }
    const prs = ws.reduce((a, w) => a + (w.prs || []).length, 0);
    const st = streakInfo(ws);
    html = `<div class="card"><div class="stats3">${stat('Séances', ws.length)}${stat('Série 🔥', streakLabel(st.cur))}${stat('Records 🏆', prs)}</div>
        <div class="muted small">Temps total : ${fmtDur(totDur)} · volume total : ${fmtW(totVol)}${ws.length >= 100 ? ' (100 dernières séances)' : ''}</div></div>
      <div class="card"><div class="card-title">Séances par semaine</div>${barChart(weeks, v => v)}</div>
      ${muscleCard(ws, 'Muscles travaillés')}
      <h2 class="section">Ses séances</h2>
      ${ws.length ? ws.slice(0, 30).map(w => workoutCard(w)).join('') : `<div class="empty">Pas encore de séance.</div>`}`;
  }
  return {
    title: esc(f.name), back: '#/friends',
    actions: `<button class="icon" data-a="friend-menu" data-uid="${fid}" aria-label="Options">⋯</button>`,
    html: `<div class="profile-head">${avatarHtml(f.name, (friendProfiles()[fid] || {}).avatar)}
      <div><h2>${esc((friendProfiles()[fid] || {}).name || f.name)}</h2><div class="muted">Ami depuis ${f.since ? fmtDate(f.since) : '…'}</div></div></div>
      ${(friendProfiles()[fid] || {}).bio ? `<p class="bio">${esc(friendProfiles()[fid].bio)}</p>` : ''}${html}`,
  };
}

function vFriendWorkout(fid, wid) {
  const cl = C();
  if (!cl || !cl.state.user) { location.hash = '#/friends'; return { title: '', html: '' }; }
  const key = `fw/${fid}/${wid}`;
  const w = fetchOnce(key, () => cl.friendWorkout(fid, wid), 15000);
  const f = cl.state.friends.find(x => x.uid === fid) || { name: 'Ami' };
  if (w === undefined) return { title: 'Séance', back: '#/friend/' + fid, html: loader };
  if (!w) return { title: 'Séance', back: '#/friend/' + fid, html: `<div class="empty">Séance introuvable.</div>` };
  const mine = (w.reactions || {})[cl.state.user.uid];
  const list = Object.values(w.reactions || {});
  return {
    title: esc(f.name), back: '#/friend/' + fid,
    html: `${workoutHead(w)}
      <div class="card"><div class="card-title">Réagir</div>
        <div class="react-bar">${REACTIONS.map(e => `<button class="react-btn ${mine && mine.e === e ? 'on' : ''}" data-a="react" data-owner="${fid}" data-wid="${wid}" data-e="${e}">${e}</button>`).join('')}</div>
        ${list.length ? `<div class="react-who">${list.map(r => `<span>${r.e} ${esc(r.n)}</span>`).join('')}</div>` : ''}
      </div>
      ${workoutBlocks(w, false)}`,
  };
}

/* ---------- Groupes ---------- */
const GROUP_EMOJIS = ['💪', '🏋️', '🔥', '🦍', '⚡', '🏃', '❤️', '👯', '🥇', '🍗'];
const unread = g => g.lastBy && g.lastBy !== C().state.user.uid && (g.lastAt || 0) > ((db.groupRead || {})[g.id] || 0);
const unreadCount = () => C() && C().state.user ? C().state.groups.filter(unread).length : 0;
function markRead(gid) {
  db.groupRead = db.groupRead || {};
  db.groupRead[gid] = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
}
function fmtWhen(t) {
  const d = new Date(t), now = new Date();
  if (isoDay(t) === isoDay(now.getTime())) return timeFmt.format(d);
  if (now - d < 6 * DAY) return new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
}
function groupsList() {
  const gs = C().state.groups;
  const create = `<button class="btn primary block" data-a="group-new">＋ Créer un groupe</button>`;
  if (!gs.length) return `${create}<div class="empty">Crée un groupe avec ta conjointe ou tes potes de salle pour discuter, envoyer des photos et partager vos séances.</div>`;
  return create + `<div class="menu-links">${gs.map(g => `<a class="list-item group-item" href="#/group/${g.id}">
      <div class="g-emoji">${esc(g.emoji || '💪')}</div>
      <div class="grow"><div class="row-between"><b>${esc(g.name)}</b><span class="muted small">${g.lastAt ? fmtWhen(g.lastAt) : ''}</span></div>
      <div class="muted small ellipsis">${g.lastName && g.lastBy !== C().state.user.uid ? esc(g.lastName) + ' : ' : ''}${esc(g.lastText || '')}</div></div>
      ${unread(g) ? '<span class="dot"></span>' : ''}</a>`).join('')}</div>`;
}
function groupForm(g = null) {
  const cl = C();
  const sel = new Set();
  ui.groupEmoji = g ? g.emoji : '💪';
  const friends = cl.state.friends.filter(f => !g || !g.members.includes(f.uid));
  openSheet(`<h2>${g ? 'Modifier le groupe' : 'Nouveau groupe'}</h2>
    <label class="field">Nom du groupe<input id="g-name" value="${esc(g ? g.name : '')}" placeholder="Ex. Les gros bras" maxlength="30"></label>
    <div class="field">Emoji<div class="emoji-pick">${GROUP_EMOJIS.map(e => `<button class="${e === ui.groupEmoji ? 'on' : ''}" data-a="g-emoji" data-v="${e}">${e}</button>`).join('')}</div></div>
    ${g ? '' : `<div class="field">Ajouter des amis${friends.length ? '' : ' <span class="muted">(ajoute d’abord des amis avec leur code)</span>'}
      <div class="menu-links pick-friends">${friends.map(f => `<button class="list-item" data-a="g-friend" data-uid="${f.uid}"><div class="avatar sm">${esc((f.name || '?')[0].toUpperCase())}</div><span class="grow">${esc(f.name)}</span><span class="pk-check"></span></button>`).join('')}</div></div>`}
    <button class="btn primary block" data-a="g-save" data-id="${g ? g.id : ''}">${g ? 'Enregistrer' : 'Créer le groupe'}</button>
    <button class="btn ghost block" data-a="close-modal">Annuler</button>`);
  ui.groupSel = sel;
}

// Discussion ouverte : on écoute les messages en direct tant qu'elle est affichée
const chat = { gid: null, unsub: null, msgs: undefined, err: null };
function watchChat(gid) {
  if (chat.gid === gid) return;
  stopChat();
  chat.gid = gid; chat.msgs = undefined; chat.err = null;
  chat.unsub = C().watchMessages(gid, (msgs, err) => {
    if (err) { chat.err = err; chat.msgs = null; } else chat.msgs = msgs;
    markRead(gid);
    drawMessages();
  });
}
function stopChat() {
  if (chat.unsub) chat.unsub();
  chat.gid = null; chat.unsub = null; chat.msgs = undefined;
}
function msgHtml(m, prev, me, g) {
  const mine = m.uid === me;
  const day = !prev || isoDay(prev.at) !== isoDay(m.at) ? `<div class="day-sep">${fmtDate(m.at)}</div>` : '';
  const showName = !mine && (!prev || prev.uid !== m.uid || day);
  let body = '';
  if (m.img) body += `<img class="msg-img" src="${m.img}" alt="Photo" data-a="photo-view" data-mid="${m.id}" loading="lazy">`;
  if (m.workout) {
    const w = m.workout;
    body += `<div class="msg-workout"><div class="mw-title">🏋️ ${esc(w.name)}</div>
      <div class="mini-stats"><span>⏱ ${fmtDur(w.dur)}</span>${w.vol ? `<span>${fmtW(w.vol)}</span>` : ''}<span>✔ ${w.sets} séries</span>${w.prs ? `<span>🏆 ${w.prs}</span>` : ''}</div>
      <ul class="wcard-ex">${w.ex.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  }
  if (m.text) body += `<div class="msg-text">${esc(m.text).replace(/\n/g, '<br>')}</div>`;
  return `${day}<div class="msg ${mine ? 'mine' : ''}" data-mid="${m.id}">
    ${showName ? `<div class="msg-name">${esc(m.name || (g.memberNames || {})[m.uid] || 'Ami')}</div>` : ''}
    <div class="bubble" ${mine || g.owner === me ? `data-a="msg-menu" data-mid="${m.id}"` : ''}>${body}<span class="msg-time">${timeFmt.format(new Date(m.at))}</span></div></div>`;
}
function drawMessages() {
  const box = $('#msgs');
  if (!box || route[0] !== 'group' || route[1] !== chat.gid) return;
  const g = C().state.groups.find(x => x.id === chat.gid);
  if (!g) return;
  const me = C().state.user.uid;
  if (chat.msgs === undefined) { box.innerHTML = loader; return; }
  if (!chat.msgs) { box.innerHTML = `<div class="empty small">Impossible de charger les messages.</div>`; return; }
  const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 160;
  box.innerHTML = chat.msgs.length
    ? chat.msgs.map((m, i) => msgHtml(m, chat.msgs[i - 1], me, g)).join('')
    : `<div class="empty small">Aucun message pour l’instant. Dis bonjour 👋 ou envoie une photo de ta séance !</div>`;
  if (nearBottom || !box.dataset.drawn) { box.dataset.drawn = '1'; requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight)); }
}
function vGroup(gid) {
  const cl = C();
  if (!cl || !cl.state.ready) return { title: 'Groupe', back: '#/friends', html: loader };
  if (!cl.state.user) { location.hash = '#/friends'; return { title: '', html: '' }; }
  const g = cl.state.groups.find(x => x.id === gid);
  if (!g) return { title: 'Groupe', back: '#/friends', html: cl.state.ready ? `<div class="empty">Ce groupe n’existe plus ou tu n’en fais plus partie.</div>` : loader };
  return {
    title: `<a class="group-title" href="#/groupinfo/${gid}">${esc(g.emoji || '💪')} ${esc(g.name)}<small>${g.members.length} membre${g.members.length > 1 ? 's' : ''}</small></a>`,
    back: '#/friends',
    actions: `<a class="icon" href="#/groupinfo/${gid}" aria-label="Infos du groupe">ⓘ</a>`,
    html: `<div id="msgs" class="msgs"></div>
      <div class="composer">
        <button class="icon" data-a="send-photo" aria-label="Envoyer une photo">📷</button>
        <button class="icon" data-a="share-workout" aria-label="Partager une séance">🏋️</button>
        <textarea id="msg-in" rows="1" placeholder="Message…" maxlength="1000">${esc(ui.chatDraft || '')}</textarea>
        <button class="send-btn" data-a="send-msg" aria-label="Envoyer">➤</button>
        <input type="file" id="photo-in" accept="image/*" hidden>
        <input type="file" id="photo-cam" accept="image/*" capture="environment" hidden>
      </div>`,
  };
}
function vGroupInfo(gid) {
  const cl = C();
  if (!cl || !cl.state.ready) return { title: 'Groupe', back: '#/friends', html: loader };
  if (!cl.state.user) { location.hash = '#/friends'; return { title: '', html: '' }; }
  const g = cl.state.groups.find(x => x.id === gid);
  if (!g) return { title: 'Groupe', back: '#/friends', html: `<div class="empty">Ce groupe n’existe plus.</div>` };
  const me = cl.state.user.uid;
  const names = g.memberNames || {};
  const photos = chat.gid === gid && chat.msgs ? chat.msgs.filter(m => m.img).reverse() : null;
  return {
    title: 'Infos du groupe', back: '#/group/' + gid,
    html: `<div class="group-hero"><div class="g-emoji big">${esc(g.emoji || '💪')}</div><h2>${esc(g.name)}</h2>
        <div class="muted">${g.members.length} membre${g.members.length > 1 ? 's' : ''} · créé le ${fmtDate(g.createdAt)}</div></div>
      <button class="btn ghost block" data-a="group-edit" data-id="${gid}">✏️ Modifier le nom ou l’emoji</button>
      <h2 class="section">Membres</h2>
      <div class="menu-links">${g.members.map(u => `<div class="list-item"><div class="avatar sm">${esc((names[u] || '?')[0].toUpperCase())}</div>
        <span class="grow"><b>${esc(names[u] || 'Membre')}</b>${u === me ? ' <span class="muted">(toi)</span>' : ''}</span>${u === g.owner ? '<span class="tag">créateur</span>' : ''}</div>`).join('')}</div>
      <button class="btn ghost block" data-a="group-add" data-id="${gid}">＋ Ajouter des amis</button>
      <h2 class="section">Photos</h2>
      ${photos === null ? `<div class="empty small">Ouvre la discussion pour voir les photos.</div>`
        : photos.length ? `<div class="photo-grid">${photos.map(m => `<img src="${m.img}" alt="Photo" data-a="photo-view" data-mid="${m.id}" loading="lazy">`).join('')}</div>`
        : `<div class="empty small">Aucune photo pour l’instant.</div>`}
      <h2 class="section"></h2>
      <button class="btn danger-ghost block" data-a="group-leave" data-id="${gid}">Quitter le groupe</button>
      ${g.owner === me ? `<button class="btn danger-ghost block" data-a="group-delete" data-id="${gid}">Supprimer le groupe pour tout le monde</button>` : ''}`,
  };
}

// Photo : réduite à 1000 px et compressée en JPEG pour rester légère (≈ 100 Ko)
async function compressImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    for (const [max, q] of [[1000, 0.72], [800, 0.6], [640, 0.5]]) {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/jpeg', q);
      if (data.length < 300000) return data;
    }
    throw new Error('Photo trop lourde');
  } finally { URL.revokeObjectURL(url); }
}
function workoutSummary(w) {
  const t = workoutTotals(w);
  return {
    name: w.name, start: w.start, dur: w.end - w.start, vol: Math.round(t.vol), sets: t.sets, prs: (w.prs || []).length,
    ex: w.exercises.slice(0, 6).map(e => `${e.sets.length} × ${exName(e)}`),
  };
}

function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function accountForm(mode) {
  const signup = mode === 'signup';
  openSheet(`<h2>${signup ? 'Créer un compte' : 'Se connecter'}</h2>
    ${signup ? `<label class="field">Pseudo (visible par tes amis)<input id="acc-name" value="${esc(db.settings.name)}" placeholder="Ex. Boby" maxlength="24"></label>` : ''}
    <label class="field">Adresse e-mail<input id="acc-email" type="email" autocomplete="email" placeholder="toi@exemple.fr"></label>
    <label class="field">Mot de passe${signup ? ' (6 caractères minimum)' : ''}<input id="acc-pw" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
    <p class="form-err" id="acc-err"></p>
    <button class="btn primary block" data-a="acc-submit" data-mode="${mode}">${signup ? 'Créer mon compte' : 'Me connecter'}</button>
    ${signup ? '' : `<button class="btn ghost block" data-a="acc-reset">Mot de passe oublié ?</button>`}
    <button class="btn ghost block" data-a="close-modal">Annuler</button>`);
}

/* Synchronisation : au moment de la connexion, on fusionne le téléphone et le compte en ligne */
const packFor = w => C().packWorkout(w, ex, workoutTotals(w));
const privateData = () => ({ routines: db.routines, custom: db.custom, measures: db.measures, goals: db.goals || [], badgesSeen: db.badgesSeen || [], settings: { height: db.settings.height ?? null, age: db.settings.age ?? null, ageYear: db.settings.ageYear ?? null, unit: db.settings.unit } });
let lastPrivate = '', privTimer = null;
function schedulePrivatePush() {
  const cl = C();
  if (!cl || !cl.state.user) return;
  clearTimeout(privTimer);
  privTimer = setTimeout(() => {
    const json = JSON.stringify(privateData());
    if (json === lastPrivate) return;
    lastPrivate = json;
    cl.pushPrivate(privateData()).catch(() => { lastPrivate = ''; });
  }, 2500);
}
function cloudPushWorkout(w) {
  const cl = C();
  if (!cl || !cl.state.user) return;
  cl.pushWorkout(w, ex, workoutTotals(w)).catch(() => {});
  const last = db.workouts.reduce((a, x) => Math.max(a, x.start), 0);
  cl.pushStats(db.workouts.length, last).catch(() => {});
}
async function syncOnLogin() {
  const cl = C();
  try {
    const { workouts, priv } = await cl.pullAll();
    const local = new Set(db.workouts.map(w => w.id));
    const remote = new Set(workouts.map(w => w.id));
    let added = 0;
    for (const w of workouts) if (!local.has(w.id)) {
      const { vol, sets, reactions, ...rest } = w;
      db.workouts.push(rest);
      added++;
    }
    if (priv) {
      const merge = (a, b) => { const ids = new Set(a.map(x => x.id)); return [...a, ...(b || []).filter(x => !ids.has(x.id))]; };
      db.routines = merge(db.routines, priv.routines);
      db.custom = merge(db.custom, priv.custom);
      db.goals = merge(db.goals || [], priv.goals);
      db.badgesSeen = [...new Set([...(db.badgesSeen || []), ...(priv.badgesSeen || [])])];
      db.measures = merge(db.measures, priv.measures);
      if (priv.settings) for (const k of ['height', 'age', 'ageYear']) if (db.settings[k] == null && priv.settings[k] != null) db.settings[k] = priv.settings[k];
      rebuildEx();
    }
    const toPush = db.workouts.filter(w => !remote.has(w.id)).map(packFor);
    if (toPush.length) await cl.pushMany(toPush);
    const prof = cl.state.profile;
    if (prof) {
      if (!db.settings.name) db.settings.name = prof.name;
      // Photo et bio : on récupère celles du compte, ou on envoie celles du téléphone
      if (!db.settings.avatar && prof.avatar) db.settings.avatar = prof.avatar;
      if (!db.settings.bio && prof.bio) db.settings.bio = prof.bio;
      const upd = {};
      if (db.settings.avatar && !prof.avatar) upd.avatar = db.settings.avatar;
      if (db.settings.bio && !prof.bio) upd.bio = db.settings.bio;
      if (Object.keys(upd).length) cl.updateProfile(upd).catch(() => {});
    }
    save();
    lastPrivate = '';
    schedulePrivatePush();
    const last = db.workouts.reduce((a, x) => Math.max(a, x.start), 0);
    cl.pushStats(db.workouts.length, last).catch(() => {});
    if (added || toPush.length) toast(`Synchronisé ✔ ${added ? added + ' séance(s) récupérée(s)' : toPush.length + ' séance(s) sauvegardée(s) en ligne'}`);
    render();
  } catch (e) {
    console.warn('sync', e);
  }
}

function vTrain() {
  const rs = db.routines;
  const cards = rs.map(r => `<div class="card">
    <div class="rcard-top"><div class="wcard-name">${esc(r.name)}</div><button class="icon" data-a="routine-menu" data-id="${r.id}" aria-label="Options">⋯</button></div>
    <p class="muted small">${r.exercises.map(e => esc(ex(e.ex).name)).join(', ') || 'Aucun exercice'}</p>
    <button class="btn primary block" data-a="start-routine" data-id="${r.id}">Démarrer</button></div>`).join('');
  const tpl = TEMPLATES.map((t, i) => `<div class="card tpl">
    <button class="tpl-info" data-a="tpl-view" data-i="${i}"><div class="wcard-name">${esc(t.name)}</div>
      <div class="muted small">${esc(t.desc)} · ${t.ex.length} exercices</div>
      <div class="muted small ellipsis tpl-ex">${t.ex.map(([id]) => esc(ex(id).name.replace(/\s*\(.*?\)/g, ''))).join(', ')}</div></button>
    <div class="tpl-btns"><button class="btn ghost small" data-a="tpl-view" data-i="${i}">👁 Voir</button>
      <button class="btn ghost small" data-a="add-template" data-i="${i}">＋ Ajouter</button></div></div>`).join('');
  return {
    title: 'Entraînement',
    html: `${db.active ? '' : `<button class="btn primary block big" data-a="start-empty">＋ Démarrer une séance vide</button>`}
    <div class="row-between"><h2 class="section">Mes programmes</h2><a class="btn ghost small" href="#/routine/new">＋ Nouveau</a></div>
    ${cards || `<div class="empty">Tu n’as pas encore de programme.<br>Crée le tien ou ajoute un programme prêt à l’emploi juste en dessous.</div>`}
    <h2 class="section">Programmes prêts à l’emploi</h2>${tpl}`,
  };
}

function vRoutine(id) {
  if (!draft || draft.id !== id && !(id === 'new' && draft.isNew)) {
    const r = db.routines.find(x => x.id === id);
    draft = r ? clone(r) : { id: 'new', isNew: true, name: '', exercises: [] };
    draft.dirty = false;
  }
  return {
    title: draft.isNew ? 'Nouveau programme' : 'Modifier le programme', back: '#/train',
    actions: `<button class="btn primary small" data-a="routine-save">Enregistrer</button>`,
    html: `<input class="title-in" data-f="name" data-ctx="draft" placeholder="Nom du programme (ex. Push)" value="${esc(draft.name)}">
      ${exEditor('draft')}
      <button class="btn ghost block" data-a="add-ex" data-ctx="draft">＋ Ajouter des exercices</button>`,
  };
}

function vActive() {
  const a = db.active;
  if (!a) { location.hash = '#/home'; return { title: '', html: '' }; }
  const t = workoutTotals(a);
  return {
    title: a.editingId ? 'Modifier la séance' : 'Séance en cours',
    back: '#/home', backIcon: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    actions: `${a.editingId ? '' : `<button class="icon" data-a="manual-rest" aria-label="Minuteur de repos"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6M19 5l1.5 1.5"/></svg></button>`}
      <button class="btn primary small" data-a="finish">${a.editingId ? 'Enregistrer' : 'Terminer'}</button>`,
    html: `<div class="active-stats">
        <div><div class="stat-l">Durée</div><div class="stat-v" id="chrono">${fmtClock((a.editingId ? a.end : Date.now()) - a.start)}</div></div>
        <div><div class="stat-l">Volume</div><div class="stat-v" id="a-vol">${fmtW(t.vol)}</div></div>
        <div><div class="stat-l">Séries</div><div class="stat-v" id="a-sets">${t.sets}</div></div>
      </div>
      <input class="title-in" data-f="name" data-ctx="active" value="${esc(a.name)}" placeholder="Nom de la séance">
      ${exEditor('active')}
      <button class="btn primary block" data-a="add-ex" data-ctx="active">＋ Ajouter des exercices</button>
      <button class="btn danger-ghost block" data-a="discard">${a.editingId ? 'Annuler les modifications' : 'Abandonner la séance'}</button>
      <div class="rest-space"></div>`,
  };
}

function getCtx(ctx) { return ctx === 'active' ? db.active : draft; }

function exEditor(ctx) {
  const c = getCtx(ctx);
  if (!c.exercises.length) return `<div class="empty">Aucun exercice pour l’instant.<br>Ajoute ton premier exercice avec le bouton ci-dessous.</div>`;
  const live = ctx === 'active';
  return c.exercises.map((e, ei) => {
    const e0 = ex(e.ex), fields = FIELDS[e0.type];
    const prev = live ? lastSets(e.ex, c.start, c.editingId) : [];
    let n = 0;
    const rows = e.sets.map((s, si) => {
      const code = s.t && s.t !== 'n' ? SET_CODES[s.t] : String(++n);
      const p = prev[si];
      const inputs = fields.map(f => {
        const val = inDisp(f, s[f]);
        const ph = p && p[f] !== '' && p[f] != null ? inDisp(f, p[f]) : '–';
        return `<td><input class="in" data-in="${f}" data-ctx="${ctx}" data-ei="${ei}" data-si="${si}" value="${esc(val)}" placeholder="${esc(ph)}" inputmode="${f === 'r' || f === 's' ? 'numeric' : 'decimal'}" autocomplete="off"></td>`;
      }).join('');
      return `<tr class="${s.done ? 'done' : ''}">
        <td><button class="set-n t-${s.t || 'n'}" data-a="set-menu" data-ctx="${ctx}" data-ei="${ei}" data-si="${si}">${code}</button></td>
        ${live ? `<td class="prev" data-a="use-prev" data-ei="${ei}" data-si="${si}">${p ? esc(fmtSet(p, e0.type)) : '–'}</td>` : ''}
        ${inputs}
        ${live ? `<td><button class="chk ${s.done ? 'on' : ''}" data-a="set-done" data-ei="${ei}" data-si="${si}" aria-label="Valider la série">✓</button></td>` : ''}
      </tr>`;
    }).join('');
    const rest = e.rest ?? db.settings.rest;
    return `<div class="card ex-card">
      <div class="ex-head">
        <button class="ex-row" data-a="ex-demo" data-id="${e.ex}">${exIcon(e0)}<div class="ex-name accent">${esc(e0.name)}</div></button>
        <button class="icon" data-a="ex-menu" data-ctx="${ctx}" data-ei="${ei}" aria-label="Options">⋯</button>
      </div>
      <input class="note-in" data-f="note" data-ctx="${ctx}" data-ei="${ei}" value="${esc(e.note || '')}" placeholder="Ajouter une note…">
      <button class="rest-btn" data-a="ex-rest" data-ctx="${ctx}" data-ei="${ei}">⏱ Repos : ${fmtRest(rest)}</button>
      <table class="sets"><thead><tr><th>SÉRIE</th>${live ? '<th>PRÉCÉDENT</th>' : ''}${fields.map(f => `<th>${fieldLabel(f)}</th>`).join('')}${live ? '<th>✓</th>' : ''}</tr></thead>
      <tbody>${rows}</tbody></table>
      <button class="btn ghost block small" data-a="set-add" data-ctx="${ctx}" data-ei="${ei}">＋ Ajouter une série</button>
    </div>`;
  }).join('');
}

function vExercises() {
  return {
    title: 'Exercices',
    actions: `<button class="btn ghost small" data-a="new-ex">＋ Créer</button>`,
    html: `<input class="search" data-q="ex" placeholder="🔍 Rechercher un exercice" value="${esc(ui.exQ)}">
      ${chips([['', 'Tous'], ...MUSCLES.map(m => [m, m])], ui.exM, 'ex-muscle')}
      <div id="ex-list" class="list">${exList(ui.exQ, ui.exM, 'link')}</div>`,
  };
}
function filterEx(q, m) {
  const nq = norm(q || '');
  return allEx().filter(e => (!m || e.muscle === m) && (!nq || norm(e.name).includes(nq) || norm(e.equip).includes(nq)));
}
function exList(q, m, mode) {
  const list = filterEx(q, m);
  if (!list.length) return `<div class="empty small">Aucun exercice trouvé. Tu peux le créer avec le bouton « Créer ».</div>`;
  const counts = {};
  for (const w of db.workouts) for (const e of w.exercises) counts[e.ex] = (counts[e.ex] || 0) + 1;
  return list.map(e => {
    let inner = `${exIcon(e)}<div class="grow"><div class="ex-name">${esc(e.name)}${e.custom ? ' <span class="tag">perso</span>' : ''}</div>
      <div class="muted small">${esc(e.muscle)} · ${esc(e.equip)}${counts[e.id] ? ` · fait ${counts[e.id]} fois` : ''}</div></div>`;
    if (mode === 'link') return `<a class="list-item" href="#/exercise/${e.id}">${inner}<span class="muted">›</span></a>`;
    // Dans le sélecteur : un appui sur la photo montre la démo (sans perdre la sélection)
    if (hasPhoto(e.id)) inner = inner.replace('<img class="ex-icon', `<img data-a="ex-demo" data-id="${e.id}" class="ex-icon`);
    const sel = picker && picker.sel.includes(e.id);
    return `<button class="list-item ${sel ? 'sel' : ''}" data-a="pk-item" data-id="${e.id}">${inner}<span class="pk-check">${sel ? '✓' : ''}</span></button>`;
  }).join('');
}

function vExercise(id) {
  const e0 = EXMAP[id];
  if (!e0) return vNotFound();
  const ss = sessionsOf(id);
  const keys = PR_KEYS[e0.type];
  const all = statsOf(ss.flatMap(s => s.sets));
  const chartOpts = e0.type === 'wr'
    ? [['best1', '1RM estimé'], ['maxW', 'Poids max'], ['vol', 'Volume'], ['maxR', 'Reps max']]
    : e0.type === 'bw' ? [['maxR', 'Reps max'], ['totR', 'Reps totales']]
    : e0.type === 'time' ? [['maxS', 'Durée max']] : [['maxD', 'Distance'], ['totM', 'Durée']];
  if (!chartOpts.some(o => o[0] === ui.exChart)) ui.exChart = chartOpts[0][0];
  const val = st => ui.exChart === 'totR' ? st.sets.filter(x => x.t !== 'w').reduce((a, x) => a + (+x.r || 0), 0) : statsOf(st.sets)[ui.exChart];
  const fmtC = ['best1', 'maxW', 'vol'].includes(ui.exChart) ? fmtW : ui.exChart === 'maxS' ? fmtSec : ui.exChart === 'maxD' ? fmtD : ui.exChart === 'totM' ? v => fmtN(v) + ' min' : fmtN;
  const pts = ss.map(s => ({ t: s.w.start, v: val(s) })).filter(p => p.v > 0);
  const hist = [...ss].reverse().slice(0, 30).map(s => `<a class="card hist" href="#/workout/${s.w.id}">
      <div class="row-between"><b>${esc(s.w.name)}</b><span class="muted small">${fmtDate(s.w.start)}</span></div>
      ${s.sets.map((x, i) => `<div class="set-line"><span class="set-n t-${x.t || 'n'}">${x.t && x.t !== 'n' ? SET_CODES[x.t] : i + 1}</span>${fmtSet(x, e0.type)}</div>`).join('')}
    </a>`).join('');
  const q = encodeURIComponent(e0.name.replace(/\(.*?\)/g, '') + ' musculation exécution');
  return {
    title: 'Exercice', back: '#/exercises',
    actions: e0.custom ? `<button class="icon" data-a="custom-menu" data-id="${id}" aria-label="Options">⋯</button>` : '',
    html: `${exDemo(id)}<div class="ex-hero">${hasPhoto(id) ? '' : exIcon(e0)}<div><h2>${esc(e0.name)}</h2><div class="muted">${esc(e0.muscle)} · ${esc(e0.equip)} · ${esc(EX_TYPES[e0.type])}</div></div></div>
      ${exTips(id)}
      <a class="btn ghost block" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">▶ Voir comment le faire (vidéos)</a>
      ${ss.length ? `
      <div class="card"><div class="card-title">Progression</div>
        ${chips(chartOpts, ui.exChart, 'ex-chart')}
        ${lineChart(pts, fmtC)}</div>
      <div class="card"><div class="card-title">Records personnels</div>
        <div class="records">${keys.map(([k, l, f]) => `<div class="rec"><span>${l}</span><b>${all[k] ? f(all[k]) : '–'}</b></div>`).join('')}
        <div class="rec"><span>Nombre de séances</span><b>${ss.length}</b></div></div></div>
      <h2 class="section">Historique</h2>${hist}` : `<div class="empty">Tu n’as pas encore fait cet exercice.<br>Ton historique, tes records et tes graphiques apparaîtront ici.</div>`}`,
  };
}

function vProfile() {
  const ws = db.workouts;
  const totDur = ws.reduce((a, w) => a + (w.end - w.start), 0);
  const totVol = ws.reduce((a, w) => a + workoutTotals(w).vol, 0);
  const weeks = weekBuckets(12);
  const opt = { n: ['Séances', w => w.n, v => v], dur: ['Durée', w => Math.round(w.dur / 60000), v => v + ' min'], vol: ['Volume', w => w.vol, fmtW] }[ui.profChart];
  const name = db.settings.name || 'Mon profil';
  const bmi = bmiInfo();
  return {
    title: 'Profil',
    actions: `<a class="icon" href="#/settings" aria-label="Réglages">⚙️</a>`,
    html: `<div class="profile-head">${avatarHtml(db.settings.name || 'B', db.settings.avatar)}
      <div class="grow"><h2>${esc(name)}</h2><div class="muted">${ws.length} séance${ws.length > 1 ? 's' : ''} au total</div></div>
      <button class="btn ghost small" data-a="profile-edit">✏️ Modifier</button></div>
      ${db.settings.bio ? `<p class="bio">${esc(db.settings.bio)}</p>` : `<button class="link bio-add" data-a="profile-edit">＋ Ajouter une bio et une photo</button>`}
      ${profileMotivation()}
      <a class="card body-card" href="#/measures">
        <div class="stats4">${stat('Poids', lastWeight() ? fmtW(lastWeight()) : '–')}${stat('Taille', db.settings.height ? db.settings.height + ' cm' : '–')}${stat('Âge', currentAge() ? currentAge() + ' ans' : '–')}${stat('IMC', bmi ? fmtN(bmi.v) : '–')}</div>
        ${bmi ? `<div class="muted small">IMC : ${bmi.label}</div>` : ''}
      </a>
      <div class="card"><div class="stats3">${stat('Séances', ws.length)}${stat('Temps total', fmtDur(totDur))}${stat('Volume total', fmtW(totVol))}</div></div>
      <div class="card"><div class="card-title">12 dernières semaines</div>
        ${chips([['n', 'Séances'], ['dur', 'Durée'], ['vol', 'Volume']], ui.profChart, 'prof-chart')}
        ${barChart(weeks.map(w => ({ label: w.label, v: opt[1](w) })), opt[2])}</div>
      ${muscleCard(db.workouts)}
      <div class="card">${calendar()}</div>
      <div class="menu-links">
        <a class="list-item" href="#/measures">📏 <span class="grow">Mesures du corps</span><span class="muted">›</span></a>
        <a class="list-item" href="#/settings">⚙️ <span class="grow">Réglages et sauvegarde</span><span class="muted">›</span></a>
        <button class="list-item" data-a="share-app">📤 <span class="grow">Partager BobyMusc à un ami</span><span class="muted">›</span></button>
      </div>`,
  };
}
function calendar() {
  const now = new Date();
  const m = ui.calMonth || new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const d0 = new Date(m), y = d0.getFullYear(), mo = d0.getMonth();
  const days = new Date(y, mo + 1, 0).getDate();
  const offset = dayShift(d0);
  const on = new Set(db.workouts.map(w => isoDay(w.start)));
  const today = isoDay(Date.now());
  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<span></span>';
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const k = isoDay(new Date(y, mo, d).getTime());
    if (on.has(k)) count++;
    cells += `<span class="day ${on.has(k) ? 'on' : ''} ${k === today ? 'today' : ''}">${d}</span>`;
  }
  const title = monthFmt.format(d0);
  return `<div class="row-between cal-head"><button class="icon" data-a="cal" data-d="-1" aria-label="Mois précédent">‹</button>
    <div class="card-title">${title.charAt(0).toUpperCase() + title.slice(1)} · ${count} jour${count > 1 ? 's' : ''}</div>
    <button class="icon" data-a="cal" data-d="1" aria-label="Mois suivant">›</button></div>
    <div class="cal">${(db.settings.weekStart === 'sun' ? ['D', 'L', 'M', 'M', 'J', 'V', 'S'] : ['L', 'M', 'M', 'J', 'V', 'S', 'D']).map(x => `<b>${x}</b>`).join('')}${cells}</div>`;
}

function measureUnit(u) { return u === 'w' ? U() : u; }
function measureVal(k, v) { return k === 'weight' ? toDisp(v) : v; }
function vMeasures() {
  const list = [...db.measures].sort((a, b) => b.date - a.date);
  const def = MEASURES.find(m => m[0] === ui.measure);
  const pts = list.filter(m => m[ui.measure] !== '' && m[ui.measure] != null).map(m => ({ t: m.date, v: m[ui.measure] })).reverse();
  const fmt = v => fmtN(measureVal(ui.measure, v)) + ' ' + measureUnit(def[2]);
  return {
    title: 'Mesures du corps', back: '#/profile',
    actions: `<button class="btn primary small" data-a="measure-add">＋ Ajouter</button>`,
    html: `<div class="card">${chips(MEASURES.map(m => [m[0], m[1]]), ui.measure, 'measure-chart')}${lineChart(pts, fmt)}</div>
      ${list.length ? list.map(m => `<div class="card">
        <div class="row-between"><b>${fmtDate(m.date)}</b><button class="icon" data-a="measure-del" data-id="${m.id}" aria-label="Supprimer">🗑</button></div>
        <div class="measure-vals">${MEASURES.filter(([k]) => m[k] !== '' && m[k] != null).map(([k, l, u]) => `<span>${l} : <b>${fmtN(measureVal(k, m[k]))} ${measureUnit(u)}</b></span>`).join('')}</div>
      </div>`).join('') : `<div class="empty">Aucune mesure. Ajoute ton poids et tes tours (bras, taille…) pour suivre ton évolution.</div>`}`,
  };
}

function vSettings() {
  const s = db.settings;
  const sel = (k, opts) => `<select data-setting="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(s[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  // hint : petite explication sous le réglage
  const tog = (k, l, hint = '') => `<label class="set-row"><span>${l}${hint ? `<small>${hint}</small>` : ''}</span><input type="checkbox" data-setting="${k}" ${s[k] ? 'checked' : ''}></label>`;
  const cl = C(), st = cl && cl.state;
  const logged = st && st.user;
  return {
    title: 'Réglages', back: '#/profile',
    html: `<h2 class="section first">👤 Profil</h2>
      <div class="card form">
        <label class="set-row"><span>Ton prénom</span><input data-setting="name" value="${esc(s.name)}" placeholder="Prénom"></label>
        <label class="set-row"><span>Taille (cm)</span><input data-setting="height" inputmode="numeric" value="${esc(s.height ?? '')}" placeholder="175"></label>
        <label class="set-row"><span>Âge</span><input data-setting="age" inputmode="numeric" value="${esc(currentAge() ?? '')}" placeholder="25"></label>
      </div>

      <h2 class="section">🏋️ Séance</h2>
      <div class="card form">
        <label class="set-row"><span>Unité de poids</span>${sel('unit', [['kg', 'Kilos (kg)'], ['lb', 'Livres (lb)']])}</label>
        <label class="set-row"><span>Unité de distance</span>${sel('dist', [['km', 'Kilomètres'], ['mi', 'Miles']])}</label>
        <label class="set-row"><span>Séries par défaut<small>pour un exercice jamais fait</small></span>${sel('defSets', [1, 2, 3, 4, 5, 6].map(n => [n, n + ' série' + (n > 1 ? 's' : '')]))}</label>
        ${tog('prefill', 'Pré-remplir avec la dernière séance', 'les poids et reps de la dernière fois sont déjà écrits')}
        ${tog('wakelock', 'Garder l’écran allumé', 'pendant une séance en cours')}
      </div>

      <h2 class="section">⏱ Minuteur de repos</h2>
      <div class="card form">
        <label class="set-row"><span>Repos par défaut</span>${sel('rest', REST_CHOICES.map(r => [r, fmtRest(r)]))}</label>
        ${tog('autoRest', 'Lancer après chaque série', 'dès que tu valides une série avec ✓')}
        <label class="set-row"><span>Son de fin</span>${sel('sound', SOUND_NAMES)}</label>
        ${tog('warn10', 'Prévenir 10 s avant la fin', 'petit bip pour te préparer')}
        ${tog('vibrate', 'Vibration', 'Android seulement')}
        <button class="btn ghost block small test-sound" data-a="test-sound">🔊 Tester le son</button>
      </div>

      <h2 class="section">🎨 Affichage</h2>
      <div class="card form">
        <label class="set-row"><span>Thème</span>${sel('theme', [['dark', 'Sombre'], ['light', 'Clair'], ['auto', 'Comme le téléphone']])}</label>
        <div class="set-row"><span>Couleur</span><div class="swatches">${Object.entries(ACCENTS).map(([k, c]) => `<button class="swatch ${s.accent === k ? 'on' : ''}" style="background:${c}" data-a="accent" data-v="${k}" aria-label="${k}"></button>`).join('')}</div></div>
        <label class="set-row"><span>Taille de l’affichage</span>${sel('textSize', [[90, 'Petite'], [100, 'Normale'], [110, 'Grande'], [120, 'Très grande']])}</label>
        <label class="set-row"><span>La semaine commence le</span>${sel('weekStart', [['mon', 'Lundi'], ['sun', 'Dimanche']])}</label>
      </div>

      <h2 class="section">🤝 Compte et amis</h2>
      <div class="card ${logged ? 'form' : ''}">${logged
        ? `<label class="set-row"><span>Pseudo<small>visible par tes amis</small></span><input id="set-pseudo" data-a2="pseudo" value="${esc(st.profile ? st.profile.name : '')}" maxlength="24"></label>
           <label class="set-row"><span>Montrer mes séances à mes amis<small>si c’est désactivé, tes amis ne voient plus tes séances</small></span><input type="checkbox" data-cloud="share" ${st.profile && st.profile.private ? '' : 'checked'}></label>
           <div class="set-row"><span>Connecté avec<small>${esc(st.user.email)}${st.profile ? ` · code ${esc(st.profile.code)}` : ''}</small></span></div>
           <button class="btn ghost block" data-a="logout">Se déconnecter</button>
           <button class="btn danger-ghost block" data-a="delete-account">Supprimer mon compte en ligne</button>`
        : `<p class="muted small">Crée un compte gratuit pour sauvegarder tes séances en ligne et voir la progression de tes amis.</p>
           <a class="btn primary block" href="#/friends">Créer un compte / Se connecter</a>`}</div>

      <h2 class="section">💾 Sauvegarde</h2>
      <div class="card">
        <p class="muted small">${logged ? 'Tes séances sont aussi sauvegardées en ligne automatiquement. ' : 'Tes données sont enregistrées uniquement sur ce téléphone. '}Tu peux aussi garder une copie dans tes fichiers ou sur Google Drive.</p>
        <button class="btn primary block" data-a="export">⬇ Exporter une sauvegarde</button>
        <button class="btn ghost block" data-a="import">⬆ Importer une sauvegarde</button>
        <button class="btn ghost block" data-a="export-csv">📊 Exporter pour Excel (CSV)</button>
        <input type="file" id="import-file" accept=".json,application/json" hidden>
      </div>
      <div class="card">
        <button class="btn ghost block" data-a="share-app">📤 Partager BobyMusc à un ami</button>
        <button class="btn ghost block" data-a="redo-onboarding">↺ Refaire l’accueil (poids, taille, âge)</button>
        <button class="btn danger-ghost block" data-a="wipe">Effacer toutes mes données</button>
      </div>
      <p class="muted small center">BobyMusc ${VERSION} · 100 % gratuit, sans pub</p>`,
  };
}

function vNotFound() {
  return { title: 'Introuvable', back: '#/home', html: `<div class="empty">Cette page n’existe pas ou a été supprimée.</div>` };
}

/* ---------- Premier lancement : poids, taille, âge ---------- */
const OB_STEPS = [
  { k: 'weight', title: 'Quel est ton poids ?', sub: 'Il sert à suivre ton évolution. Tu pourras le changer plus tard.', min: 25, max: 350 },
  { k: 'height', title: 'Quelle est ta taille ?', sub: 'Elle sert à calculer ton IMC (indice de masse corporelle).', min: 100, max: 250, unit: 'cm' },
  { k: 'age', title: 'Quel âge as-tu ?', sub: 'Pour mieux suivre ta progression au fil des années.', min: 10, max: 100, unit: 'ans' },
];
const ob = { step: 0, weight: 75, height: 175, age: 25 };
function renderOnboarding() {
  const st = OB_STEPS[ob.step];
  const val = st.k === 'weight' ? toDisp(ob.weight) : ob[st.k];
  document.body.classList.add('onboarding');
  $('#top').innerHTML = '';
  $('#activebar').hidden = true;
  $('#restbar').hidden = true;
  $('#view').innerHTML = `<div class="ob">
    <div class="ob-top">
      ${ob.step ? `<button class="icon back" data-a="ob-back" aria-label="Retour">‹</button>` : '<span class="logo">Boby<b>Musc</b></span>'}
      <div class="ob-progress">${OB_STEPS.map((_, i) => `<span class="${i <= ob.step ? 'on' : ''}"></span>`).join('')}</div>
      <span class="muted small">${ob.step + 1}/${OB_STEPS.length}</span>
    </div>
    <h1 class="ob-title">${st.title}</h1>
    <p class="muted">${st.sub}</p>
    ${st.k === 'weight' ? `<div class="seg">${['kg', 'lb'].map(u => `<button class="${U() === u ? 'on' : ''}" data-a="ob-unit" data-v="${u}">${u === 'kg' ? 'kg' : 'lbs'}</button>`).join('')}</div>` : ''}
    <div class="ob-picker">
      <button class="ob-adj" data-a="ob-adj" data-d="-1" aria-label="Moins">−</button>
      <div class="ob-val"><input id="ob-in" data-ob="${st.k}" value="${esc(val)}" inputmode="${st.k === 'weight' ? 'decimal' : 'numeric'}" autocomplete="off"><span>${st.k === 'weight' ? U() : st.unit}</span></div>
      <button class="ob-adj" data-a="ob-adj" data-d="1" aria-label="Plus">+</button>
    </div>
    <div class="ob-foot"><button class="btn primary block big" data-a="ob-next">${ob.step < OB_STEPS.length - 1 ? 'Continuer' : 'C’est parti ! 💪'}</button></div>
  </div>`;
}
function obValid() {
  const st = OB_STEPS[ob.step], v = +ob[st.k];
  if (!(v >= st.min && v <= st.max)) {
    const lim = st.k === 'weight' ? `${fmtN(toDisp(st.min))} et ${fmtN(toDisp(st.max))} ${U()}` : `${st.min} et ${st.max} ${st.unit}`;
    toast(`Entre une valeur entre ${lim}`);
    return false;
  }
  return true;
}
function obFinish() {
  const s = db.settings;
  s.height = Math.round(ob.height);
  s.age = Math.round(ob.age);
  s.ageYear = new Date().getFullYear();
  s.onboarded = true;
  db.measures.push({ id: uid(), date: Date.now(), weight: Math.round(ob.weight * 10) / 10, fat: '', waist: '', chest: '', arm: '', thigh: '', hips: '' });
  save();
  document.body.classList.remove('onboarding');
  location.hash = '#/home';
  render();
}
const currentAge = () => db.settings.age ? db.settings.age + (new Date().getFullYear() - (db.settings.ageYear || new Date().getFullYear())) : null;
function lastWeight() {
  const m = [...db.measures].filter(x => x.weight !== '' && x.weight != null).sort((a, b) => b.date - a.date)[0];
  return m ? m.weight : null;
}
function bmiInfo() {
  const w = lastWeight(), h = db.settings.height;
  if (!w || !h) return null;
  const v = w / ((h / 100) ** 2);
  const label = v < 18.5 ? 'Maigreur' : v < 25 ? 'Corpulence normale' : v < 30 ? 'Surpoids' : 'Obésité';
  return { v, label };
}

/* ---------- Rendu principal ---------- */
const TAB_OF = { home: 'home', workout: 'home', train: 'train', routine: 'train', active: 'train', exercises: 'exercises', exercise: 'exercises', profile: 'profile', measures: 'profile', settings: 'profile', friends: 'friends', friend: 'friends', fworkout: 'friends', group: 'friends', groupinfo: 'friends', goals: 'profile', badges: 'profile', recap: 'profile', timer: 'timer' };
function render() {
  if (!db.settings.onboarded) { renderOnboarding(); return; }
  const hash = location.hash || '#/home';
  route = hash.slice(2).split('/');
  const r = route[0] || 'home';
  if (r !== 'routine') draft = null;
  let v;
  try {
    v = viewFor(r);
  } catch (e) {
    // Une page plante : on le signale et on affiche l'erreur au lieu d'un écran vide
    console.error(e);
    if (window.__report) window.__report('render ' + r + ' : ' + e.message, e.stack);
    v = {
      title: 'Oups', back: r === 'home' ? '' : '#/home',
      html: `<div class="empty">😕 Cette page a rencontré un problème.<br><small>${esc(e.message)}</small><br><br>
        <button class="btn primary" onclick="__fix()">🔧 Réparer</button></div>`,
    };
  }
  finishRender(v, r, hash);
}
function viewFor(r) {
  let v;
  switch (r) {
    case 'home': v = vHome(); break;
    case 'workout': v = vWorkout(route[1]); break;
    case 'train': v = vTrain(); break;
    case 'routine': v = vRoutine(route[1]); break;
    case 'active': v = vActive(); break;
    case 'exercises': v = vExercises(); break;
    case 'exercise': v = vExercise(route[1]); break;
    case 'profile': v = vProfile(); break;
    case 'measures': v = vMeasures(); break;
    case 'settings': v = vSettings(); break;
    case 'friends': v = vFriends(); break;
    case 'friend': v = vFriend(route[1]); break;
    case 'fworkout': v = vFriendWorkout(route[1], route[2]); break;
    case 'timer': v = vTimer(); break;
    case 'goals': v = vGoals(); break;
    case 'badges': v = vBadges(); break;
    case 'recap': v = vRecap(route[1]); break;
    case 'group': v = vGroup(route[1]); break;
    case 'groupinfo': v = vGroupInfo(route[1]); break;
    default: v = vNotFound();
  }
  return v;
}
function finishRender(v, r, hash) {
  document.body.classList.toggle('in-active', r === 'active');
  document.body.classList.toggle('in-chat', r === 'group');
  $('#top').innerHTML = `${v.back ? `<button class="icon back ${v.backCls || ''}" data-a="back" data-to="${v.back}" aria-label="Retour">${v.backIcon || '‹'}</button>` : ''}
    <h1>${v.title}</h1><div class="acts">${v.actions || ''}</div>`;
  $('#view').innerHTML = v.html;
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === TAB_OF[r]));
  updateNavBadge();
  renderActiveBar();
  renderRestBar(true);
  const changed = hash !== lastHash;
  if (changed) { window.scrollTo(0, 0); lastHash = hash; }
  if (r === 'active') keepAwake();
  // Discussion de groupe : on garde l'écoute ouverte aussi sur la page d'infos (pour l'album photo)
  if ((r === 'group' || r === 'groupinfo') && C() && C().state.user && C().state.groups.some(g => g.id === route[1])) {
    watchChat(route[1]);
    if (r === 'group') drawMessages();
  } else stopChat();
}
function updateNavBadge() {
  const cl = C();
  const n = cl && cl.state.user ? cl.state.requests.length + unreadCount() : 0;
  const badge = $('#nav-badge');
  if (badge) { badge.hidden = !n; badge.textContent = n; }
}
function renderActiveBar() {
  const bar = $('#activebar');
  const show = db.active && route[0] !== 'active';
  bar.hidden = !show;
  if (show) bar.innerHTML = `<a href="#/active"><span class="pulse"></span><span class="grow">${esc(db.active.name)}</span><b id="ab-time">${fmtClock(Date.now() - db.active.start)}</b><span class="btn primary small">Reprendre</span></a>`;
}
function updateActiveStats() {
  if (!db.active) return;
  const t = workoutTotals(db.active);
  const v = $('#a-vol'), s = $('#a-sets');
  if (v) v.textContent = fmtW(t.vol);
  if (s) s.textContent = t.sets;
}

/* ---------- Minuteur de repos ---------- */
let audioCtx = null;
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* pas de son disponible */ }
}
function beep(delay, freq, dur = 0.35, type = 'sine', vol = 0.4) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + delay;
  o.frequency.value = freq; o.type = type;
  o.connect(g); g.connect(audioCtx.destination);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
}
const SOUNDS = {
  bip: () => { beep(0, 880); beep(0.45, 880); beep(0.9, 1175); },
  cloche: () => { beep(0, 1318, 1.6, 'sine', 0.35); beep(0, 659, 1.6, 'sine', 0.2); beep(0.8, 1318, 1.6, 'sine', 0.35); beep(0.8, 659, 1.6, 'sine', 0.2); },
  sifflet: () => { beep(0, 2100, 0.25, 'triangle', 0.35); beep(0.32, 2100, 0.25, 'triangle', 0.35); beep(0.64, 2400, 0.6, 'triangle', 0.35); },
  gong: () => { beep(0, 196, 2.2, 'sine', 0.5); beep(0, 392, 1.8, 'sine', 0.25); beep(0, 587, 1.2, 'sine', 0.12); },
  none: () => {},
};
const SOUND_NAMES = [['bip', 'Bip bip'], ['cloche', 'Cloche'], ['sifflet', 'Sifflet'], ['gong', 'Gong'], ['none', 'Aucun son']];
function playSound(kind) {
  try { (SOUNDS[kind] || SOUNDS.bip)(); } catch (e) { /* ignore */ }
}
function restAlarm() {
  playSound(db.settings.sound);
  if (db.settings.vibrate && navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 500]);
  toast('⏱ Repos terminé, à toi de jouer !');
}
function startRest(sec) {
  db.active.rest = { end: Date.now() + sec * 1000, total: sec, warned: sec <= 15 };
  save();
  renderRestBar(true);
}
function renderRestBar(rebuild) {
  const bar = $('#restbar');
  const r = db.active && db.active.rest;
  if (!r || route[0] !== 'active') { bar.hidden = true; bar.dataset.on = ''; return; }
  if (rebuild || !bar.dataset.on) {
    bar.innerHTML = `<div class="rb-fill" id="rb-fill"></div>
      <div class="rb-row"><button class="btn ghost small" data-a="rest-adj" data-d="-15">−15</button>
      <div class="rb-time"><span class="muted small">Repos</span><b id="rb-time"></b></div>
      <button class="btn ghost small" data-a="rest-adj" data-d="15">+15</button>
      <button class="btn primary small" data-a="rest-skip">Passer</button></div>`;
    bar.dataset.on = '1';
  }
  bar.hidden = false;
  const left = Math.max(0, r.end - Date.now());
  $('#rb-time').textContent = fmtClock(left + 999);
  $('#rb-fill').style.width = (100 * left / (r.total * 1000)) + '%';
}
function tick() {
  const a = db.active;
  if (!a) return;
  const ch = $('#chrono');
  if (ch && !a.editingId) ch.textContent = fmtClock(Date.now() - a.start);
  const ab = $('#ab-time');
  if (ab) ab.textContent = fmtClock(Date.now() - a.start);
  if (a.rest) {
    // Petit bip d'avertissement 10 secondes avant la fin
    if (db.settings.warn10 && !a.rest.warned && a.rest.end - Date.now() <= 10000) {
      a.rest.warned = true;
      if (db.settings.sound !== 'none') beep(0, 660, 0.15, 'sine', 0.25);
      if (db.settings.vibrate && navigator.vibrate) navigator.vibrate(120);
    }
    if (Date.now() >= a.rest.end) { a.rest = null; save(); restAlarm(); }
    renderRestBar(false);
  }
}

/* Écran allumé pendant la séance */
let wake = null;
async function keepAwake() {
  if (!db.settings.wakelock || !db.active || wake || !('wakeLock' in navigator)) return;
  try {
    wake = await navigator.wakeLock.request('screen');
    wake.addEventListener('release', () => { wake = null; });
  } catch (e) { /* refusé par le téléphone */ }
}
function releaseWake() { if (wake) { wake.release(); wake = null; } }

/* ---------- Séances ---------- */
function blankSet(src = {}) {
  return { t: src.t || 'n', w: src.w ?? '', r: src.r ?? '', s: src.s ?? '', d: src.d ?? '', m: src.m ?? '', done: false };
}
function defaultName() {
  const h = new Date().getHours();
  return h < 12 ? 'Séance du matin' : h < 18 ? 'Séance de l’après-midi' : 'Séance du soir';
}
function startWorkout(name, exercises, routineId = null) {
  if (db.active) {
    toast('Une séance est déjà en cours');
    location.hash = '#/active';
    return;
  }
  db.active = {
    id: uid(), name: name || defaultName(), start: Date.now(), routineId, rest: null,
    exercises: (exercises || []).map(e => ({ ex: e.ex, rest: e.rest, note: '', sets: e.sets.map(s => blankSet(s)) })),
  };
  db.active.exercises.forEach(prefillFromLast);
  save();
  unlockAudio();
  location.hash = '#/active';
}
function addExercises(ctx, ids) {
  const c = getCtx(ctx);
  for (const id of ids) {
    const prev = ctx === 'active' ? lastSets(id, Infinity, c.editingId) : [];
    const n = prev.length || +db.settings.defSets || 3;
    const e = { ex: id, note: '', rest: undefined, sets: Array.from({ length: n }, (_, i) => blankSet({ t: prev[i] ? prev[i].t : 'n' })) };
    if (ctx === 'active') prefillFromLast(e);
    c.exercises.push(e);
  }
  if (ctx === 'draft') draft.dirty = true; else save();
  render();
}
// Réglage « Pré-remplir » : recopie les valeurs de la dernière fois dans les cases vides
function prefillFromLast(e) {
  if (!db.settings.prefill) return;
  const prev = lastSets(e.ex, Infinity, db.active && db.active.editingId);
  e.sets.forEach((s, i) => {
    const p = prev[i];
    if (!p) return;
    for (const f of FIELDS[ex(e.ex).type]) if ((s[f] === '' || s[f] == null) && p[f] !== '' && p[f] != null) s[f] = p[f];
  });
}
function toggleSet(ei, si) {
  const a = db.active, e = a.exercises[ei], s = e.sets[si], type = ex(e.ex).type;
  if (!s.done) {
    const p = lastSets(e.ex, a.start, a.editingId)[si];
    for (const f of FIELDS[type]) if ((s[f] === '' || s[f] == null) && p && p[f] !== '' && p[f] != null) s[f] = p[f];
    if (type === 'wr' && s.w === '' && +s.r > 0) s.w = 0;
    if (!setValid(s, type)) { toast('Remplis la série avant de la valider'); return; }
    s.done = true;
    unlockAudio();
    const rest = e.rest ?? db.settings.rest;
    if (rest > 0 && !a.editingId && db.settings.autoRest) startRest(rest);
  } else s.done = false;
  save();
  render();
}
function finishPrompt() {
  const a = db.active;
  const t = workoutTotals(a);
  if (!t.sets) {
    confirmBox('Aucune série validée (✓).<br>Veux-tu abandonner cette séance ?', 'Abandonner la séance', discardActive);
    return;
  }
  const dur = (a.editingId ? a.end : Date.now()) - a.start;
  openSheet(`<h2>${a.editingId ? 'Enregistrer les modifications' : 'Terminer la séance'}</h2>
    <div class="stats3">${stat('Durée', fmtDur(dur))}${stat('Volume', fmtW(t.vol))}${stat('Séries', t.sets)}</div>
    <label class="field">Nom<input id="fin-name" value="${esc(a.name)}"></label>
    <label class="field">Note (comment tu t’es senti…)<textarea id="fin-note" rows="3">${esc(a.note || '')}</textarea></label>
    <p class="muted small">Les séries non validées (sans ✓) ne seront pas enregistrées.</p>
    <button class="btn primary block" data-a="finish-save">Enregistrer la séance</button>
    <button class="btn ghost block" data-a="close-modal">Continuer</button>`);
}
function finishSave() {
  const a = db.active;
  const editing = !!a.editingId;
  const w = {
    id: a.editingId || a.id,
    name: $('#fin-name').value.trim() || a.name || 'Séance',
    note: $('#fin-note').value.trim(),
    start: a.start, end: editing ? a.end : Date.now(), routineId: a.routineId || null,
    exercises: a.exercises.map(e => ({
      ex: e.ex, note: e.note || '', rest: e.rest,
      sets: e.sets.filter(s => s.done).map(({ done, ...s }) => s),
    })).filter(e => e.sets.length),
  };
  w.prs = computePRs(w);
  if (editing) db.workouts = db.workouts.map(x => x.id === w.id ? w : x);
  else db.workouts.push(w);
  // Objectifs atteints et badges débloqués grâce à cette séance
  const goalsDone = checkGoals(), badgesNew = newBadges();
  cloudPushWorkout(w);
  delete net[`fw/${C()?.state.user?.uid}/${w.id}`];
  db.active = null;
  save();
  releaseWake();
  closeModal();
  if (!editing) afterNav = () => celebrate(w, goalsDone, badgesNew);
  location.hash = '#/workout/' + w.id;
}
let afterNav = null;
function celebrate(w, goals = [], badges = []) {
  const n = db.workouts.length, t = workoutTotals(w);
  openSheet(`<div class="celebrate"><div class="big-emoji">💪</div><h2>Bravo !</h2>
    <p class="muted">C’est ta ${n === 1 ? '1re' : n + 'e'} séance avec BobyMusc.</p>
    <div class="stats3">${stat('Durée', fmtDur(w.end - w.start))}${stat('Volume', fmtW(t.vol))}${stat('Séries', t.sets)}</div>
    ${w.prs.length ? `<h3>🏆 ${w.prs.length} nouveau${w.prs.length > 1 ? 'x' : ''} record${w.prs.length > 1 ? 's' : ''} !</h3>
      <div class="pr-list">${w.prs.map(p => `<span class="badge">${esc(ex(p.ex).name)} · ${esc(p.label)} : ${esc(PR_KEYS[ex(p.ex).type].find(k => k[0] === p.k)[2](p.v))}</span>`).join('')}</div>` : ''}
    ${goals.length ? `<h3>🎯 Objectif${goals.length > 1 ? 's' : ''} atteint${goals.length > 1 ? 's' : ''} !</h3><div class="pr-list">${goals.map(g => `<span class="badge">${esc(goalTitle(g))}</span>`).join('')}</div>` : ''}
    ${badges.length ? `<h3>🏅 Nouveau${badges.length > 1 ? 'x' : ''} badge${badges.length > 1 ? 's' : ''} !</h3><div class="new-badges">${badges.map(b => `<div><span>${b.icon}</span><b>${esc(b.name)}</b></div>`).join('')}</div>` : ''}
    <div class="muted small">🔥 Série : ${streakLabel(streakInfo().cur)}</div>
    <button class="btn primary block" data-a="close-modal">Super !</button></div>`);
}
function discardActive() {
  db.active = null;
  save();
  releaseWake();
  location.hash = '#/home';
}
function editWorkout(id) {
  if (db.active) { toast('Termine d’abord la séance en cours'); return; }
  const w = db.workouts.find(x => x.id === id);
  const c = clone(w);
  db.active = { ...c, editingId: w.id, rest: null, exercises: c.exercises.map(e => ({ ...e, sets: e.sets.map(s => ({ ...blankSet(s), done: true })) })) };
  save();
  location.hash = '#/active';
}
function routineFromExercises(name, exercises) {
  return { id: uid(), name, exercises: exercises.map(e => ({ ex: e.ex, rest: e.rest, sets: e.sets.map(s => ({ t: s.t || 'n', w: s.w ?? '', r: s.r ?? '', s: s.s ?? '', d: s.d ?? '', m: s.m ?? '' })) })) };
}

/* ---------- Sélecteur d'exercices ---------- */
function openPicker(multi, cb) {
  picker = { multi, cb, sel: [], q: '', m: '' };
  openSheet(`<div class="sheet-head"><button class="link" data-a="close-modal">Annuler</button><b>${multi ? 'Ajouter des exercices' : 'Remplacer par…'}</b><button class="link" data-a="new-ex">Créer</button></div>
    <input class="search" data-q="pk" placeholder="🔍 Rechercher">
    <div id="pk-chips">${chips([['', 'Tous'], ...MUSCLES.map(m => [m, m])], '', 'pk-muscle')}</div>
    <div class="list pk-list" id="pk-list">${exList('', '', 'pick')}</div>
    ${multi ? `<div class="sheet-foot"><button class="btn primary block" data-a="pk-ok" id="pk-ok" disabled>Ajouter</button></div>` : ''}`, 'full');
}
function refreshPicker() {
  $('#pk-list').innerHTML = exList(picker.q, picker.m, 'pick');
  const ok = $('#pk-ok');
  if (ok) { ok.disabled = !picker.sel.length; ok.textContent = picker.sel.length ? `Ajouter ${picker.sel.length} exercice${picker.sel.length > 1 ? 's' : ''}` : 'Ajouter'; }
}
function customExForm(e = null) {
  const pickerCb = picker ? picker.cb : null;
  const opt = (list, cur) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('');
  openSheet(`<h2>${e ? 'Modifier l’exercice' : 'Créer un exercice'}</h2>
    <label class="field">Nom<input id="cx-name" value="${esc(e ? e.name : '')}" placeholder="Ex. Développé couché prise large"></label>
    <label class="field">Muscle principal<select id="cx-muscle">${opt(MUSCLES.map(m => [m, m]), e ? e.muscle : 'Pectoraux')}</select></label>
    <label class="field">Matériel<select id="cx-equip">${opt(EQUIPS.map(m => [m, m]), e ? e.equip : 'Haltères')}</select></label>
    <label class="field">Ce que tu notes<select id="cx-type">${opt(Object.entries(EX_TYPES), e ? e.type : 'wr')}</select></label>
    <button class="btn primary block" data-a="cx-save" data-id="${e ? e.id : ''}">Enregistrer</button>
    <button class="btn ghost block" data-a="close-modal">Annuler</button>`);
  customCb = pickerCb;
}
let customCb = null;

/* ---------- Sauvegarde fichier ---------- */
async function exportData() {
  const name = `bobymusc-sauvegarde-${isoDay(Date.now())}.json`;
  const blob = new Blob([JSON.stringify(db)], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      await navigator.share({ files: [file], title: 'Sauvegarde BobyMusc' });
      return;
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Sauvegarde téléchargée');
}
// Une ligne par série, lisible dans Excel (séparateur « ; » et virgule décimale à la française)
async function exportCsv() {
  if (!db.workouts.length) { toast('Aucune séance à exporter'); return; }
  const cell = v => {
    const s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v ?? '');
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rows = [['Date', 'Heure', 'Séance', 'Exercice', 'Muscle', 'Série', 'Type de série', `Poids (${U()})`, 'Répétitions', 'Durée (s)', `Distance (${UD()})`, 'Durée (min)', 'Note']];
  for (const w of sortedWorkouts().reverse()) {
    const d = new Date(w.start);
    for (const e of w.exercises) {
      e.sets.forEach((s, i) => rows.push([
        isoDay(w.start), timeFmt.format(d), w.name, exName(e), exMuscle(e), i + 1, SET_TYPES[s.t || 'n'],
        s.w === '' || s.w == null ? '' : toDisp(s.w), s.r ?? '', s.s ?? '', s.d === '' || s.d == null ? '' : toDispD(s.d), s.m ?? '', i === 0 ? e.note || '' : '',
      ]));
    }
  }
  const csv = '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n');
  const name = `bobymusc-seances-${isoDay(Date.now())}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  try {
    const file = new File([blob], name, { type: 'text/csv' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      await navigator.share({ files: [file], title: 'Mes séances BobyMusc' });
      return;
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Fichier Excel téléchargé ✔');
}
function importData(file) {
  const rd = new FileReader();
  rd.onload = () => {
    let d;
    try { d = JSON.parse(rd.result); } catch (e) { d = null; }
    if (!d || !Array.isArray(d.workouts)) { toast('Ce fichier n’est pas une sauvegarde BobyMusc'); return; }
    confirmBox(`Remplacer tes données actuelles par cette sauvegarde (${d.workouts.length} séances) ?`, 'Importer', () => {
      localStorage.setItem(KEY, JSON.stringify(d));
      load(); rebuildEx(); applyTheme();
      toast('Sauvegarde importée ✔');
      location.hash = '#/home';
      render();
    }, false);
  };
  rd.readAsText(file);
}
async function shareApp() {
  const data = { title: 'BobyMusc', text: 'BobyMusc, mon appli de muscu 100 % gratuite. Ouvre le lien puis « Ajouter à l’écran d’accueil » :', url: APP_URL };
  try {
    if (navigator.share) { await navigator.share(data); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(APP_URL); toast('Lien copié : ' + APP_URL); }
  catch (e) { toast(APP_URL); }
}

/* ---------- Actions (clics) ---------- */
const A = {
  // Minuteur lancé à la main (bouton ⏱ en haut de la séance)
  'manual-rest': () => {
    const r = db.active.rest;
    menu(r ? `Repos en cours : ${fmtClock(r.end - Date.now() + 999)}` : 'Lancer un minuteur de repos',
      [30, 45, 60, 90, 120, 150, 180, 240, 300].map(s => ({ label: '⏱ ' + fmtSec(s), fn: () => { unlockAudio(); startRest(s); } }))
        .concat(r ? [{ label: '⏹ Arrêter le minuteur', danger: true, fn: () => { db.active.rest = null; save(); renderRestBar(); } }] : []));
  },
  'test-sound': () => { unlockAudio(); playSound(db.settings.sound === 'none' ? 'bip' : db.settings.sound); },
  'export-csv': () => exportCsv(),
  'redo-onboarding': () => confirmBox('Refaire les pages Poids, Taille et Âge ? Tes séances ne sont pas touchées.', 'Refaire', () => {
    const w = lastWeight();
    if (w) ob.weight = w;
    if (db.settings.height) ob.height = db.settings.height;
    if (currentAge()) ob.age = currentAge();
    ob.step = 0;
    db.settings.onboarded = false;
    save();
    render();
  }, false),
  'delete-account': () => confirmBox('Supprimer ton compte en ligne ?<br><small>Tes séances en ligne, ton code ami et tes amitiés seront effacés. Les séances restent sur ce téléphone.</small>', 'Supprimer mon compte', async () => {
    toast('Suppression en cours…');
    try {
      await C().deleteAccount();
      for (const k in net) delete net[k];
      toast('Compte supprimé');
      render();
    } catch (e) {
      toast(e.code === 'auth/requires-recent-login' ? 'Par sécurité, déconnecte-toi, reconnecte-toi, puis réessaie.' : C().errMsg(e));
    }
  }),
  /* Groupes */
  'group-new': () => groupForm(),
  'group-edit': d => groupForm(C().state.groups.find(g => g.id === d.id)),
  'g-emoji': (d, el) => { ui.groupEmoji = d.v; $$('.emoji-pick button').forEach(b => b.classList.toggle('on', b === el)); },
  'g-friend': (d, el) => {
    const s = ui.groupSel;
    if (s.has(d.uid)) s.delete(d.uid); else s.add(d.uid);
    el.classList.toggle('sel', s.has(d.uid));
    el.querySelector('.pk-check').textContent = s.has(d.uid) ? '✓' : '';
  },
  'g-save': async (d, el) => {
    const name = $('#g-name').value.trim();
    if (name.length < 2) { toast('Donne un nom au groupe'); return; }
    el.disabled = true;
    try {
      if (d.id) { await C().renameGroup(d.id, name, ui.groupEmoji); closeModal(); toast('Groupe modifié ✔'); render(); return; }
      const friends = C().state.friends.filter(f => ui.groupSel.has(f.uid));
      const gid = await C().createGroup(name, ui.groupEmoji, friends);
      closeModal();
      location.hash = '#/group/' + gid;
    } catch (e) { toast(C().errMsg(e)); el.disabled = false; }
  },
  'group-add': d => {
    const g = C().state.groups.find(x => x.id === d.id);
    const list = C().state.friends.filter(f => !g.members.includes(f.uid));
    if (!list.length) { toast('Tous tes amis sont déjà dans le groupe'); return; }
    ui.groupSel = new Set();
    openSheet(`<h2>Ajouter au groupe</h2>
      <div class="menu-links pick-friends">${list.map(f => `<button class="list-item" data-a="g-friend" data-uid="${f.uid}"><div class="avatar sm">${esc((f.name || '?')[0].toUpperCase())}</div><span class="grow">${esc(f.name)}</span><span class="pk-check"></span></button>`).join('')}</div>
      <button class="btn primary block" data-a="g-add-ok" data-id="${d.id}">Ajouter</button>
      <button class="btn ghost block" data-a="close-modal">Annuler</button>`);
  },
  'g-add-ok': async d => {
    const friends = C().state.friends.filter(f => ui.groupSel.has(f.uid));
    if (!friends.length) { toast('Choisis au moins un ami'); return; }
    try { await C().addMembers(d.id, friends); closeModal(); toast('Ajouté ✔'); } catch (e) { toast(C().errMsg(e)); }
  },
  'group-leave': d => {
    const g = C().state.groups.find(x => x.id === d.id);
    confirmBox(`Quitter « ${esc(g.name)} » ? Tu ne verras plus les messages.`, 'Quitter', async () => {
      try { await C().leaveGroup(g); location.hash = '#/friends'; toast('Tu as quitté le groupe'); } catch (e) { toast(C().errMsg(e)); }
    });
  },
  'group-delete': d => {
    const g = C().state.groups.find(x => x.id === d.id);
    confirmBox(`Supprimer « ${esc(g.name)} » et tous ses messages pour tout le monde ?`, 'Supprimer', async () => {
      try { stopChat(); await C().deleteGroup(g.id); location.hash = '#/friends'; toast('Groupe supprimé'); } catch (e) { toast(C().errMsg(e)); }
    });
  },
  'send-msg': async () => {
    const box = $('#msg-in'), text = box.value.trim();
    if (!text) return;
    box.value = ''; ui.chatDraft = ''; autoGrow(box);
    try { await C().sendMessage(route[1], { text }); } catch (e) { toast(C().errMsg(e)); box.value = text; }
  },
  // Les Android récents ne proposent plus l'appareil photo dans le sélecteur : on offre les deux choix
  'send-photo': () => menu('Envoyer une photo', [
    { label: '📷 Prendre une photo', fn: () => $('#photo-cam').click() },
    { label: '🖼️ Choisir dans la galerie', fn: () => $('#photo-in').click() },
  ]),
  'share-workout': () => {
    const ws = sortedWorkouts().slice(0, 8);
    if (!ws.length) { toast('Tu n’as pas encore de séance à partager'); return; }
    const gid = route[1];
    menu('Partager une séance', ws.map(w => ({
      label: `🏋️ ${esc(w.name)} <span class="muted small">· ${fmtDate(w.start)}</span>`,
      fn: () => C().sendMessage(gid, { workout: workoutSummary(w) }).catch(e => toast(C().errMsg(e))),
    })));
  },
  'photo-view': d => {
    const m = chat.msgs && chat.msgs.find(x => x.id === d.mid);
    if (!m) return;
    openSheet(`<img class="photo-full" src="${m.img}" alt="Photo">
      <div class="muted small center">${esc(m.name || '')} · ${fmtDate(m.at)} ${timeFmt.format(new Date(m.at))}</div>
      <button class="btn ghost block" data-a="close-modal">Fermer</button>`, 'photo');
  },
  'msg-menu': (d, el) => {
    if (el.closest && document.activeElement && document.activeElement.id === 'msg-in') return;
    const gid = route[1];
    const m = chat.msgs.find(x => x.id === d.mid);
    if (!m) return;
    menu('Message', [
      ...(m.text ? [{ label: '📋 Copier le texte', fn: () => navigator.clipboard.writeText(m.text).then(() => toast('Copié ✔'), () => {}) }] : []),
      { label: '🗑 Supprimer le message', danger: true, fn: () => C().deleteMessage(gid, m.id).catch(e => toast(C().errMsg(e))) },
    ]);
  },
  /* Compte et amis */
  'acc-signup': () => accountForm('signup'),
  'acc-login': () => accountForm('login'),
  'acc-submit': async (d, el) => {
    const cl = C(); if (!cl) return;
    const email = $('#acc-email').value.trim(), pw = $('#acc-pw').value;
    const err = $('#acc-err');
    const name = d.mode === 'signup' ? $('#acc-name').value.trim() : '';
    if (d.mode === 'signup' && name.length < 2) { err.textContent = 'Choisis un pseudo (2 caractères minimum).'; return; }
    el.disabled = true; el.textContent = 'Patiente…';
    try {
      if (d.mode === 'signup') { await cl.signUp(name, email, pw); if (!db.settings.name) { db.settings.name = name; save(); } }
      else await cl.signIn(email, pw);
      closeModal();
      toast(d.mode === 'signup' ? 'Compte créé ✔ Bienvenue !' : 'Connecté ✔');
    } catch (e) {
      err.textContent = cl.errMsg(e);
      el.disabled = false; el.textContent = d.mode === 'signup' ? 'Créer mon compte' : 'Me connecter';
    }
  },
  'acc-reset': async () => {
    const email = $('#acc-email').value.trim();
    if (!email) { $('#acc-err').textContent = 'Écris d’abord ton adresse e-mail au-dessus.'; return; }
    try { await C().resetPassword(email); $('#acc-err').textContent = ''; toast('E-mail envoyé ✔ Regarde ta boîte mail (et les spams)'); }
    catch (e) { $('#acc-err').textContent = C().errMsg(e); }
  },
  'logout': () => confirmBox('Te déconnecter ? Tes séances restent sur ce téléphone.', 'Me déconnecter', () => { C().signOut(); for (const k in net) delete net[k]; toast('Déconnecté'); }, false),
  'share-code': async () => {
    const code = C().state.profile.code;
    const text = `Ajoute-moi sur BobyMusc 💪 Mon code ami : ${code}\n${APP_URL}`;
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); toast('Code copié ✔ Colle-le dans un message'); } catch (e) { toast(code); }
  },
  'add-friend': async (d, el) => {
    const code = $('#friend-code').value;
    if (!code.trim()) { toast('Écris le code de ton ami'); return; }
    el.disabled = true;
    try {
      const r = await C().addFriend(code);
      toast(r === 'accepted' ? 'Vous êtes maintenant amis ✔' : 'Demande envoyée ✔ Ton ami doit l’accepter');
      $('#friend-code').value = '';
    } catch (e) { toast(C().errMsg(e)); }
    el.disabled = false;
  },
  'req-ok': async d => {
    const r = C().state.requests.find(x => x.uid === d.uid);
    try { await C().accept(r); toast(`${r.name} est maintenant ton ami ✔`); delete net.feed; } catch (e) { toast(C().errMsg(e)); }
  },
  'req-no': d => {
    const r = C().state.requests.find(x => x.uid === d.uid);
    confirmBox(`Refuser la demande de ${esc(r.name)} ?`, 'Refuser', () => C().refuse(r).catch(e => toast(C().errMsg(e))));
  },
  'friends-tab': d => { ui.friendsTab = d.v; render(); },
  'feed-refresh': () => { for (const k in net) delete net[k]; render(); toast('Actualisé'); },
  'friend-menu': d => {
    const f = C().state.friends.find(x => x.uid === d.uid);
    menu(f.name, [{ label: '🗑 Retirer de mes amis', danger: true, fn: () => confirmBox(`Retirer ${esc(f.name)} de tes amis ? Vous ne verrez plus vos séances.`, 'Retirer', async () => {
      try { await C().removeFriend(f.uid); delete net.feed; location.hash = '#/friends'; } catch (e) { toast(C().errMsg(e)); }
    }) }]);
  },
  'react': async d => {
    const key = `fw/${d.owner}/${d.wid}`, w = net[key] && net[key].data;
    if (!w) return;
    const me = C().state.user.uid, cur = (w.reactions || {})[me];
    const emoji = cur && cur.e === d.e ? null : d.e;
    // Mise à jour immédiate à l'écran, puis envoi
    w.reactions = { ...(w.reactions || {}) };
    if (emoji) w.reactions[me] = { e: emoji, n: C().state.profile.name }; else delete w.reactions[me];
    render();
    try { await C().react(d.owner, d.wid, emoji); delete net.feed; } catch (e) { toast(C().errMsg(e)); }
  },
  'ob-unit': d => { db.settings.unit = d.v; save(); renderOnboarding(); },
  'ob-adj': d => {
    const st = OB_STEPS[ob.step], dir = +d.d;
    if (st.k === 'weight') {
      const step = U() === 'lb' ? 1 : 0.5;
      const disp = Math.round((toDisp(+ob.weight || 0) + dir * step) / step) * step;
      ob.weight = fromDisp(disp);
    } else ob[st.k] = Math.round(+ob[st.k] || 0) + dir;
    const v = st.k === 'weight' ? toDisp(ob.weight) : ob[st.k];
    $('#ob-in').value = Math.round(v * 10) / 10;
  },
  'ob-next': () => {
    if (!obValid()) return;
    if (ob.step < OB_STEPS.length - 1) { ob.step++; renderOnboarding(); } else obFinish();
  },
  'ob-back': () => { ob.step = Math.max(0, ob.step - 1); renderOnboarding(); },
  'back': d => {
    if (route[0] === 'routine' && draft && draft.dirty) {
      confirmBox('Quitter sans enregistrer le programme ?', 'Quitter', () => { draft = null; location.hash = d.to; });
      return;
    }
    location.hash = d.to;
  },
  'close-modal': () => closeModal(),
  'menu-pick': d => { const fn = modalFns[+d.i]; closeModal(); if (fn) fn(); },
  'more-hist': () => { ui.histLimit += 20; render(); },
  'start-empty': () => startWorkout(),
  'start-routine': d => { const r = db.routines.find(x => x.id === d.id); startWorkout(r.name, r.exercises, r.id); },
  'redo': d => { const w = db.workouts.find(x => x.id === d.id); startWorkout(w.name, w.exercises.map(e => ({ ...e, sets: e.sets.map(s => ({ ...s })) }))); },
  'workout-menu': d => {
    const w = db.workouts.find(x => x.id === d.id);
    menu(w.name, [
      { label: '✏️ Modifier la séance', fn: () => editWorkout(w.id) },
      { label: '📋 Enregistrer comme programme', fn: () => { db.routines.push(routineFromExercises(w.name, w.exercises)); save(); toast('Programme créé ✔'); } },
      { label: '📤 Partager', fn: () => shareWorkout(w) },
      { label: '🗑 Supprimer la séance', danger: true, fn: () => confirmBox('Supprimer définitivement cette séance ?', 'Supprimer', () => { db.workouts = db.workouts.filter(x => x.id !== w.id); save(); if (C()?.state.user) C().deleteWorkout(w.id).catch(() => {}); location.hash = '#/home'; }) },
    ]);
  },
  'routine-menu': d => {
    const r = db.routines.find(x => x.id === d.id);
    menu(r.name, [
      { label: '✏️ Modifier', fn: () => { location.hash = '#/routine/' + r.id; } },
      { label: '⧉ Dupliquer', fn: () => { const c = clone(r); c.id = uid(); c.name += ' (copie)'; db.routines.push(c); save(); render(); } },
      { label: '🗑 Supprimer', danger: true, fn: () => confirmBox(`Supprimer le programme « ${esc(r.name)} » ?`, 'Supprimer', () => { db.routines = db.routines.filter(x => x.id !== r.id); save(); render(); }) },
    ]);
  },
  // Démo d'un exercice dans une fenêtre par-dessus tout (ne ferme pas le sélecteur ni la séance)
  'ex-demo': d => {
    const e0 = ex(d.id), box = $('#demo');
    box.innerHTML = `<div class="backdrop" data-a="demo-close"></div><div class="sheet demo-sheet">
      ${exDemo(d.id) || exIcon(e0)}
      <h2>${esc(e0.name)}</h2><div class="muted">${esc(e0.muscle)} · ${esc(e0.equip)}</div>
      ${exTips(d.id)}
      <a class="btn ghost block" href="https://www.youtube.com/results?search_query=${encodeURIComponent(e0.name.replace(/\(.*?\)/g, '') + ' musculation exécution')}" target="_blank" rel="noopener">▶ Voir en vidéo</a>
      <button class="btn primary block" data-a="demo-close">Fermer</button></div>`;
    box.classList.add('open');
  },
  'demo-close': () => { $('#demo').classList.remove('open'); $('#demo').innerHTML = ''; },
  'demo-toggle': (d, el) => el.classList.toggle('paused'),
  // Aperçu d'un programme prêt à l'emploi avant de l'ajouter
  'tpl-view': d => {
    const t = TEMPLATES[+d.i];
    const muscles = [...new Set(t.ex.map(([id]) => ex(id).muscle))];
    const totalSets = t.ex.reduce((a, [, n]) => a + n, 0);
    openSheet(`<h2>${esc(t.name)}</h2>
      <p class="muted">${esc(t.desc)}</p>
      <div class="stats3">${stat('Exercices', t.ex.length)}${stat('Séries', totalSets)}${stat('Durée estimée', '≈ ' + Math.round(totalSets * 2.5 / 5) * 5 + ' min')}</div>
      <div class="chips wrap">${muscles.map(m => `<span class="chip">${esc(m)}</span>`).join('')}</div>
      <div class="menu-links tpl-list">${t.ex.map(([id, n, reps]) => {
        const e0 = ex(id);
        return `<div class="list-item">${exIcon(e0)}<div class="grow"><b>${esc(e0.name)}</b><div class="muted small">${esc(e0.muscle)} · ${esc(e0.equip)}</div></div>
          <span class="tpl-sets">${n} × ${e0.type === 'time' ? reps + ' s' : reps}</span></div>`;
      }).join('')}</div>
      <p class="muted small">Tu pourras modifier les exercices, les séries et les répétitions après l’avoir ajouté.</p>
      <button class="btn primary block" data-a="add-template" data-i="${d.i}">＋ Ajouter à mes programmes</button>
      <button class="btn ghost block" data-a="close-modal">Fermer</button>`);
  },
  'add-template': d => {
    closeModal();
    const t = TEMPLATES[+d.i];
    const exs = t.ex.map(([id, n, reps]) => ({ ex: id, sets: Array.from({ length: n }, () => ex(id).type === 'time' ? { s: reps } : { r: reps }) }));
    db.routines.push(routineFromExercises(t.name, exs));
    save();
    toast(`« ${t.name} » ajouté à tes programmes ✔`);
    render();
  },
  'routine-save': () => {
    if (!draft.exercises.length) { toast('Ajoute au moins un exercice'); return; }
    const r = { id: draft.isNew ? uid() : draft.id, name: draft.name.trim() || 'Mon programme', exercises: draft.exercises };
    if (draft.isNew) db.routines.push(r); else db.routines = db.routines.map(x => x.id === r.id ? r : x);
    save();
    draft = null;
    toast('Programme enregistré ✔');
    location.hash = '#/train';
  },
  'add-ex': d => openPicker(true, ids => addExercises(d.ctx, ids)),
  'pk-item': d => {
    if (!picker.multi) { const cb = picker.cb; closeModal(); cb([d.id]); return; }
    const i = picker.sel.indexOf(d.id);
    if (i >= 0) picker.sel.splice(i, 1); else picker.sel.push(d.id);
    refreshPicker();
  },
  'pk-muscle': (d, el) => {
    picker.m = d.v;
    $$('#pk-chips .chip').forEach(c => c.classList.toggle('on', c === el));
    refreshPicker();
  },
  'pk-ok': () => { const { cb, sel } = picker; closeModal(); cb(sel); },
  'new-ex': () => customExForm(),
  'cx-save': d => {
    const name = $('#cx-name').value.trim();
    if (!name) { toast('Donne un nom à l’exercice'); return; }
    const data = { name, muscle: $('#cx-muscle').value, equip: $('#cx-equip').value, type: $('#cx-type').value, custom: true };
    let id = d.id;
    if (id) db.custom = db.custom.map(x => x.id === id ? { ...x, ...data } : x);
    else { id = 'c_' + uid(); db.custom.push({ id, ...data }); }
    save(); rebuildEx();
    const cb = customCb; customCb = null;
    closeModal();
    if (cb && !d.id) cb([id]); else render();
    toast('Exercice enregistré ✔');
  },
  'custom-menu': d => {
    const e = EXMAP[d.id];
    menu(e.name, [
      { label: '✏️ Modifier', fn: () => customExForm(e) },
      { label: '🗑 Supprimer', danger: true, fn: () => confirmBox('Supprimer cet exercice ? Il restera visible dans tes anciennes séances.', 'Supprimer', () => { db.custom = db.custom.filter(x => x.id !== e.id); save(); rebuildEx(); location.hash = '#/exercises'; }) },
    ]);
  },
  'ex-muscle': (d, el) => {
    ui.exM = d.v;
    $$('.chip[data-a="ex-muscle"]').forEach(c => c.classList.toggle('on', c === el));
    $('#ex-list').innerHTML = exList(ui.exQ, ui.exM, 'link');
  },
  'ex-chart': d => { ui.exChart = d.v; render(); },
  'prof-chart': d => { ui.profChart = d.v; render(); },
  'measure-chart': d => { ui.measure = d.v; render(); },
  'cal': d => {
    const now = new Date();
    const cur = new Date(ui.calMonth || new Date(now.getFullYear(), now.getMonth(), 1).getTime());
    ui.calMonth = new Date(cur.getFullYear(), cur.getMonth() + +d.d, 1).getTime();
    render();
  },
  'ex-menu': d => {
    const c = getCtx(d.ctx), ei = +d.ei, e = c.exercises[ei];
    const dirty = () => { if (d.ctx === 'draft') draft.dirty = true; else save(); render(); };
    menu(ex(e.ex).name, [
      { label: '🔁 Remplacer l’exercice', fn: () => openPicker(false, ids => { e.ex = ids[0]; dirty(); }) },
      ...(ei > 0 ? [{ label: '⬆ Monter', fn: () => { c.exercises.splice(ei - 1, 0, c.exercises.splice(ei, 1)[0]); dirty(); } }] : []),
      ...(ei < c.exercises.length - 1 ? [{ label: '⬇ Descendre', fn: () => { c.exercises.splice(ei + 1, 0, c.exercises.splice(ei, 1)[0]); dirty(); } }] : []),
      { label: '🗑 Retirer l’exercice', danger: true, fn: () => { c.exercises.splice(ei, 1); dirty(); } },
    ]);
  },
  'ex-rest': d => {
    const c = getCtx(d.ctx), e = c.exercises[+d.ei], cur = e.rest ?? db.settings.rest;
    menu('Temps de repos', REST_CHOICES.map(r => ({ label: fmtRest(r), on: r === cur, fn: () => { e.rest = r; if (d.ctx === 'draft') draft.dirty = true; else save(); render(); } })));
  },
  'set-menu': d => {
    const c = getCtx(d.ctx), e = c.exercises[+d.ei], si = +d.si, s = e.sets[si];
    const done = () => { if (d.ctx === 'draft') draft.dirty = true; else save(); render(); };
    menu('Type de série', [
      ...Object.entries(SET_TYPES).map(([k, l]) => ({ label: `${k === 'n' ? '①' : SET_CODES[k]}  ${l}`, on: (s.t || 'n') === k, fn: () => { s.t = k; done(); } })),
      { label: '🗑 Supprimer la série', danger: true, fn: () => { e.sets.splice(si, 1); done(); } },
    ]);
  },
  'set-add': d => {
    const c = getCtx(d.ctx), e = c.exercises[+d.ei];
    const last = e.sets[e.sets.length - 1];
    e.sets.push(blankSet(last ? { t: last.t === 'w' ? 'n' : last.t, w: last.w, r: last.r, s: last.s, d: last.d, m: last.m } : {}));
    if (d.ctx === 'draft') draft.dirty = true; else save();
    render();
  },
  'set-done': d => toggleSet(+d.ei, +d.si),
  'use-prev': d => {
    const a = db.active, e = a.exercises[+d.ei], s = e.sets[+d.si];
    const p = lastSets(e.ex, a.start, a.editingId)[+d.si];
    if (!p) return;
    for (const f of FIELDS[ex(e.ex).type]) s[f] = p[f];
    save(); render();
  },
  'rest-adj': d => { const r = db.active.rest; r.end += +d.d * 1000; r.total = Math.max(r.total, Math.ceil((r.end - Date.now()) / 1000)); save(); renderRestBar(false); },
  'rest-skip': () => { db.active.rest = null; save(); renderRestBar(); },
  'finish': () => finishPrompt(),
  'finish-save': () => finishSave(),
  'discard': () => {
    const a = db.active;
    if (a.editingId) { confirmBox('Annuler tes modifications ?', 'Oui, annuler', () => { const id = a.editingId; db.active = null; save(); location.hash = '#/workout/' + id; }); return; }
    confirmBox('Abandonner cette séance ? Rien ne sera enregistré.', 'Abandonner', discardActive);
  },
  'measure-add': () => {
    openSheet(`<h2>Nouvelle mesure</h2>
      <label class="field">Date<input type="date" id="ms-date" value="${isoDay(Date.now())}"></label>
      ${MEASURES.map(([k, l, u]) => `<label class="field">${l} (${measureUnit(u)})<input id="ms-${k}" inputmode="decimal" placeholder="–"></label>`).join('')}
      <button class="btn primary block" data-a="measure-save">Enregistrer</button>
      <button class="btn ghost block" data-a="close-modal">Annuler</button>`);
  },
  'measure-save': () => {
    const m = { id: uid(), date: new Date($('#ms-date').value + 'T12:00').getTime() || Date.now() };
    let any = false;
    for (const [k] of MEASURES) {
      const v = k === 'weight' ? fromDisp($('#ms-' + k).value) : num($('#ms-' + k).value);
      m[k] = v;
      if (v !== '') any = true;
    }
    if (!any) { toast('Remplis au moins une mesure'); return; }
    db.measures.push(m);
    const done = checkGoals();
    newBadges();
    save(); closeModal(); render();
    if (done.length) toast(`🎯 Objectif atteint : ${goalTitle(done[0])} !`);
  },
  'measure-del': d => confirmBox('Supprimer cette mesure ?', 'Supprimer', () => { db.measures = db.measures.filter(m => m.id !== d.id); save(); render(); }),
  'accent': d => { db.settings.accent = d.v; save(); applyTheme(); render(); },
  'export': () => exportData(),
  'import': () => $('#import-file').click(),
  'share-app': () => shareApp(),
  'wipe': () => confirmBox('Effacer <b>toutes</b> tes séances, programmes et mesures ? C’est définitif (pense à exporter une sauvegarde avant).', 'Tout effacer', () => {
    const s = db.settings; db = defaults(); db.settings = s; save(); rebuildEx(); location.hash = '#/home'; render(); toast('Données effacées');
  }),
};
function shareWorkout(w) {
  const t = workoutTotals(w);
  const lines = [`💪 ${w.name} · ${fmtDate(w.start)}`, `⏱ ${fmtDur(w.end - w.start)} · 🏋️ ${fmtW(t.vol)}`, ''];
  for (const e of w.exercises) lines.push(`${ex(e.ex).name} : ${e.sets.map(s => fmtSet(s, ex(e.ex).type)).join(', ')}`);
  if (w.prs && w.prs.length) lines.push('', `🏆 ${w.prs.length} record(s) !`);
  lines.push('', 'Noté avec BobyMusc : ' + APP_URL);
  const text = lines.join('\n');
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else navigator.clipboard.writeText(text).then(() => toast('Séance copiée ✔'), () => toast('Partage impossible'));
}

if (typeof MOTIV_ACTIONS !== 'undefined') Object.assign(A, MOTIV_ACTIONS);
if (typeof TIMER_ACTIONS !== 'undefined') Object.assign(A, TIMER_ACTIONS);

/* ---------- Écouteurs ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const f = A[el.dataset.a];
  if (!f) return;
  e.preventDefault();
  f(el.dataset, el);
});
document.addEventListener('input', e => {
  const t = e.target, d = t.dataset;
  if (t.id === 'msg-in') { ui.chatDraft = t.value; autoGrow(t); return; }
  if (t.id === 'pf-bio') { $('#pf-count').textContent = `${t.value.length}/150`; return; }
  if (d.ob) {
    ob[d.ob] = d.ob === 'weight' ? fromDisp(t.value) : num(t.value);
  } else if (d.in) {
    const c = getCtx(d.ctx), s = c.exercises[+d.ei].sets[+d.si];
    s[d.in] = inStore(d.in, t.value);
    if (d.ctx === 'draft') draft.dirty = true; else { save(); updateActiveStats(); }
  } else if (d.f) {
    const c = getCtx(d.ctx);
    if (d.f === 'note') c.exercises[+d.ei].note = t.value; else c[d.f] = t.value;
    if (d.ctx === 'draft') draft.dirty = true; else save();
  } else if (d.q === 'ex') {
    ui.exQ = t.value;
    $('#ex-list').innerHTML = exList(ui.exQ, ui.exM, 'link');
  } else if (d.q === 'pk') {
    picker.q = t.value;
    refreshPicker();
  } else if (d.setting === 'name') {
    db.settings.name = t.value.trim();
    save();
  }
});
document.addEventListener('change', e => {
  const t = e.target, k = t.dataset.setting;
  if (t.id === 'import-file' && t.files[0]) { importData(t.files[0]); t.value = ''; return; }
  if (t.id === 'gl-type') { keepDraft(); goalForm(); return; }
  if (t.id === 'avatar-in' && t.files[0]) {
    const file = t.files[0];
    t.value = '';
    squareAvatar(file).then(img => {
      ui.avatarDraft = img;
      refreshAvatarPreview();
      if (!$('[data-a="avatar-rm"]')) $('.avatar-edit > div').insertAdjacentHTML('beforeend', `<button class="btn danger-ghost small" data-a="avatar-rm">Retirer</button>`);
    }).catch(() => toast('Impossible d’ouvrir cette photo'));
    return;
  }
  if ((t.id === 'photo-in' || t.id === 'photo-cam') && t.files[0]) {
    const file = t.files[0], gid = route[1];
    t.value = '';
    const caption = $('#msg-in').value.trim();
    toast('📷 Envoi de la photo…');
    compressImage(file)
      .then(img => C().sendMessage(gid, caption ? { img, text: caption } : { img }))
      .then(() => { if (caption) { $('#msg-in').value = ''; ui.chatDraft = ''; } })
      .catch(err => toast(err.code ? C().errMsg(err) : 'Impossible d’envoyer cette photo'));
    return;
  }
  if (t.dataset.cloud === 'share') {
    C().setPrivate(!t.checked).then(() => toast(t.checked ? 'Tes amis voient tes séances ✔' : '🔒 Tes séances sont maintenant privées'))
      .catch(err => { toast(C().errMsg(err)); t.checked = !t.checked; });
    return;
  }
  if (t.id === 'set-pseudo') {
    const name = t.value.trim();
    if (name.length < 2) { toast('Pseudo trop court'); return; }
    C().rename(name).then(() => toast('Pseudo changé ✔'), err => toast(C().errMsg(err)));
    return;
  }
  if (!k || k === 'name') return;
  if (t.type === 'checkbox') db.settings[k] = t.checked;
  else if (k === 'height' || k === 'age') {
    const v = num(t.value);
    db.settings[k] = v === '' ? null : Math.round(v);
    if (k === 'age') db.settings.ageYear = new Date().getFullYear();
  } else db.settings[k] = ['rest', 'defSets', 'textSize'].includes(k) ? +t.value : t.value;
  save();
  if (k === 'theme' || k === 'textSize') applyTheme();
  if (k === 'sound') { unlockAudio(); playSound(t.value); }
  if (k === 'wakelock' && !t.checked) releaseWake();
});
// Sélectionner le contenu d'une case quand on la touche (plus rapide pour corriger)
document.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('in')) e.target.select(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { tick(); if (route[0] === 'active') keepAwake(); }
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (db.settings.theme === 'auto') applyTheme(); });
window.addEventListener('hashchange', () => {
  closeModal();
  A['demo-close']();
  render();
  if (afterNav) { const f = afterNav; afterNav = null; f(); }
});

/* ---------- Partie en ligne ---------- */
window.addEventListener('cloud-change', () => {
  if (!db.settings.onboarded) return;
  updateNavBadge();
  refreshIfVisible();
});
window.addEventListener('cloud-login', () => syncOnLogin());
function loadCloud() {
  import('./cloud.js').catch(e => { console.warn('cloud', e); cloudFailed = true; refreshIfVisible(); });
}

/* ---------- Démarrage ---------- */
load();
rebuildEx();
// Badges déjà mérités avant cette version : comptés comme « vus » (pas de pluie de badges)
try {
  if (!db.badgesSeen && db.settings.onboarded) { db.badgesSeen = badgesState().filter(b => b.ok).map(b => b.id); save(); }
} catch (e) { if (window.__report) window.__report('badges au démarrage : ' + e.message, e.stack); }
if (!db.badgesSeen) db.badgesSeen = [];
applyTheme();
render();
setInterval(tick, 500);
if (typeof timerTick === 'function') { setInterval(timerTick, 250); if (tmRunning()) tmKeepAwake(true); }
loadCloud();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
