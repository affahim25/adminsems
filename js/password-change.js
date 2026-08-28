import { requireAdmin } from "./auth-guard.js";
import { renderLayout } from "./layout.js";
import { auth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "./firebase-config.js";

const admin = await requireAdmin();
renderLayout("password-change.html", admin);

const form = document.getElementById("pwForm");
const message = document.getElementById("pwMessage");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "";
  message.style.color = "";
  const currentPw = document.getElementById("currentPw").value;
  const newPw = document.getElementById("newPw").value;
  const confirmPw = document.getElementById("confirmPw").value;

  if (newPw !== confirmPw) {
    message.textContent = "নতুন পাসওয়ার্ড দুইবার একই হতে হবে।";
    message.style.color = "#a3271f";
    return;
  }
  try {
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPw);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPw);
    message.textContent = "পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে।";
    message.style.color = "#1a6b2c";
    form.reset();
  } catch (err) {
    message.textContent = "বর্তমান পাসওয়ার্ড সঠিক নয়, অথবা কোনো সমস্যা হয়েছে।";
    message.style.color = "#a3271f";
  }
});
