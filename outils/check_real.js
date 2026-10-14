// Vérifie (sans rien modifier) que les vrais comptes ont toujours leur profil
const path = require('path');
const FB = 'E:\\Outils\\node-v24.21.0-win-x64\\node_modules\\firebase-tools\\lib';
const { configstore } = require(path.join(FB, 'configstore'));
const auth = require(path.join(FB, 'auth'));
const P = 'bobymusc-app';
(async () => {
  const t = (await auth.getAccessToken(configstore.get('tokens').refresh_token, [])).access_token;
  const h = { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', 'x-goog-user-project': P };
  const q = await (await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${P}/accounts:query`, { method: 'POST', headers: h, body: '{}' })).json();
  for (const u of q.userInfo || []) {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents/users/${u.localId}`, { headers: h });
    const d = await r.json();
    const f = d.fields || {};
    const ws = await (await fetch(`https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents/users/${u.localId}/workouts?pageSize=300`, { headers: h })).json();
    console.log(`- domaine ${u.email.split('@')[1]} | profil ${r.ok ? 'OK' : 'ABSENT'} | pseudo ${f.name ? f.name.stringValue : '?'} | séances en ligne ${(ws.documents || []).length}`);
  }
})();
