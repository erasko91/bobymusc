// Appel d'une API Google avec la connexion Firebase CLI : node gapi.js METHODE URL [corps JSON]
const path = require('path');
const FB = 'E:\\Outils\\node-v24.21.0-win-x64\\node_modules\\firebase-tools\\lib';
const { configstore } = require(path.join(FB, 'configstore'));
const auth = require(path.join(FB, 'auth'));

(async () => {
  const [method, url, bodyArg] = process.argv.slice(2);
  // « @fichier.json » : lit le corps depuis un fichier (PowerShell abîme les guillemets)
  const body = bodyArg && bodyArg.startsWith('@') ? require('fs').readFileSync(bodyArg.slice(1), 'utf8') : bodyArg;
  const tokens = configstore.get('tokens');
  const t = await auth.getAccessToken(tokens.refresh_token, []);
  const r = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + t.access_token, 'Content-Type': 'application/json', 'x-goog-user-project': 'bobymusc-app' },
    body: body || undefined,
  });
  const txt = await r.text();
  console.log(r.status, txt.slice(0, 1500));
  process.exit(r.ok ? 0 : 1);
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
