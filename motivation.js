'use strict';
/* BobyMusc — motivation : série de semaines, objectifs, badges, bilan du mois, carte des muscles,
   et profil (photo + bio). Chargé avant app.js ; les fonctions utilisent les outils d'app.js
   (db, ex, workoutTotals, fmtW…) seulement quand elles sont appelées. */

/* ---------- Série de semaines 🔥 ---------- */
const prevWeek = ws => weekStart(ws - 1);
function streakInfo(workouts = db.workouts) {
  const weeks = new Set(workouts.map(w => weekStart(w.start)));
  const cur = weekStart(Date.now());
  const thisWeek = weeks.has(cur);
  // La semaine en cours ne casse pas la série tant qu'elle n'est pas finie
  let k = thisWeek ? cur : prevWeek(cur), n = 0;
  while (weeks.has(k)) { n++; k = prevWeek(k); }
  let best = 0, run = 0, last = null;
  for (const w of [...weeks].sort((a, b) => a - b)) {
    run = last !== null && prevWeek(w) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = w;
  }
  return { cur: n, best, thisWeek };
}
const streakLabel = n => `${n} semaine${n > 1 ? 's' : ''}`;

/* ---------- Carte des muscles ---------- */
function muscleCounts(days, workouts = db.workouts) {
  const since = Date.now() - days * DAY, mus = {};
  for (const w of workouts) if (w.start >= since) for (const e of w.exercises) {
    const m = exMuscle(e);
    mus[m] = (mus[m] || 0) + e.sets.filter(s => s.t !== 'w').length;
  }
  return mus;
}
// Silhouette face + dos : [muscle ou null (partie neutre), forme SVG]
const BODY = (() => {
  const E = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
  const Ci = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
  const R = (x, y, w, h, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
  const P = d => `<path d="${d}"/>`;
  const front = [
    [null, Ci(100, 30, 18)], [null, R(93, 46, 14, 12, 4)],
    ['Trapèzes', P('M84 60 L93 54 L107 54 L116 60 L108 65 L92 65Z')],
    ['Épaules', E(70, 74, 15, 14)], ['Épaules', E(130, 74, 15, 14)],
    ['Pectoraux', P('M99 64 L99 104 Q88 110 76 102 Q72 86 80 70 Q90 63 99 64Z')],
    ['Pectoraux', P('M101 64 L101 104 Q112 110 124 102 Q128 86 120 70 Q110 63 101 64Z')],
    ['Biceps', E(63, 108, 9, 20)], ['Biceps', E(137, 108, 9, 20)],
    ['Avant-bras', E(58, 152, 8, 22)], ['Avant-bras', E(142, 152, 8, 22)],
    [null, Ci(56, 182, 7)], [null, Ci(144, 182, 7)],
    ['Abdos', R(88, 108, 24, 62, 8)],
    ['Abdos', P('M78 108 L86 110 L86 168 L80 160 Q76 134 78 108Z')],
    ['Abdos', P('M122 108 L114 110 L114 168 L120 160 Q124 134 122 108Z')],
    [null, P('M80 172 L120 172 L116 192 L100 198 L84 192Z')],
    ['Quadriceps', E(86, 236, 13, 40)], ['Quadriceps', E(114, 236, 13, 40)],
    ['Adducteurs', E(97, 214, 4, 18)], ['Adducteurs', E(103, 214, 4, 18)],
    [null, Ci(86, 282, 7)], [null, Ci(114, 282, 7)],
    ['Mollets', E(86, 318, 9, 28)], ['Mollets', E(114, 318, 9, 28)],
    [null, E(86, 352, 9, 5)], [null, E(114, 352, 9, 5)],
  ];
  const back = [
    [null, Ci(300, 30, 18)], [null, R(293, 46, 14, 12, 4)],
    ['Trapèzes', P('M282 56 L293 50 L307 50 L318 56 L312 82 L300 92 L288 82Z')],
    ['Épaules', E(270, 74, 15, 14)], ['Épaules', E(330, 74, 15, 14)],
    ['Dos', P('M286 84 L298 96 L298 140 Q288 142 280 132 Q274 110 278 86Z')],
    ['Dos', P('M314 84 L302 96 L302 140 Q312 142 320 132 Q326 110 322 86Z')],
    ['Triceps', E(263, 108, 9, 20)], ['Triceps', E(337, 108, 9, 20)],
    ['Avant-bras', E(258, 152, 8, 22)], ['Avant-bras', E(342, 152, 8, 22)],
    [null, Ci(256, 182, 7)], [null, Ci(344, 182, 7)],
    ['Lombaires', R(288, 143, 24, 26, 6)],
    ['Fessiers', E(290, 188, 12, 15)], ['Fessiers', E(310, 188, 12, 15)],
    ['Ischios', E(286, 240, 12, 36)], ['Ischios', E(314, 240, 12, 36)],
    [null, Ci(286, 282, 7)], [null, Ci(314, 282, 7)],
    ['Mollets', E(286, 314, 11, 26)], ['Mollets', E(314, 314, 11, 26)],
    [null, E(286, 352, 9, 5)], [null, E(314, 352, 9, 5)],
  ];
  return [...front, ...back];
})();
function muscleLevel(n, days) {
  const k = days > 7 ? 3 : 1; // sur 30 jours il faut plus de séries pour « chauffer »
  return !n ? 0 : n <= 3 * k ? 1 : n <= 6 * k ? 2 : n <= 10 * k ? 3 : 4;
}
const LEVEL_FILL = ['var(--card2)', 'color-mix(in srgb, var(--accent) 35%, var(--card2))',
  'color-mix(in srgb, var(--accent) 58%, var(--card2))', 'color-mix(in srgb, var(--accent) 80%, var(--card2))', 'var(--accent)'];
function muscleMap(counts, days) {
  const parts = BODY.map(([m, shape]) => {
    const fill = m ? LEVEL_FILL[muscleLevel(counts[m] || 0, days)] : 'var(--line)';
    return shape.replace('/>', ` style="fill:${fill}"${m ? ` data-m="${esc(m)}"` : ''}><title>${m ? esc(m) + ' : ' + (counts[m] || 0) + ' séries' : ''}</title></${shape.match(/^<(\w+)/)[1]}>`);
  }).join('');
  return `<svg viewBox="0 0 400 372" class="body-map" role="img" aria-label="Carte des muscles travaillés">${parts}
    <text x="100" y="370" text-anchor="middle" class="lbl">Face</text><text x="300" y="370" text-anchor="middle" class="lbl">Dos</text></svg>
    <div class="map-legend"><span>Moins</span>${LEVEL_FILL.map(f => `<i style="background:${f}"></i>`).join('')}<span>Plus</span></div>`;
}
function muscleCard(workouts, title = 'Carte des muscles') {
  const days = ui.mapDays || 7;
  const counts = muscleCounts(days, workouts);
  const list = Object.entries(counts).filter(([m]) => m !== 'Cardio').sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...list.map(m => m[1]));
  return `<div class="card"><div class="card-title">${title}</div>
    ${chips([[7, '7 jours'], [30, '30 jours']].map(([v, l]) => [String(v), l]), String(days), 'map-days')}
    ${muscleMap(counts, days)}
    ${list.length ? list.map(([m, n]) => `<div class="mbar"><span>${esc(m)}</span><div class="mbar-track"><div class="mbar-fill" style="width:${n / max * 100}%"></div></div><b>${n}</b></div>`).join('')
      : `<div class="empty small">Aucune série ces ${days} derniers jours.</div>`}
    <div class="muted small">Nombre de séries par muscle (hors échauffement).</div></div>`;
}

