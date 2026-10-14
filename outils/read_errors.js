// Lit les rapports d'erreur envoyés par l'appli (lecture seule, sauf « --purge » qui les efface)
const path = require('path');
const FB = 'E:\\Outils\\node-v24.21.0-win-x64\\node_modules\\firebase-tools\\lib';
const { configstore } = require(path.join(FB, 'configstore'));
const auth = require(path.join(FB, 'auth'));
const BASE = 'https://firestore.googleapis.com/v1/projects/bobymusc-app/databases/(default)/documents';
(async () => {
  const t = (await auth.getAccessToken(configstore.get('tokens').refresh_token, [])).access_token;
  const h = { Authorization: 'Bearer ' + t, 'x-goog-user-project': 'bobymusc-app' };
  const r = await (await fetch(`${BASE}/errors?pageSize=100`, { headers: h })).json();
  const docs = (r.documents || []).sort((a, b) => +a.fields.at.integerValue - +b.fields.at.integerValue);
  console.log(`${docs.length} rapport(s)`);
  for (const d of docs) {
    const f = k => (d.fields[k] || {}).stringValue || '';
    console.log(`\n[${new Date(+d.fields.at.integerValue).toLocaleString('fr-FR')}] v${f('v')} ${f('route')}\n${f('msg')}\n${f('stack').split('\n').slice(0, 6).join('\n')}\n${f('ua')}`);
    if (process.argv.includes('--purge')) await fetch(`https://firestore.googleapis.com/v1/${d.name}`, { method: 'DELETE', headers: h });
  }
})();
