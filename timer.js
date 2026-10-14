'use strict';
/* BobyMusc — onglet Minuteur : compte à rebours, chrono avec tours, intervalles (HIIT / Tabata).
   Chargé avant app.js. Le temps est calculé à partir de l'heure réelle : il reste juste même si on change de page. */

const TM_KEY = 'bobymusc-timer';
const tmDefaults = () => ({
  mode: 'count',
  count: { dur: 90, end: null, left: 90000, running: false },
  chrono: { start: null, acc: 0, running: false, laps: [] },
  hiit: { work: 20, rest: 10, rounds: 8, start: null, acc: 0, running: false, phaseKey: '', beeped: '' },
});
let tm = (() => {
  try { return { ...tmDefaults(), ...JSON.parse(localStorage.getItem(TM_KEY) || '{}') }; } catch (e) { return tmDefaults(); }
})();
const tmSave = () => { try { localStorage.setItem(TM_KEY, JSON.stringify(tm)); } catch (e) { /* ignore */ } };
const HIIT_PREP = 5; // secondes pour se mettre en place

/* ---------- Calculs ---------- */
const countLeft = () => tm.count.running ? Math.max(0, tm.count.end - Date.now()) : tm.count.left;
const chronoElapsed = () => tm.chrono.acc + (tm.chrono.running ? Date.now() - tm.chrono.start : 0);
const hiitElapsed = () => tm.hiit.acc + (tm.hiit.running ? Date.now() - tm.hiit.start : 0);
const hiitTotal = h => (HIIT_PREP + h.rounds * (h.work + h.rest) - h.rest) * 1000;
// Où en est-on dans les intervalles ? (phase, tour, temps restant de la phase)
function hiitPhase(ms) {
  const h = tm.hiit;
  let t = ms / 1000;
  if (t < HIIT_PREP) return { key: 'prep', name: 'Prépare-toi', round: 0, left: HIIT_PREP - t, len: HIIT_PREP };
  t -= HIIT_PREP;
  for (let r = 1; r <= h.rounds; r++) {
    if (t < h.work) return { key: 'w' + r, name: 'Effort', round: r, left: h.work - t, len: h.work, work: true };
    t -= h.work;
    if (r === h.rounds) break;
    if (t < h.rest) return { key: 'r' + r, name: 'Repos', round: r, left: h.rest - t, len: h.rest };
    t -= h.rest;
  }
  return { key: 'done', name: 'Terminé ! 💪', round: h.rounds, left: 0, len: 1, done: true };
}
const clockS = ms => fmtClock(Math.ceil(ms / 1000) * 1000);
const tmRunning = () => tm.count.running || tm.chrono.running || tm.hiit.running;