/* ---------- Badges 🏅 ---------- */
function badgeCtx() {
  const ws = db.workouts;
  let vol = 0, prs = 0, maxW = 0, early = false, night = false, sunday = false, long = false;
  const weekMuscles = {};
  for (const w of ws) {
    const t = workoutTotals(w);
    vol += t.vol; prs += (w.prs || []).length;
    const d = new Date(w.start), h = d.getHours();
    if (h < 7) early = true;
    if (h >= 22) night = true;
    if (d.getDay() === 0) sunday = true;
    if (w.end - w.start >= 2 * 3600000) long = true;
    const wk = weekStart(w.start);
    weekMuscles[wk] = weekMuscles[wk] || new Set();
    for (const e of w.exercises) {
      if (!['Cardio', 'Corps entier'].includes(exMuscle(e))) weekMuscles[wk].add(exMuscle(e));
      if (exType(e) === 'wr') for (const s of e.sets) if (s.t !== 'w') maxW = Math.max(maxW, +s.w || 0);
    }
  }
  const varied = Math.max(0, ...Object.values(weekMuscles).map(s => s.size));
  return { n: ws.length, vol, prs, maxW, early, night, sunday, long, varied, streak: streakInfo().best, goals: (db.goals || []).filter(g => g.doneAt).length };
}
const BADGES = [
  ['first', '🎉', 'Première séance', 'Enregistrer ta 1re séance', c => [c.n, 1]],
  ['s10', '🥉', 'Habitué', '10 séances', c => [c.n, 10]],
  ['s25', '🥈', 'Régulier', '25 séances', c => [c.n, 25]],
  ['s50', '🥇', 'Acharné', '50 séances', c => [c.n, 50]],
  ['s100', '🏆', 'Centurion', '100 séances', c => [c.n, 100]],
  ['s250', '👑', 'Légende', '250 séances', c => [c.n, 250]],
  ['v1', '🧱', 'Une tonne', 'Soulever 1 000 kg au total', c => [c.vol, 1000]],
  ['v10', '🚚', 'Déménageur', '10 tonnes au total', c => [c.vol, 10000]],
  ['v50', '🚂', 'Locomotive', '50 tonnes au total', c => [c.vol, 50000]],
  ['v100', '🚀', 'Fusée', '100 tonnes au total', c => [c.vol, 100000]],
  ['v500', '🌋', 'Volcan', '500 tonnes au total', c => [c.vol, 500000]],
  ['pr1', '⭐', 'Premier record', 'Battre un record perso', c => [c.prs, 1]],
  ['pr10', '🌟', 'Chasseur de records', '10 records battus', c => [c.prs, 10]],
  ['pr50', '💫', 'Machine à records', '50 records battus', c => [c.prs, 50]],
  ['st4', '🔥', 'Sur la lancée', '4 semaines d’affilée', c => [c.streak, 4]],
  ['st12', '⚡', 'Inarrêtable', '12 semaines d’affilée', c => [c.streak, 12]],
  ['st26', '💎', 'Diamant', '26 semaines d’affilée', c => [c.streak, 26]],
  ['st52', '🏅', 'Une année entière', '52 semaines d’affilée', c => [c.streak, 52]],
  ['kg60', '💪', 'Costaud', 'Soulever 60 kg sur un exercice', c => [c.maxW, 60]],
  ['kg100', '🦍', 'Club des 100', 'Soulever 100 kg sur un exercice', c => [c.maxW, 100]],
  ['kg140', '🐻', 'Ours', 'Soulever 140 kg sur un exercice', c => [c.maxW, 140]],
  ['varied', '🧩', 'Corps complet', 'Travailler 8 muscles dans la même semaine', c => [c.varied, 8]],
  ['early', '🌅', 'Lève-tôt', 'Une séance avant 7 h', c => [+c.early, 1]],
  ['night', '🦉', 'Oiseau de nuit', 'Une séance après 22 h', c => [+c.night, 1]],
  ['sunday', '📅', 'Même le dimanche', 'Une séance un dimanche', c => [+c.sunday, 1]],
  ['long', '⏳', 'Marathonien', 'Une séance de plus de 2 h', c => [+c.long, 1]],
  ['goal', '🎯', 'Objectif atteint', 'Atteindre un de tes objectifs', c => [c.goals, 1]],
].map(([id, icon, name, desc, prog]) => ({ id, icon, name, desc, prog }));
function badgesState() {
  const c = badgeCtx();
  return BADGES.map(b => { const [cur, max] = b.prog(c); return { ...b, cur: Math.min(cur, max), max, ok: cur >= max }; });
}
// Badges débloqués depuis la dernière fois (pour les fêter)
function newBadges() {
  const ok = badgesState().filter(b => b.ok);
  if (!db.badgesSeen) { db.badgesSeen = ok.map(b => b.id); return []; } // 1re fois : pas de pluie de badges
  const fresh = ok.filter(b => !db.badgesSeen.includes(b.id));
  db.badgesSeen.push(...fresh.map(b => b.id));
  return fresh;
}
function vBadges() {
  const list = badgesState();
  const n = list.filter(b => b.ok).length;
  const fmtProg = b => b.id.startsWith('v') ? `${fmtN(Math.floor(b.cur / 1000))} / ${fmtN(b.max / 1000)} t` : b.id.startsWith('kg') ? `${fmtW(b.cur)} / ${fmtW(b.max)}` : `${fmtN(b.cur)} / ${fmtN(b.max)}`;
  return {
    title: 'Badges', back: '#/profile',
    html: `<div class="card center"><div class="big-emoji">🏅</div><h2>${n} / ${list.length} badges</h2>
        <div class="mbar-track big-track"><div class="mbar-fill" style="width:${n / list.length * 100}%"></div></div></div>
      <div class="badge-grid">${list.map(b => `<div class="badge-tile ${b.ok ? 'ok' : ''}">
        <div class="b-icon">${b.icon}</div><b>${esc(b.name)}</b><span class="muted small">${esc(b.desc)}</span>
        ${b.ok ? '<span class="b-done">Débloqué ✔</span>' : `<div class="mbar-track"><div class="mbar-fill" style="width:${b.cur / b.max * 100}%"></div></div><span class="muted small">${fmtProg(b)}</span>`}
      </div>`).join('')}</div>`,
  };
}

