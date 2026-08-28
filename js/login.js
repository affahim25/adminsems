import { auth, db, signInWithEmailAndPassword, doc, getDoc } from "./firebase-config.js";

const form = document.getElementById("loginForm");
const errorBox = document.getElementById("loginError");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.style.display = "none";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "admins", cred.user.uid));
    if (!snap.exists()) {
      errorBox.textContent = "এই অ্যাকাউন্টের জন্য কোনো Admin প্রোফাইল পাওয়া যায়নি।";
      errorBox.style.display = "block";
      return;
    }
    window.location.href = "dashboard.html";
  } catch (err) {
    errorBox.textContent = "ইমেইল অথবা পাসওয়ার্ড ভুল হয়েছে।";
    errorBox.style.display = "block";
  }
});
