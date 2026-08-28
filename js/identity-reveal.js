/* Firestore collection: scriptIdentityMap/{scriptId}
   Per firestore.rules, ONLY the admin role can read this collection —
   this page is the sole place in the entire system where a scriptId and
   a studentId are ever looked at together outside of the moment they
   were created (Teacher Portal's QR Scanner, which writes but can't
   read it back). Every successful reveal writes an auditLogs/* entry. */
import { requireAdmin } from "./auth-guard.js";
import { renderLayout } from "./layout.js";
import { logAudit } from "./audit.js";
import { db, doc, getDoc, collection, query, where, getDocs } from "./firebase-config.js";

const admin = await requireAdmin();
renderLayout("identity-reveal.html", admin);

const resultCard = document.getElementById("resultCard");

function showResult(html) {
  resultCard.style.display = "block";
  resultCard.innerHTML = html;
}

async function renderMapping(mapping) {
  const [studentSnap, scriptSnap] = await Promise.all([
    getDoc(doc(db, "students", mapping.studentId)),
    getDoc(doc(db, "answerScripts", mapping.scriptId))
  ]);
  const student = studentSnap.exists() ? studentSnap.data() : null;
  const script = scriptSnap.exists() ? scriptSnap.data() : null;

  showResult(`
    <div class="kv"><span>স্ক্রিপ্ট আইডি</span><strong style="font-family:monospace;">${mapping.scriptId}</strong></div>
    <div class="kv"><span>স্টুডেন্ট</span><strong>${student ? `${student.name} (${student.roll ?? ""})` : mapping.studentId}</strong></div>
    <div class="kv"><span>পরীক্ষা</span><strong>${mapping.examId}</strong></div>
    <div class="kv"><span>বিষয়</span><strong>${mapping.subjectCode}</strong></div>
    <div class="kv"><span>সিট</span><strong>${script?.seatToken ?? "-"}</strong></div>
    <div class="kv"><span>তৈরি হয়েছে</span><strong>${(mapping.createdAt || "").slice(0, 16).replace("T", " ")}</strong></div>
  `);

  await logAudit(admin, "reveal_identity", "scriptIdentityMap", mapping.scriptId, {
    studentId: mapping.studentId,
    examId: mapping.examId
  });
}

document.getElementById("lookupByScriptBtn").addEventListener("click", async () => {
  const scriptId = document.getElementById("scriptIdBox").value.trim();
  if (!scriptId) return;
  showResult(`<div class="placeholder-note">খোঁজা হচ্ছে...</div>`);
  const snap = await getDoc(doc(db, "scriptIdentityMap", scriptId));
  if (!snap.exists()) {
    showResult(`<div class="placeholder-note">এই স্ক্রিপ্ট আইডির কোনো ম্যাপিং পাওয়া যায়নি।</div>`);
    return;
  }
  await renderMapping(snap.data());
});

document.getElementById("lookupByStudentBtn").addEventListener("click", async () => {
  const studentId = document.getElementById("studentIdBox").value.trim();
  const examId = document.getElementById("examIdBox").value.trim();
  if (!studentId || !examId) return;
  showResult(`<div class="placeholder-note">খোঁজা হচ্ছে...</div>`);

  const snap = await getDocs(
    query(collection(db, "scriptIdentityMap"), where("studentId", "==", studentId), where("examId", "==", examId))
  );
  if (snap.empty) {
    showResult(`<div class="placeholder-note">এই স্টুডেন্ট+পরীক্ষার জন্য কোনো ম্যাপিং পাওয়া যায়নি।</div>`);
    return;
  }

  const mappings = snap.docs.map((d) => d.data());
  const parts = await Promise.all(
    mappings.map(async (m) => {
      const scriptSnap = await getDoc(doc(db, "answerScripts", m.scriptId));
      const seat = scriptSnap.exists() ? scriptSnap.data().seatToken : "-";
      await logAudit(admin, "reveal_identity", "scriptIdentityMap", m.scriptId, { studentId, examId });
      return `<div class="kv"><span>${m.subjectCode} (সিট ${seat})</span><strong style="font-family:monospace;">${m.scriptId}</strong></div>`;
    })
  );
  showResult(parts.join(""));
});