/* ---------- Objectifs 🎯 ---------- */
const GOAL_TYPES = { lift: 'Soulever un poids', sessions: 'Faire un nombre de séances', bodyweight: 'Atteindre un poids du corps' };
function goalProgress(g) {
  if (g.type === 'lift') {
    let best = 0;
    for (const w of db.workouts) for (const e of w.exercises) if (e.ex === g.ex) for (const s of e.sets) if (s.t !== 'w') best = Math.max(best, +s.w || 0);
    return { cur: best, pct: best / g.target, text: `${fmtW(best)} / ${fmtW(g.target)}` };
  }
  if (g.type === 'sessions') {
    const n = db.workouts.filter(w => w.start >= g.createdAt).length;
    return { cur: n, pct: n / g.target, text: `${n} / ${g.target} séances` };
  }
  const w = lastWeight();
  if (!w || g.start == null) return { cur: 0, pct: 0, text: 'Ajoute ton poids dans Mesures' };
  const pct = g.start === g.target ? 1 : (g.start - w) / (g.start - g.target);
  return { cur: w, pct: Math.max(0, pct), text: `${fmtW(w)} → objectif ${fmtW(g.target)}` };
}
function goalTitle(g) {
  if (g.type === 'lift') return `${fmtW(g.target)} à ${ex(g.ex).name}`;
  if (g.type === 'sessions') return `${g.target} séances`;
  return `Peser ${fmtW(g.target)}`;
}
function goalDeadline(g) {
  if (!g.deadline || g.doneAt) return '';
  const days = Math.ceil((g.deadline - Date.now()) / DAY);
  return days >= 0 ? `J-${days}` : 'Date dépassée';
}
// Vérifie les objectifs (après une séance ou une mesure) ; renvoie ceux qui viennent d'être atteints
function checkGoals() {
  const done = [];
  for (const g of db.goals || []) if (!g.doneAt && goalProgress(g).pct >= 1) { g.doneAt = Date.now(); done.push(g); }
  return done;
}
function goalRow(g) {
  const p = goalProgress(g), pct = Math.min(1, p.pct);
  return `<div class="goal ${g.doneAt ? 'done' : ''}">
    <div class="row-between"><b>${g.doneAt ? '✅' : '🎯'} ${esc(goalTitle(g))}</b>
      <span class="muted small">${g.doneAt ? 'Atteint le ' + fmtDate(g.doneAt) : goalDeadline(g)}</span></div>
    <div class="mbar-track"><div class="mbar-fill" style="width:${pct * 100}%"></div></div>
    <div class="row-between muted small"><span>${esc(p.text)}</span><span>${Math.round(pct * 100)} %</span></div>
  </div>`;
}
function vGoals() {
  const gs = [...(db.goals || [])];
  const active = gs.filter(g => !g.doneAt), done = gs.filter(g => g.doneAt).sort((a, b) => b.doneAt - a.doneAt);
  const row = g => `<div class="card goal-card">${goalRow(g)}<button class="icon" data-a="goal-del" data-id="${g.id}" aria-label="Supprimer">🗑</button></div>`;
  return {
    title: 'Objectifs', back: '#/profile',
    actions: `<button class="btn primary small" data-a="goal-new">＋ Nouveau</button>`,
    html: `${active.length ? active.map(row).join('') : `<div class="empty">Aucun objectif en cours.<br>Fixe-toi un but : 100 kg au développé couché, 20 séances, perdre 3 kg…</div>`}
      ${done.length ? `<h2 class="section">Atteints 🎉</h2>${done.map(row).join('')}` : ''}`,
  };
}
function goalForm() {
  const g = ui.goalDraft;
  openSheet(`<h2>Nouvel objectif</h2>
    <label class="field">Type d’objectif<select id="gl-type" data-a2="goal-type">${Object.entries(GOAL_TYPES).map(([k, l]) => `<option value="${k}" ${g.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    ${g.type === 'lift' ? `<div class="field">Exercice<button class="btn ghost block" data-a="goal-ex">${g.ex ? esc(ex(g.ex).name) : 'Choisir l’exercice…'}</button></div>` : ''}
    <label class="field">${g.type === 'lift' ? `Poids à soulever (${U()})` : g.type === 'sessions' ? 'Nombre de séances (à partir d’aujourd’hui)' : `Poids du corps visé (${U()})`}
      <input id="gl-target" inputmode="decimal" value="${esc(g.target ?? '')}" placeholder="${g.type === 'sessions' ? '20' : g.type === 'lift' ? '100' : '75'}"></label>
    <label class="field">Date limite (facultatif)<input type="date" id="gl-date" value="${esc(g.date || '')}"></label>
    <button class="btn primary block" data-a="goal-save">Créer l’objectif</button>
    <button class="btn ghost block" data-a="close-modal">Annuler</button>`);
}

/* ---------- Bilan du mois 📊 ---------- */
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthKey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; };
function monthStats(key) {
  const [y, m] = key.split('-').map(Number);
  const from = new Date(y, m - 1, 1).getTime(), to = new Date(y, m, 1).getTime();
  const ws = db.workouts.filter(w => w.start >= from && w.start < to);
  const exSets = {}, mus = {};
  let vol = 0, dur = 0, prs = 0, sets = 0;
  for (const w of ws) {
    const t = workoutTotals(w);
    vol += t.vol; dur += w.end - w.start; prs += (w.prs || []).length; sets += t.sets;
    for (const e of w.exercises) {
      exSets[e.ex] = (exSets[e.ex] || 0) + e.sets.length;
      const mm = exMuscle(e);
      if (mm !== 'Cardio') mus[mm] = (mus[mm] || 0) + e.sets.length;
    }
  }
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0];
  const topEx = top(exSets), topMus = top(mus);
  return {
    key, y, m, label: `${MONTHS[m - 1]} ${y}`, ws, n: ws.length, vol, dur, prs, sets,
    days: new Set(ws.map(w => isoDay(w.start))).size,
    topEx: topEx ? ex(topEx[0]).name : null, topMus: topMus ? topMus[0] : null,
    longest: ws.reduce((a, w) => Math.max(a, w.end - w.start), 0),
  };
}
const shiftMonth = (key, d) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 1 + d, 1).getTime()); };
function pctDiff(a, b) {
  if (!b) return '';
  const p = Math.round((a - b) / b * 100);
  return `<span class="diff ${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p)} %</span>`;
}
function vRecap(key) {
  key = key || monthKey(Date.now());
  const s = monthStats(key), p = monthStats(shiftMonth(key, -1));
  const isNow = key === monthKey(Date.now());
  const cap = s.label.charAt(0).toUpperCase() + s.label.slice(1);
  return {
    title: 'Bilan du mois', back: '#/profile',
    html: `<div class="row-between cal-head"><button class="icon" data-a="recap-nav" data-k="${shiftMonth(key, -1)}" aria-label="Mois précédent">‹</button>
        <h2>${cap}</h2>
        <button class="icon" data-a="recap-nav" data-k="${shiftMonth(key, 1)}" ${isNow ? 'disabled' : ''} aria-label="Mois suivant">›</button></div>
      ${s.n ? `<div class="recap-grid">
          <div class="card"><div class="stat-l">Séances</div><div class="recap-v">${s.n}</div>${pctDiff(s.n, p.n)}</div>
          <div class="card"><div class="stat-l">Temps</div><div class="recap-v">${fmtDur(s.dur)}</div>${pctDiff(s.dur, p.dur)}</div>
          <div class="card"><div class="stat-l">Volume</div><div class="recap-v">${fmtW(s.vol)}</div>${pctDiff(s.vol, p.vol)}</div>
          <div class="card"><div class="stat-l">Records</div><div class="recap-v">🏆 ${s.prs}</div>${pctDiff(s.prs, p.prs)}</div>
        </div>
        <div class="card records">
          <div class="rec"><span>Jours d’entraînement</span><b>${s.days}</b></div>
          <div class="rec"><span>Séries réalisées</span><b>${s.sets}</b></div>
          ${s.topEx ? `<div class="rec"><span>Exercice favori</span><b>${esc(s.topEx)}</b></div>` : ''}
          ${s.topMus ? `<div class="rec"><span>Muscle n° 1</span><b>${esc(s.topMus)}</b></div>` : ''}
          <div class="rec"><span>Plus longue séance</span><b>${fmtDur(s.longest)}</b></div>
          <div class="rec"><span>Série actuelle</span><b>🔥 ${streakLabel(streakInfo().cur)}</b></div>
        </div>
        <p class="muted small center">Les pourcentages comparent avec le mois précédent.</p>
        <button class="btn primary block big" data-a="recap-share" data-k="${key}">📤 Partager mon bilan (image)</button>`
      : `<div class="empty">Aucune séance en ${s.label}.</div>`}`,
  };
}
// Image 1080 × 1350 à partager (stories, WhatsApp…)
function recapImage(key) {
  const s = monthStats(key);
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1350;
  const g = c.getContext('2d');
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#FF6B1A';
  const bg = g.createLinearGradient(0, 0, 1080, 1350);
  bg.addColorStop(0, '#0E0F12'); bg.addColorStop(1, '#1d1f26');
  g.fillStyle = bg; g.fillRect(0, 0, 1080, 1350);
  g.fillStyle = accent; g.globalAlpha = 0.18;
  g.beginPath(); g.arc(980, 120, 320, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1;
  const font = (w, px) => `${w} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  g.textBaseline = 'alphabetic';
  g.font = font(800, 54); g.fillStyle = '#F2F3F5'; g.fillText('Boby', 80, 130);
  const bw = g.measureText('Boby').width; g.fillStyle = accent; g.fillText('Musc', 80 + bw, 130);
  g.fillStyle = '#9097A3'; g.font = font(600, 40); g.fillText('Mon bilan de', 80, 250);
  g.fillStyle = '#F2F3F5'; g.font = font(800, 92); g.fillText(s.label.charAt(0).toUpperCase() + s.label.slice(1), 80, 345);
  if (db.settings.name) { g.fillStyle = accent; g.font = font(700, 40); g.fillText(db.settings.name, 80, 410); }
  const box = (x, y, label, value) => {
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, 440, 220, 36); else g.rect(x, y, 440, 220);
    g.fill();
    g.fillStyle = '#9097A3'; g.font = font(600, 36); g.fillText(label, x + 40, y + 70);
    g.fillStyle = '#F2F3F5'; g.font = font(800, 76); g.fillText(value, x + 40, y + 170, 370);
  };
  box(80, 480, 'Séances', String(s.n)); box(560, 480, 'Temps', fmtDur(s.dur));
  box(80, 730, 'Volume', fmtW(s.vol)); box(560, 730, 'Records 🏆', String(s.prs));
  g.font = font(600, 38); g.fillStyle = '#F2F3F5';
  const lines = [`🔥 Série : ${streakLabel(streakInfo().cur)}`, s.topEx ? `💪 Exercice favori : ${s.topEx}` : '', `📅 ${s.days} jour${s.days > 1 ? 's' : ''} d’entraînement`].filter(Boolean);
  lines.forEach((l, i) => g.fillText(l, 80, 1040 + i * 64, 920));
  g.fillStyle = '#9097A3'; g.font = font(500, 30); g.fillText(APP_URL.replace('https://', '').replace(/\/$/, ''), 80, 1290);
  return new Promise(res => c.toBlob(res, 'image/png'));
}

/* ---------- Profil : photo et bio ---------- */
function avatarHtml(name, img, cls = '') {
  return img ? `<img class="avatar ${cls}" src="${img}" alt="">` : `<div class="avatar ${cls}">${esc(((name || '?')[0] || '?').toUpperCase())}</div>`;
}
// Photo de profil : carré de 256 px au centre de l'image
async function squareAvatar(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
    return c.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}
function profileForm() {
  const s = db.settings;
  ui.avatarDraft = s.avatar || null;
  openSheet(`<h2>Modifier mon profil</h2>
    <div class="avatar-edit">${avatarHtml(s.name, ui.avatarDraft, 'xl')}
      <div><button class="btn ghost small" data-a="avatar-pick">📷 Changer la photo</button>
      ${ui.avatarDraft ? `<button class="btn danger-ghost small" data-a="avatar-rm">Retirer</button>` : ''}</div>
      <input type="file" id="avatar-in" accept="image/*" hidden></div>
    <label class="field">Nom affiché<input id="pf-name" value="${esc(s.name)}" maxlength="24" placeholder="Ton prénom ou pseudo"></label>
    <label class="field">Bio <span class="muted" id="pf-count">${(s.bio || '').length}/150</span><textarea id="pf-bio" rows="3" maxlength="150" placeholder="Ex. Objectif 100 kg au DC 💪 Salle le soir">${esc(s.bio || '')}</textarea></label>
    <button class="btn primary block" data-a="profile-save">Enregistrer</button>
    <button class="btn ghost block" data-a="close-modal">Annuler</button>`);
}

/* ---------- Morceaux d'écran ---------- */
function homeMotivation() {
  const st = streakInfo();
  const prevKey = shiftMonth(monthKey(Date.now()), -1);
  const showRecap = new Date().getDate() <= 7 && monthStats(prevKey).n > 0;
  const prevLabel = MONTHS[+prevKey.split('-')[1] - 1];
  return `<div class="streak-card ${st.cur ? '' : 'off'}"><div class="flame">🔥</div>
      <div class="grow"><b>${st.cur ? streakLabel(st.cur) + ' d’affilée' : 'Lance ta série !'}</b>
      <div class="muted small">${st.cur ? (st.thisWeek ? 'Semaine validée ✔' : 'Fais une séance cette semaine pour continuer') : 'Une séance par semaine suffit pour garder la flamme'}${st.best > 1 ? ` · record ${streakLabel(st.best)}` : ''}</div></div></div>
    ${showRecap ? `<a class="card recap-teaser" href="#/recap/${prevKey}">📊 <span class="grow"><b>Ton bilan de ${prevLabel} est prêt</b><span class="muted small">Séances, volume, records… à partager !</span></span><span class="muted">›</span></a>` : ''}`;
}
function profileMotivation() {
  const goals = (db.goals || []).filter(g => !g.doneAt).slice(0, 3);
  const bs = badgesState(), ok = bs.filter(b => b.ok);
  const st = streakInfo();
  return `<div class="card"><div class="row-between"><div class="card-title">🎯 Objectifs</div><a class="link small" href="#/goals">Tout voir</a></div>
      ${goals.length ? goals.map(goalRow).join('') : `<button class="btn ghost block" data-a="goal-new">＋ Me fixer un objectif</button>`}</div>
    <a class="card badges-card" href="#/badges"><div class="row-between"><div class="card-title">🏅 Badges</div><span class="muted small">${ok.length} / ${bs.length} ›</span></div>
      <div class="badge-row">${(ok.length ? ok.slice(-8) : bs.slice(0, 8)).map(b => `<span class="${b.ok ? '' : 'locked'}" title="${esc(b.name)}">${b.icon}</span>`).join('')}</div></a>
    <div class="stats-pair">
      <div class="card streak-mini"><div class="stat-l">Série actuelle</div><div class="stat-v">🔥 ${streakLabel(st.cur)}</div></div>
      <a class="card streak-mini" href="#/recap"><div class="stat-l">Bilan du mois</div><div class="stat-v">📊 Voir ›</div></a>
    </div>`;
}

/* ---------- Actions ---------- */
const MOTIV_ACTIONS = {
  'map-days': d => { ui.mapDays = +d.v; render(); },
  'goal-new': () => { ui.goalDraft = { type: 'lift' }; goalForm(); },
  'goal-ex': () => {
    keepDraft();
    openPicker(false, ids => { ui.goalDraft.ex = ids[0]; goalForm(); });
  },
  'goal-save': () => {
    keepDraft();
    const g = ui.goalDraft;
    const t = g.type === 'sessions' ? Math.round(num(g.target)) : fromDisp(g.target);
    if (g.type === 'lift' && !g.ex) { toast('Choisis l’exercice'); return; }
    if (!(t > 0)) { toast('Entre un nombre valide'); return; }
    const goal = { id: uid(), type: g.type, target: t, createdAt: Date.now() };
    if (g.type === 'lift') goal.ex = g.ex;
    if (g.type === 'bodyweight') {
      goal.start = lastWeight();
      if (!goal.start) { toast('Ajoute d’abord ton poids dans Profil → Mesures'); return; }
    }
    if (g.date) goal.deadline = new Date(g.date + 'T23:59').getTime();
    db.goals = db.goals || [];
    db.goals.push(goal);
    const done = checkGoals();
    save(); closeModal(); render();
    toast(done.length ? '🎯 Objectif déjà atteint, bravo !' : 'Objectif créé ✔');
  },
  'goal-del': d => confirmBox('Supprimer cet objectif ?', 'Supprimer', () => { db.goals = db.goals.filter(g => g.id !== d.id); save(); render(); }),
  'recap-nav': d => { location.hash = '#/recap/' + d.k; },
  'recap-share': async d => {
    const blob = await recapImage(d.k);
    const name = `bobymusc-bilan-${d.k}.png`;
    try {
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ files: [file], title: 'Mon bilan BobyMusc' });
        return;
      }
    } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Image enregistrée ✔');
  },
  'profile-edit': () => profileForm(),
  'avatar-pick': () => $('#avatar-in').click(),
  'avatar-rm': (d, el) => { ui.avatarDraft = null; refreshAvatarPreview(); el.remove(); },
  'profile-save': async () => {
    const name = $('#pf-name').value.trim(), bio = $('#pf-bio').value.trim().slice(0, 150);
    db.settings.name = name; db.settings.bio = bio; db.settings.avatar = ui.avatarDraft || null;
    save(); closeModal(); render();
    const cl = C();
    if (cl && cl.state.user) {
      const upd = { bio, avatar: db.settings.avatar };
      if (name.length >= 2) upd.name = name;
      cl.updateProfile(upd).then(() => { for (const k in net) if (k.startsWith('fprof')) delete net[k]; }).catch(e => toast(cl.errMsg(e)));
    }
    toast('Profil mis à jour ✔');
  },
};
// Garde ce qui est déjà tapé dans le formulaire d'objectif avant de le redessiner
function keepDraft() {
  const g = ui.goalDraft;
  if ($('#gl-type')) g.type = $('#gl-type').value;
  if ($('#gl-target')) g.target = $('#gl-target').value;
  if ($('#gl-date')) g.date = $('#gl-date').value;
}
function refreshAvatarPreview() {
  const box = $('.avatar-edit');
  if (!box) return;
  const old = box.querySelector('.avatar');
  old.outerHTML = avatarHtml($('#pf-name').value, ui.avatarDraft, 'xl');
}
