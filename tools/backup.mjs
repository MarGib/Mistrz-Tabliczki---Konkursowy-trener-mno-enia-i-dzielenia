/**
 * Cotygodniowa kopia zapasowa bazy (GitHub Actions → .github/workflows/backup.yml).
 * Wymaga sekretu FIREBASE_SERVICE_ACCOUNT (klucz konta usługi, JSON). Zapisuje backup.json
 * (wszystkie kolekcje i podkolekcje + lista kont logowania, bez haseł). Szyfrowanie robi workflow.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import admin from 'firebase-admin';

const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? readFileSync(process.argv[2] ?? 'sa.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(cred) });
const db = admin.firestore();

const plain = (v) => {
  if (v && typeof v === 'object') {
    if (typeof v.toMillis === 'function') return { __time: v.toMillis() };
    if (Array.isArray(v)) return v.map(plain);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  }
  return v;
};

const data = {};
const counts = {};
async function dump(ref, path) {
  const snap = await ref.get();
  for (const d of snap.docs) {
    (data[path] ??= {})[d.ref.path] = plain(d.data());
    counts[path] = (counts[path] ?? 0) + 1;
    for (const sub of await d.ref.listCollections()) await dump(sub, `${path}/*/${sub.id}`);
  }
}
for (const col of await db.listCollections()) await dump(col, col.id);

const users = [];
let page;
do {
  const res = await admin.auth().listUsers(1000, page);
  for (const u of res.users) {
    users.push({ uid: u.uid, email: u.email, disabled: u.disabled, created: u.metadata.creationTime, lastSignIn: u.metadata.lastSignInTime });
  }
  page = res.pageToken;
} while (page);

writeFileSync(
  'backup.json',
  JSON.stringify({ kind: 'mistrz-tabliczki-backup', createdAt: new Date().toISOString(), counts, authUsers: users, data })
);
console.log('Kopia gotowa:', JSON.stringify({ ...counts, authUsers: users.length }));