/* ---------- Affichage ---------- */
function ring(frac, label, sub = '', cls = '') {
  const R = 118, C = 2 * Math.PI * R;
  return `<div class="tm-ring ${cls}"><svg viewBox="0 0 260 260">
      <circle cx="130" cy="130" r="${R}" class="tm-track"/>
      <circle cx="130" cy="130" r="${R}" class="tm-prog" id="tm-prog" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - Math.max(0, Math.min(1, frac)))}"/>
    </svg><div class="tm-center"><div class="tm-sub" id="tm-sub">${sub}</div><div class="tm-time" id="tm-time">${label}</div></div></div>`;
}
function vTimer() {
  const mode = tm.mode;
  let body = '';
  if (mode === 'count') {
    const c = tm.count, left = countLeft();
    body = `${ring(left / (c.dur * 1000), clockS(left), c.running ? 'En cours' : left < c.dur * 1000 && left > 0 ? 'En pause' : 'Compte à rebours')}
      <div class="tm-adjust">${[[-60, '−1 min'], [-10, '−10 s'], [10, '+10 s'], [60, '+1 min']].map(([d, l]) => `<button class="btn ghost small" data-a="tm-adj" data-d="${d}">${l}</button>`).join('')}</div>
      <div class="chips wrap tm-presets">${[30, 45, 60, 90, 120, 180, 300, 600].map(s => `<button class="chip ${c.dur === s ? 'on' : ''}" data-a="tm-preset" data-v="${s}">${fmtSec(s)}</button>`).join('')}</div>
      <div class="tm-main">${c.running
        ? `<button class="btn ghost big" data-a="tm-reset">↺ Remettre</button><button class="btn primary big" data-a="tm-pause">⏸ Pause</button>`
        : `<button class="btn ghost big" data-a="tm-reset">↺ Remettre</button><button class="btn primary big" data-a="tm-start">▶ ${left < c.dur * 1000 && left > 0 ? 'Reprendre' : 'Démarrer'}</button>`}</div>`;
  } else if (mode === 'chrono') {
    const c = tm.chrono, el = chronoElapsed();
    const laps = c.laps.map((t, i) => ({ i: i + 1, t, d: t - (c.laps[i - 1] || 0) })).reverse();
    body = `${ring((el % 60000) / 60000, fmtClock(el), c.running ? 'Chrono' : el ? 'En pause' : 'Chrono', 'chrono')}
      <div class="tm-main">${c.running
        ? `<button class="btn ghost big" data-a="tm-lap">⚑ Tour</button><button class="btn primary big" data-a="tm-pause">⏸ Pause</button>`
        : `<button class="btn ghost big" data-a="tm-reset" ${el ? '' : 'disabled'}>↺ Remettre</button><button class="btn primary big" data-a="tm-start">▶ ${el ? 'Reprendre' : 'Démarrer'}</button>`}</div>
      ${laps.length ? `<div class="card records tm-laps">${laps.map(l => `<div class="rec"><span>Tour ${l.i}</span><span class="muted">+${fmtClock(l.d)}</span><b>${fmtClock(l.t)}</b></div>`).join('')}</div>` : ''}`;
  } else {
    const h = tm.hiit, el = hiitElapsed(), ph = hiitPhase(el);
    const started = el > 0;
    const step = (k, l, unit, min, max) => `<div class="tm-step"><span>${l}</span><div><button class="ob-adj sm" data-a="tm-hiit" data-k="${k}" data-d="-1" ${started ? 'disabled' : ''}>−</button>
      <b>${h[k]}${unit}</b><button class="ob-adj sm" data-a="tm-hiit" data-k="${k}" data-d="1" ${started ? 'disabled' : ''}>+</button></div></div>`;
    body = `${ring(started ? ph.left / ph.len : 1, started ? clockS(ph.left * 1000) : fmtClock(hiitTotal(h)), started ? `${ph.name}${ph.round && !ph.done ? ` · tour ${ph.round}/${h.rounds}` : ''}` : 'Durée totale', started ? (ph.work ? 'work' : ph.done ? '' : 'rest') : '')}
      ${started ? '' : `<div class="card form tm-steps">${step('work', 'Effort', ' s')}${step('rest', 'Repos', ' s')}${step('rounds', 'Tours', '')}</div>
        <div class="chips wrap tm-presets">${[['Tabata', 20, 10, 8], ['HIIT 40/20', 40, 20, 8], ['EMOM 10 min', 60, 0, 10], ['30/30', 30, 30, 10]].map(([n, w, r, k]) => `<button class="chip" data-a="tm-hiit-preset" data-w="${w}" data-r="${r}" data-k="${k}">${n}</button>`).join('')}</div>`}
      <div class="tm-main">${h.running
        ? `<button class="btn ghost big" data-a="tm-reset">⏹ Arrêter</button><button class="btn primary big" data-a="tm-pause">⏸ Pause</button>`
        : `<button class="btn ghost big" data-a="tm-reset" ${started ? '' : 'disabled'}>↺ Remettre</button><button class="btn primary big" data-a="tm-start">▶ ${started && !ph.done ? 'Reprendre' : 'Démarrer'}</button>`}</div>`;
  }
  return {
    title: 'Minuteur',
    html: `${chips([['count', '⏳ Rebours'], ['chrono', '⏱ Chrono'], ['hiit', '🔁 Intervalles']], mode, 'tm-mode')}
      <div class="tm-body">${body}</div>
      <p class="muted small center">Le son et la vibration suivent tes réglages (Profil → Réglages → Minuteur de repos). L’écran reste allumé pendant que le minuteur tourne.</p>`,
  };
}

