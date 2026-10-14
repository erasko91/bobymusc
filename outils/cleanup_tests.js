// Supprime uniquement les comptes de test (e-mail test-...@example.com) et leurs données Firestore
const path = require('path');
const FB = 'E:\\Outils\\node-v24.21.0-win-x64\\node_modules\\firebase-tools\\lib';
const { configstore } = require(path.join(FB, 'configstore'));
const auth = require(path.join(FB, 'auth'));
const P = 'bobymusc-app';
const FS = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;

(async () => {
  const t = (await auth.getAccessToken(configstore.get('tokens').refresh_token, [])).access_token;
  const call = async (method, url, body) => {
    const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', 'x-goog-user-project': P }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && r.status !== 404) throw new Error(method + ' ' + url + ' ' + r.status + ' ' + JSON.stringify(j).slice(0, 300));
    return j;
  };
  const q = await call('POST', `https://identitytoolkit.googleapis.com/v1/projects/${P}/accounts:query`, {});
  const all = q.userInfo || [];
  const tests = all.filter(u => /^test-.*@example\.com$/.test(u.email || ''));
  console.log(`comptes : ${all.length} dont ${tests.length} de test`);
  const testIds = new Set(tests.map(u => u.localId));
  // Données Firestore des comptes de test (y compris ceux déjà supprimés : on lit tous les users)
  const delTree = async name => {
    const sub = await call('POST', `https://firestore.googleapis.com/v1/${name}:listCollectionIds`, {});
    for (const c of sub.collectionIds || []) {
      const docs = await call('GET', `https://firestore.googleapis.com/v1/${name}/${c}?pageSize=300`);
      for (const d of docs.documents || []) await delTree(d.name);
    }
    await call('DELETE', `https://firestore.googleapis.com/v1/${name}`);
  };
  const users = await call('GET', `${FS}/users?pageSize=300&showMissing=true`);
  const realIds = new Set(all.filter(u => !testIds.has(u.localId)).map(u => u.localId));
  let n = 0;
  for (const d of users.documents || []) {
    const id = d.name.split('/').pop();
    if (realIds.has(id)) continue; // jamais toucher un vrai compte
    await delTree(d.name); n++;
  }
  const codes = await call('GET', `${FS}/codes?pageSize=300`);
  for (const d of codes.documents || []) {
    const owner = d.fields && d.fields.uid && d.fields.uid.stringValue;
    if (!realIds.has(owner)) await call('DELETE', `https://firestore.googleapis.com/v1/${d.name}`);
  }
  // Groupes sans aucun vrai membre
  const groups = await call('GET', `${FS}/groups?pageSize=300`);
  let ng = 0;
  for (const d of groups.documents || []) {
    const members = ((d.fields.members || {}).arrayValue || {}).values || [];
    if (members.some(v => realIds.has(v.stringValue))) continue;
    await delTree(d.name); ng++;
  }
  console.log(`groupes de test effacés : ${ng}`);
  if (tests.length) await call('POST', `https://identitytoolkit.googleapis.com/v1/projects/${P}/accounts:batchDelete`, { localIds: [...testIds], force: true });
  const after = await call('POST', `https://identitytoolkit.googleapis.com/v1/projects/${P}/accounts:query`, {});
  console.log(`profils de test effacés : ${n} ; comptes restants : ${after.recordsCount}`);
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
