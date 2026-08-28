/* Self-service first-admin registration — no Cloud Function.

   Flow:
   1. Create the Firebase Auth user directly on the PRIMARY `auth` (this
      page is public and nobody is signed in yet, so there's no admin
      session to protect — unlike accounts.js, no secondary app needed).
   2. In one Firestore transaction, atomically (a) create system/bootstrap
      and (b) create the admins/{uid} profile doc. firestore.rules only
      grants `create` (never `update`) on system/bootstrap, so a second
      attempt after the first admin exists is naturally rejected — the
      one-time guarantee comes from Firestore's own document semantics,
      not from anything in this file.
   3. If the transaction is rejected (an admin already exists, or a race
      with someone else's simultaneous submit), delete the just-created
      Auth user so this project isn't left with a login that has no
      admin profile — the client SDK can do this because the new user
      is, at this point, signed into their own account. */
import {
  auth,
  db,
  runTransaction,
  doc,
  createUserWithEmailAndPassword,
  deleteUser
} from "./firebase-config.js";

const form = document.getElementById("registerForm");
const messageBox = document.getElementById("registerMessage");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  messageBox.style.display = "none";

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    messageBox.textContent = "Password দুইবার একই দিতে হবে।";
    messageBox.style.color = "#a3271f";
    messageBox.style.display = "block";
    return;
  }
  if (password.length < 6) {
    messageBox.textContent = "কমপক্ষে ৬ অক্ষরের password দিন।";
    messageBox.style.color = "#a3271f";
    messageBox.style.display = "block";
    return;
  }

  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "তৈরি হচ্ছে...";

  let userCred;
  try {
    userCred = await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    messageBox.textContent = "Auth ইউজার তৈরি করা যায়নি: " + err.message;
    messageBox.style.color = "#a3271f";
    messageBox.style.display = "block";
    submitBtn.disabled = false;
    submitBtn.textContent = "প্রথম Admin অ্যাকাউন্ট তৈরি করুন";
    return;
  }

  const bootstrapRef = doc(db, "system", "bootstrap");
  const adminRef = doc(db, "admins", userCred.user.uid);

  try {
    await runTransaction(db, async (tx) => {
      tx.set(bootstrapRef, { adminCreated: true, claimedAt: new Date().toISOString() });
      tx.set(adminRef, {
        name,
        email,
        createdAt: new Date().toISOString(),
        createdBy: "bootstrap"
      });
    });
    window.location.href = "dashboard.html";
  } catch (err) {
    await deleteUser(userCred.user).catch(() => {});
    messageBox.textContent =
      err.code === "permission-denied"
        ? "একটি Admin অ্যাকাউন্ট ইতিমধ্যে তৈরি করা আছে। নতুন Admin দরকার হলে বিদ্যমান কোনো Admin-কে Accounts পেজ থেকে যোগ করতে বলুন।"
        : "Admin অ্যাকাউন্ট তৈরি করা যায়নি: " + err.message;
    messageBox.style.color = "#a3271f";
    messageBox.style.display = "block";
    submitBtn.disabled = false;
    submitBtn.textContent = "প্রথম Admin অ্যাকাউন্ট তৈরি করুন";
  }
});
