/* Import at the top of every protected page. Resolves the logged-in
   admin's doc from admins/{uid}. */
import { auth, db, onAuthStateChanged, doc, getDoc, signOut } from "./firebase-config.js";

export function requireAdmin() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "login.html";
        return;
      }
      const snap = await getDoc(doc(db, "admins", user.uid));
      if (!snap.exists()) {
        alert("এই অ্যাকাউন্টের জন্য কোনো Admin প্রোফাইল পাওয়া যায়নি।");
        await signOut(auth);
        window.location.href = "login.html";
        return;
      }
      resolve({ id: user.uid, ...snap.data() });
    });
  });
}
