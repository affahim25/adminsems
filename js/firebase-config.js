/* =========================================================================
   firebase-config.js  (Admin Dashboard)
   -------------------------------------------------------------------------
   Same Firebase project as the other three portals — one firebaseConfig,
   one Firestore database. No Cloud Functions anywhere in this project —
   everything runs on the client SDK so the whole project can stay on the
   Spark (free, no billing account) plan. Deploying even one Cloud
   Function forces the project onto the Blaze plan (a linked card),
   whether or not it ever bills anything.

   Creating a brand-new login (Firebase Auth user + Firestore profile doc)
   the naive way — calling createUserWithEmailAndPassword() straight on
   `auth` below — would sign the ADMIN OUT and sign the new account IN
   instead, which is unusable for an "add a teacher" form. createSecondaryAuthUser()
   below solves that with a second, throwaway Firebase App instance: its
   own Auth creates the new user without ever touching the primary `auth`
   instance the signed-in admin is using. See js/accounts.js.

   There are no custom claims anywhere in this system anymore either —
   custom claims can only ever be set by the Admin SDK (server-side), so
   a Cloud-Function-free system can't use them. `role()` in firestore.rules
   instead looks up which of students/teachers/examCommittee/admins
   contains the caller's uid — see the rules file for details. Every page
   here already resolved role by reading admins/{uid} directly (js/auth-guard.js,
   js/login.js), so no client code needed to change for that part.

   THIS PORTAL IS THE ONLY ONE THAT CAN READ scriptIdentityMap
   -------------------------------------------------------------------------
   Every other portal treats student<->script identity as write-only or
   inaccessible (see Teacher Portal / Exam Committee Portal comments).
   Identity Reveal and Approvals on this dashboard are the one place in
   the whole system that collection is ever read — and every read here
   should also write an auditLogs/* entry (see js/audit.js).

   NEW COLLECTIONS THIS PORTAL OWNS
   -------------------------------------------------------------------------
   auditLogs/{logId}
       Source: written ONLY here (see js/audit.js's logAudit() helper).
       Fields: action, actorId, actorName, targetType, targetId, details,
               at
       Read by: only this portal (role() == 'admin' in firestore.rules).

   Also touched:
     students / teachers / examCommittee / admins  — full CRUD (profile
         docs only — the matching Auth user + claim is created via the
         Cloud Function, see accounts.html).
     scriptIdentityMap/{scriptId}  — read (admin-only), used by Identity
         Reveal and by Approvals when publishing results.
     scriptMarks/{scriptId}        — read, used by Approvals to pull the
         actual marks/grade once identity is resolved.
     resultPublishRequests/{id}    — read/update (approve/reject), from
         Exam Committee's Result Confirmation step.
     results/{studentId}_{examId}  — write, created/merged here when an
         Approval is granted; `published` flips true separately.
     All student-submitted request collections (specialExamApplications,
     courseDrops, semesterDrops, programChangeRequests, transportRequests)
         — read/update for the general Approvals queue.
   ========================================================================= */

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* Same project as the other three portals — replace with the real keys
   before deploying. Must match exactly. */
const firebaseConfig = {
  apiKey: "AIzaSyCt9vj_QEVbLDwQ8ET2EzCSQZSNk4K61_w",
  authDomain: "sems-a6241.firebaseapp.com",
  databaseURL: "https://sems-a6241-default-rtdb.firebaseio.com",
  projectId: "sems-a6241",
  storageBucket: "sems-a6241.firebasestorage.app",
  messagingSenderId: "866951977088",
  appId: "1:866951977088:web:56fe02377ec140f2372e65",
  measurementId: "G-FWYSZY6Z7V"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* Creates a brand-new Firebase Auth user WITHOUT signing the currently
   logged-in admin out of `auth` above. Used by js/accounts.js when an
   admin adds a student/teacher/examCommittee/admin login.

   How: a second, throwaway Firebase App instance (unique name every
   call) gets its own isolated Auth instance. Creating a user there signs
   that new user into the SECONDARY app only — the primary `auth` the
   admin is using is never touched. The secondary app is torn down right
   after, whether it succeeded or not.

   Returns the new user's uid. Throws on failure (e.g. email-already-in-use)
   — the caller should not write a profile doc if this throws. */
async function createSecondaryAuthUser(email, password) {
  const secondaryApp = initializeApp(
    firebaseConfig,
    `secondary-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOut(secondaryAuth);
    return cred.user.uid;
  } finally {
    await deleteApp(secondaryApp).catch(() => {});
  }
}

export {
  auth,
  db,
  createSecondaryAuthUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  runTransaction
};
