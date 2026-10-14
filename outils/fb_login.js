// Connexion Firebase en ouvrant la page Google directement dans Opera GX
const path = require('path');
const Module = require('module');
const { spawn } = require('child_process');
const FB = 'E:\\Outils\\node-v24.21.0-win-x64\\node_modules\\firebase-tools\\lib';
const OPERA = path.join(process.env.LOCALAPPDATA, 'Programs', 'Opera GX', 'opera.exe');

// Remplace l'ouverture du navigateur par défaut par Opera GX
const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'open') {
    return async url => {
      console.log('URL ouverte dans Opera GX');
      spawn(OPERA, [url], { detached: true, stdio: 'ignore' }).unref();
    };
  }
  return origLoad.call(this, req, ...rest);
};

const { configstore } = require(path.join(FB, 'configstore'));
const auth = require(path.join(FB, 'auth'));

(async () => {
  configstore.set('usage', false);
  const result = await auth.loginGoogle(true);
  auth.recordCredentials(result);
  configstore.delete('tempLoginState');
  console.log('CONNECTE : ' + (result.user && result.user.email));
  process.exit(0);
})().catch(e => { console.error('ERREUR : ' + e.message); process.exit(1); });