/* ---------- Boucle (mise à jour de l'écran + alarmes) ---------- */
let tmWake = null;
async function tmKeepAwake(on) {
  try {
    if (on && !tmWake && 'wakeLock' in navigator) { tmWake = await navigator.wakeLock.request('screen'); tmWake.addEventListener('release', () => { tmWake = null; }); }
    if (!on && tmWake) { tmWake.release(); tmWake = null; }
  } catch (e) { /* refusé */ }
}
function tmAlarm(text) {
  playSound(db.settings.sound === 'none' ? 'none' : db.settings.sound);
  if (db.settings.vibrate && navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 500]);
  toast(text);
}
function timerTick() {
  let changed = false;
  if (tm.count.running) {
    const left = countLeft();
    if (db.settings.warn10 && tm.count.dur > 15 && !tm.count.warned && left <= 10000) {
      tm.count.warned = true;
      if (db.settings.sound !== 'none') beep(0, 660, 0.15, 'sine', 0.25);
    }
    if (left <= 0) {
      tm.count.running = false; tm.count.left = tm.count.dur * 1000; tm.count.warned = false;
      tmSave(); tmAlarm('⏳ Temps écoulé !'); changed = true;
    }
  }
  if (tm.hiit.running) {
    const h = tm.hiit, ph = hiitPhase(hiitElapsed());
    if (ph.key !== h.phaseKey) {
      // Changement de phase : bip long (effort = aigu, repos = grave)
      if (h.phaseKey) {
        if (ph.done) tmAlarm('🔁 Intervalles terminés, bravo ! 💪');
        else if (db.settings.sound !== 'none') { beep(0, ph.work ? 1175 : 523, 0.5, 'sine', 0.45); }
        if (!ph.done && db.settings.vibrate && navigator.vibrate) navigator.vibrate(ph.work ? [200, 80, 200] : 400);
      }
      h.phaseKey = ph.key; changed = true;
      if (ph.done) { h.running = false; h.acc = hiitTotal(h); }
      tmSave();
    }
    // Petits bips 3, 2, 1 avant chaque changement
    const sec = Math.ceil(ph.left);
    if (!ph.done && sec <= 3 && sec >= 1 && h.beeped !== ph.key + sec && ph.len > 4) {
      h.beeped = ph.key + sec;
      if (db.settings.sound !== 'none') beep(0, 880, 0.12, 'sine', 0.3);
    }
  }
  if (route[0] === 'timer') {
    if (changed) { render(); return; }
    tmPaint();
  }
  tmNavLabel();
  if (!tmRunning()) tmKeepAwake(false);
}
// Met à jour seulement l'heure et l'anneau (pas toute la page)
function tmPaint() {
  const time = $('#tm-time'), prog = $('#tm-prog'), sub = $('#tm-sub');
  if (!time || !prog) return;
  const C = 2 * Math.PI * 118;
  let frac = 1, label = '', subText = null;
  if (tm.mode === 'count') { const l = countLeft(); frac = l / (tm.count.dur * 1000); label = clockS(l); }
  else if (tm.mode === 'chrono') { const e = chronoElapsed(); frac = (e % 60000) / 60000; label = fmtClock(e); }
  else {
    const e = hiitElapsed();
    if (!e) return;
    const ph = hiitPhase(e);
    frac = ph.left / ph.len; label = clockS(ph.left * 1000);
    subText = `${ph.name}${ph.round && !ph.done ? ` · tour ${ph.round}/${tm.hiit.rounds}` : ''}`;
    const ringEl = time.closest('.tm-ring');
    ringEl.classList.toggle('work', !!ph.work);
    ringEl.classList.toggle('rest', !ph.work && !ph.done);
  }
  time.textContent = label;
  prog.style.strokeDashoffset = C * (1 - Math.max(0, Math.min(1, frac)));
  if (subText !== null && sub) sub.textContent = subText;
}
// L'onglet du bas affiche le temps quand le minuteur tourne
function tmNavLabel() {
  const lab = $('#nav-timer-label');
  if (!lab) return;
  let txt = 'Minuteur';
  if (tm.count.running) txt = clockS(countLeft());
  else if (tm.hiit.running) txt = clockS(hiitPhase(hiitElapsed()).left * 1000);
  else if (tm.chrono.running) txt = fmtClock(chronoElapsed());
  if (lab.textContent !== txt) lab.textContent = txt;
  lab.parentElement.classList.toggle('ticking', txt !== 'Minuteur');
}

