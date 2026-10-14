/* BobyMusc — partie en ligne (comptes, sauvegarde, amis) avec Firebase.
   Chargé à la demande par app.js ; l'appli marche sans, hors connexion. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, setDoc, deleteDoc,
  updateDoc, collection, getDocs, query, orderBy, limit, writeBatch, onSnapshot, deleteField,
  where, arrayUnion, arrayRemove,
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const app = initializeApp({
  apiKey: 'AIzaSyACuZRFeRSHC9A6slkTVNjnQbflv-2ls5U',
  authDomain: 'bobymusc-app.firebaseapp.com',
  projectId: 'bobymusc-app',
  storageBucket: 'bobymusc-app.firebasestorage.app',
  messagingSenderId: '286737284783',
  appId: '1:286737284783:web:b2030a90e523b89a049e5a',
});
const auth = getAuth(app);
let fs;
try {
  // Cache local : les envois partent tout seuls quand le réseau revient
  fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  fs = initializeFirestore(app, {});
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const state = { user: null, profile: null, friends: [], requests: [], groups: [], ready: false };
let unsubs = [];
const notify = () => window.dispatchEvent(new CustomEvent('cloud-change'));
const uref = uid => doc(fs, 'users', uid);

const ERRORS = {
  'auth/email-already-in-use': 'Cette adresse e-mail a déjà un compte. Connecte-toi plutôt.',
  'auth/invalid-email': 'Adresse e-mail invalide.',
  'auth/weak-password': 'Mot de passe trop court (6 caractères minimum).',
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
  'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
  'auth/user-not-found': 'Aucun compte avec cette adresse.',
  'auth/too-many-requests': 'Trop d’essais. Réessaie dans quelques minutes.',
  'auth/network-request-failed': 'Pas de connexion internet.',
  'permission-denied': 'Action refusée.',
  'unavailable': 'Pas de connexion internet.',
};
const errMsg = e => ERRORS[e.code] || e.message || 'Erreur inconnue';

async function newCode(uid) {
  for (let i = 0; i < 8; i++) {
    let c = 'BOBY-';
    for (let k = 0; k < 4; k++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    const ref = doc(fs, 'codes', c);
    const snap = await getDoc(ref);
    if (!snap.exists()) { await setDoc(ref, { uid }); return c; }
  }
  throw new Error('Impossible de créer un code ami, réessaie.');
}

async function ensureProfile(user, name) {
  const snap = await getDoc(uref(user.uid));
  if (snap.exists()) return snap.data();
  const profile = { name: name || (user.email || 'Sportif').split('@')[0], code: await newCode(user.uid), createdAt: Date.now(), workouts: 0, lastAt: 0 };
  await setDoc(uref(user.uid), profile);
  return profile;
}

function listen(uid) {
  unsubs.forEach(u => u());
  unsubs = [
    onSnapshot(collection(fs, 'users', uid, 'friends'), s => {
      state.friends = s.docs.map(d => ({ uid: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
      notify();
    }, () => {}),
    onSnapshot(collection(fs, 'users', uid, 'requests'), s => {
      state.requests = s.docs.map(d => ({ uid: d.id, ...d.data() }));
      notify();
    }, () => {}),
    onSnapshot(uref(uid), s => { if (s.exists()) { state.profile = s.data(); notify(); } }, () => {}),
    onSnapshot(query(collection(fs, 'groups'), where('members', 'array-contains', uid)), s => {
      state.groups = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
      notify();
    }, e => console.warn('groupes', e)),
  ];
}

onAuthStateChanged(auth, async user => {
  state.user = user ? { uid: user.uid, email: user.email } : null;
  if (!user) {
    unsubs.forEach(u => u()); unsubs = [];
    state.profile = null; state.friends = []; state.requests = []; state.groups = [];
  } else {
    try { state.profile = await ensureProfile(user, pendingName); } catch (e) { console.warn(e); }
    pendingName = null;
    listen(user.uid);
    window.dispatchEvent(new CustomEvent('cloud-login'));
  }
  state.ready = true;
  notify();
});
let pendingName = null;

/* ---------- Séances ---------- */
// Version « partageable » d'une séance : on garde le nom des exercices pour que les amis les voient
function packWorkout(w, exInfo, totals) {
  return {
    id: w.id, name: w.name, note: w.note || '', start: w.start, end: w.end, prs: w.prs || [],
    vol: totals.vol, sets: totals.sets,
    exercises: w.exercises.map(e => {
      const i = exInfo(e.ex);
      return { ex: e.ex, n: i.name, m: i.muscle, t: i.type, note: e.note || '', sets: e.sets };
    }),
  };
}

