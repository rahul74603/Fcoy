// ═══════════════════════════════════════════════════════════════════════════
// F COY ERP — STORAGE RULES TEST SUITE (Task 2)
// Run: npm run test:rules  (firestore+storage emulators dono — storage rules
// cross-service role bhi Firestore users/{uid} se leti hain)
// ═══════════════════════════════════════════════════════════════════════════
import { beforeAll, beforeEach, afterAll, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

const CC = 'uid-cc';
const CLERK = 'uid-clerk';
const QM = 'uid-qm';
const USTAD = 'uid-ustad';
const PDF = { contentType: 'application/pdf' } as const;
const smallPdf = new Uint8Array(1024);           // 1 KB
const bigFile = new Uint8Array(6 * 1024 * 1024); // 6 MB (> 5MB cap)

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-fcoy',
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
});

afterAll(async () => { await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearStorage();
  await testEnv.clearFirestore();
  // Role docs seed karo — storage rules inhe cross-service lookup karti hain
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', CC), { role: 'Company Commander' });
    await setDoc(doc(db, 'users', CLERK), { role: 'Clerk' });
    await setDoc(doc(db, 'users', QM), { role: 'Quarter Master' });
    await setDoc(doc(db, 'users', USTAD), { role: 'Ustad' });
  });
});

const stAs = (uid: string) => testEnv.authenticatedContext(uid).storage();
const stAnon = () => testEnv.unauthenticatedContext().storage();

describe('trainee documents path (documents/{regNo}/{file})', () => {
  it('Clerk upload kar sakta hai (PDF, chhota file)', async () => {
    await assertSucceeds(uploadBytes(ref(stAs(CLERK), 'documents/REG61/aadhaar_1.pdf'), smallPdf, PDF as any));
  });
  it('CC upload/read kar sakta hai', async () => {
    const r = ref(stAs(CC), 'documents/REG61/photo_1.jpg');
    await assertSucceeds(uploadBytes(r, smallPdf, { contentType: 'image/jpeg' } as any));
    await assertSucceeds(getBytes(r));
  });
  it('QM/Ustad upload+read DENIED; anonymous DENIED', async () => {
    await assertFails(uploadBytes(ref(stAs(QM), 'documents/REG61/x.pdf'), smallPdf, PDF as any));
    await assertFails(uploadBytes(ref(stAs(USTAD), 'documents/REG61/x.pdf'), smallPdf, PDF as any));
    await assertFails(uploadBytes(ref(stAnon(), 'documents/REG61/x.pdf'), smallPdf, PDF as any));
  });
  it('5MB se bada file DENIED', async () => {
    await assertFails(uploadBytes(ref(stAs(CLERK), 'documents/REG61/big.pdf'), bigFile, PDF as any));
  });
  it('non-image/PDF type (script/executable) DENIED', async () => {
    await assertFails(uploadBytes(
      ref(stAs(CLERK), 'documents/REG61/evil.html'), smallPdf, { contentType: 'text/html' } as any
    ));
  });
  it('delete sirf CC/Clerk', async () => {
    const r = ref(stAs(CLERK), 'documents/REG61/del.pdf');
    await assertSucceeds(uploadBytes(r, smallPdf, PDF as any));
    await assertFails(deleteObject(ref(stAs(QM), 'documents/REG61/del.pdf')));
    await assertSucceeds(deleteObject(r));
  });
  it('documents path ke BAHAR (unknown path) sab DENIED — deny by default', async () => {
    await assertFails(uploadBytes(ref(stAs(CC), 'tmp/x.pdf'), smallPdf, PDF as any));
    await assertFails(uploadBytes(ref(stAs(CLERK), 'bills/y.pdf'), smallPdf, PDF as any));
  });
});