/* ---------- Actions ---------- */
const TIMER_ACTIONS = {
  'tm-mode': d => { tm.mode = d.v; tmSave(); render(); },
  'tm-preset': d => {
    const c = tm.count;
    c.dur = +d.v; c.left = c.dur * 1000; c.warned = false;
    if (c.running) c.end = Date.now() + c.left;
    tmSave(); render();
  },
  'tm-adj': d => {
    const c = tm.count;
    const left = Math.max(5000, countLeft() + +d.d * 1000);
    if (!c.running) c.dur = Math.max(5, Math.round(left / 1000));
    else c.dur = Math.max(c.dur, Math.ceil(left / 1000));
    if (c.running) c.end = Date.now() + left; else c.left = left;
    tmSave(); render();
  },
  'tm-start': () => {
    unlockAudio();
    const now = Date.now();
    if (tm.mode === 'count') {
      const c = tm.count;
      if (c.left <= 0) c.left = c.dur * 1000;
      c.end = now + c.left; c.running = true; c.warned = c.left <= 10000;
    } else if (tm.mode === 'chrono') {
      tm.chrono.start = now; tm.chrono.running = true;
    } else {
      const h = tm.hiit;
      if (hiitPhase(h.acc).done) { h.acc = 0; h.phaseKey = ''; }
      h.start = now; h.running = true;
    }
    tmSave(); tmKeepAwake(true); render();
  },
  'tm-pause': () => {
    const now = Date.now();
    if (tm.mode === 'count') { tm.count.left = Math.max(0, tm.count.end - now); tm.count.running = false; }
    else if (tm.mode === 'chrono') { tm.chrono.acc += now - tm.chrono.start; tm.chrono.running = false; }
    else { tm.hiit.acc += now - tm.hiit.start; tm.hiit.running = false; }
    tmSave(); render();
  },
  'tm-reset': () => {
    if (tm.mode === 'count') Object.assign(tm.count, { running: false, end: null, left: tm.count.dur * 1000, warned: false });
    else if (tm.mode === 'chrono') Object.assign(tm.chrono, { running: false, start: null, acc: 0, laps: [] });
    else Object.assign(tm.hiit, { running: false, start: null, acc: 0, phaseKey: '', beeped: '' });
    tmSave(); render();
  },
  'tm-lap': () => { tm.chrono.laps.push(chronoElapsed()); tmSave(); render(); },
  'tm-hiit': d => {
    const h = tm.hiit, k = d.k, dir = +d.d;
    const step = k === 'rounds' ? 1 : 5, min = k === 'rest' ? 0 : k === 'rounds' ? 1 : 5, max = k === 'rounds' ? 50 : 600;
    h[k] = Math.min(max, Math.max(min, h[k] + dir * step));
    tmSave(); render();
  },
  'tm-hiit-preset': d => { Object.assign(tm.hiit, { work: +d.w, rest: +d.r, rounds: +d.k }); tmSave(); render(); },
};