const Cloud = {
  state,
  errMsg,
  async signUp(name, email, pw) {
    pendingName = name;
    await createUserWithEmailAndPassword(auth, email, pw);
  },
  signIn: (email, pw) => signInWithEmailAndPassword(auth, email, pw),
  signOut: () => signOut(auth),
  resetPassword: email => sendPasswordResetEmail(auth, email),
  async rename(name) {
    await updateDoc(uref(state.user.uid), { name });
  },
  // Photo (petite image ≈ 20 Ko) et bio, visibles par les amis
  updateProfile: fields => updateDoc(uref(state.user.uid), fields),
  // Mode privé : les amis ne peuvent plus lire mes séances (vérifié par les règles de sécurité)
  setPrivate: priv => updateDoc(uref(state.user.uid), { private: !!priv }),
  // Efface tout ce qui m'appartient en ligne, puis le compte lui-même
  async deleteAccount() {
    const me = state.user.uid, user = auth.currentUser;
    const del = async refs => {
      for (let i = 0; i < refs.length; i += 400) {
        const b = writeBatch(fs);
        refs.slice(i, i + 400).forEach(r => b.delete(r));
        await b.commit();
      }
    };
    const [ws, fr, rq] = await Promise.all([
      getDocs(collection(fs, 'users', me, 'workouts')),
      getDocs(collection(fs, 'users', me, 'friends')),
      getDocs(collection(fs, 'users', me, 'requests')),
    ]);
    for (const g of state.groups) { try { await Cloud.leaveGroup(g); } catch (e) { console.warn(e); } }
    unsubs.forEach(u => u()); unsubs = [];
    await del([
      ...ws.docs.map(d => d.ref), ...rq.docs.map(d => d.ref),
      ...fr.docs.flatMap(d => [d.ref, doc(fs, 'users', d.id, 'friends', me)]),
      doc(fs, 'users', me, 'private', 'data'),
    ]);
    if (state.profile && state.profile.code) await deleteDoc(doc(fs, 'codes', state.profile.code));
    await deleteDoc(uref(me));
    await user.delete();
  },

  async pushWorkout(w, exInfo, totals) {
    if (!state.user) return;
    // merge : on ne touche pas aux réactions des amis
    await setDoc(doc(fs, 'users', state.user.uid, 'workouts', w.id), JSON.parse(JSON.stringify(packWorkout(w, exInfo, totals))), { merge: true });
  },
  async deleteWorkout(id) {
    if (!state.user) return;
    await deleteDoc(doc(fs, 'users', state.user.uid, 'workouts', id));
  },
  async pushStats(count, lastAt) {
    if (!state.user) return;
    await updateDoc(uref(state.user.uid), { workouts: count, lastAt });
  },
  async pushPrivate(data) {
    if (!state.user) return;
    await setDoc(doc(fs, 'users', state.user.uid, 'private', 'data'), JSON.parse(JSON.stringify(data)));
  },
  async pullAll() {
    const uid = state.user.uid;
    const [ws, priv] = await Promise.all([
      getDocs(collection(fs, 'users', uid, 'workouts')),
      getDoc(doc(fs, 'users', uid, 'private', 'data')),
    ]);
    return { workouts: ws.docs.map(d => d.data()), priv: priv.exists() ? priv.data() : null };
  },
  // Envoie plusieurs séances d'un coup (paquets de 400)
  async pushMany(list) {
    const uid = state.user.uid;
    for (let i = 0; i < list.length; i += 400) {
      const b = writeBatch(fs);
      for (const w of list.slice(i, i + 400)) b.set(doc(fs, 'users', uid, 'workouts', w.id), JSON.parse(JSON.stringify(w)), { merge: true });
      await b.commit();
    }
  },
  packWorkout,

  /* ---------- Amis ---------- */
  async addFriend(code) {
    code = code.trim().toUpperCase().replace(/\s+/g, '');
    if (!code.startsWith('BOBY-')) code = 'BOBY-' + code.replace(/^BOBY/, '');
    if (code === state.profile?.code) throw new Error('C’est ton propre code 😄');
    const snap = await getDoc(doc(fs, 'codes', code));
    if (!snap.exists()) throw new Error('Aucun utilisateur avec ce code. Vérifie les lettres.');
    const fid = snap.data().uid;
    if (state.friends.some(f => f.uid === fid)) throw new Error('Vous êtes déjà amis !');
    // Si cette personne m'a déjà envoyé une demande : on accepte directement
    const mine = state.requests.find(r => r.uid === fid);
    if (mine) { await Cloud.accept(mine); return 'accepted'; }
    await setDoc(doc(fs, 'users', fid, 'requests', state.user.uid), { name: state.profile.name, code: state.profile.code, at: Date.now() });
    return 'sent';
  },
  async accept(r) {
    const me = state.user.uid;
    const b = writeBatch(fs);
    b.set(doc(fs, 'users', me, 'friends', r.uid), { name: r.name, code: r.code || '', since: Date.now() });
    b.set(doc(fs, 'users', r.uid, 'friends', me), { name: state.profile.name, code: state.profile.code, since: Date.now() });
    b.delete(doc(fs, 'users', me, 'requests', r.uid));
    await b.commit();
  },
  refuse: r => deleteDoc(doc(fs, 'users', state.user.uid, 'requests', r.uid)),
  async removeFriend(fid) {
    const me = state.user.uid;
    const b = writeBatch(fs);
    b.delete(doc(fs, 'users', me, 'friends', fid));
    b.delete(doc(fs, 'users', fid, 'friends', me));
    await b.commit();
  },
  async friendProfile(fid) {
    const s = await getDoc(uref(fid));
    return s.exists() ? s.data() : null;
  },
  async friendWorkouts(fid, n = 30) {
    const s = await getDocs(query(collection(fs, 'users', fid, 'workouts'), orderBy('start', 'desc'), limit(n)));
    return s.docs.map(d => ({ ...d.data(), owner: fid }));
  },
  async friendWorkout(fid, wid) {
    const s = await getDoc(doc(fs, 'users', fid, 'workouts', wid));
    return s.exists() ? { ...s.data(), owner: fid } : null;
  },
  // Fil d'actualité : les dernières séances de tous mes amis
  async feed(per = 10) {
    const lists = await Promise.all(state.friends.map(f => Cloud.friendWorkouts(f.uid, per).catch(() => [])));
    return lists.flat().sort((a, b) => b.start - a.start);
  },
  async react(owner, wid, emoji) {
    const me = state.user.uid;
    await updateDoc(doc(fs, 'users', owner, 'workouts', wid), {
      [`reactions.${me}`]: emoji ? { e: emoji, n: state.profile.name } : deleteField(),
    });
  },

  /* ---------- Groupes ---------- */
  async createGroup(name, emoji, friends) {
    const me = state.user.uid;
    const ref = doc(collection(fs, 'groups'));
    const memberNames = { [me]: state.profile.name };
    for (const f of friends) memberNames[f.uid] = f.name;
    await setDoc(ref, {
      name, emoji, owner: me, members: [me, ...friends.map(f => f.uid)], memberNames,
      createdAt: Date.now(), lastAt: Date.now(), lastText: 'Groupe créé', lastBy: me,
    });
    return ref.id;
  },
  // Écoute les derniers messages d'un groupe en direct ; renvoie la fonction pour arrêter
  watchMessages(gid, cb, n = 150) {
    return onSnapshot(query(collection(fs, 'groups', gid, 'messages'), orderBy('at', 'desc'), limit(n)),
      s => cb(s.docs.map(d => ({ id: d.id, ...d.data() })).reverse()),
      e => cb(null, e));
  },
  async sendMessage(gid, msg) {
    const me = state.user.uid;
    const ref = doc(collection(fs, 'groups', gid, 'messages'));
    const data = { uid: me, name: state.profile.name, at: Date.now(), ...msg };
    const preview = msg.img ? '📷 Photo' : msg.workout ? '🏋️ ' + msg.workout.name : msg.text;
    const b = writeBatch(fs);
    b.set(ref, JSON.parse(JSON.stringify(data)));
    b.update(doc(fs, 'groups', gid), { lastAt: data.at, lastText: (preview || '').slice(0, 80), lastBy: me, lastName: state.profile.name });
    await b.commit();
  },
  deleteMessage: (gid, mid) => deleteDoc(doc(fs, 'groups', gid, 'messages', mid)),
  renameGroup: (gid, name, emoji) => updateDoc(doc(fs, 'groups', gid), { name, emoji }),
  async addMembers(gid, friends) {
    const upd = { members: arrayUnion(...friends.map(f => f.uid)) };
    for (const f of friends) upd[`memberNames.${f.uid}`] = f.name;
    await updateDoc(doc(fs, 'groups', gid), upd);
  },
  async leaveGroup(g) {
    const me = state.user.uid;
    const rest = g.members.filter(u => u !== me);
    if (!rest.length) return Cloud.deleteGroup(g.id);
    const upd = { members: arrayRemove(me), [`memberNames.${me}`]: deleteField() };
    if (g.owner === me) upd.owner = rest[0]; // on passe la main au membre suivant
    await updateDoc(doc(fs, 'groups', g.id), upd);
  },
  async deleteGroup(gid) {
    const msgs = await getDocs(collection(fs, 'groups', gid, 'messages'));
    for (let i = 0; i < msgs.docs.length; i += 400) {
      const b = writeBatch(fs);
      msgs.docs.slice(i, i + 400).forEach(d => b.delete(d.ref));
      await b.commit();
    }
    await deleteDoc(doc(fs, 'groups', gid));
  },
};

window.Cloud = Cloud;
window.dispatchEvent(new CustomEvent('cloud-loaded'));
