/* Two very different kinds of approvals live on this page:

   1. Result Publish Requests (from Exam Committee's Result Confirmation).
      Approving one is the ONLY place outside Identity Reveal that reads
      scriptIdentityMap — here it's used to merge anonymous scriptMarks
      into real results/{studentId}_{examId} docs. Every script revealed
      this way is individually audit-logged, same as Identity Reveal.

   2. Student-submitted request collections (specialExamApplications,
      courseDrops, semesterDrops, programChangeRequests, transportRequests)
      — ordinary approve/reject on whatever fields exist on each doc.
      Field shapes for these were defined back in the Student Portal, so
      this renders them generically (a definitions list of every field on
      the doc) rather than assuming exact field names. */
import { requireAdmin } from "./auth-guard.js";
import { renderLayout } from "./layout.js";
import { logAudit } from "./audit.js";
import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from "./firebase-config.js";

const admin = await requireAdmin();
renderLayout("approvals.html", admin);

/* ---------------- Result Publish Requests ---------------- */

const publishRequestsArea = document.getElementById("publishRequestsArea");

async function loadPublishRequests() {
  const snap = await getDocs(query(collection(db, "resultPublishRequests"), where("status", "==", "PENDING")));
  if (snap.empty) {
    publishRequestsArea.innerHTML = `<div class="placeholder-note">কোনো অপেক্ষমাণ অনুরোধ নেই।</div>`;
    return;
  }
  const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  publishRequestsArea.innerHTML = requests
    .map(
      (r) => `
      <div class="card" style="margin-bottom:10px;">
        <strong>${r.subjectTitle}</strong> — ${r.examName}
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${r.scriptCount} টি স্ক্রিপ্ট · পাঠিয়েছে: ${r.submittedBy}</div>
        <div style="display:flex;gap:10px;margin-top:10px;">
          <button class="btn btn-primary" data-approve="${r.id}">Approve &amp; Merge Grades</button>
          <button class="btn" data-reject="${r.id}" style="background:#fbe1df;color:#a3271f;">Reject</button>
        </div>
      </div>`
    )
    .join("");

  publishRequestsArea.querySelectorAll("[data-approve]").forEach((btn) => {
    btn.addEventListener("click", () => approveRequest(requests.find((r) => r.id === btn.getAttribute("data-approve")), btn));
  });
  publishRequestsArea.querySelectorAll("[data-reject]").forEach((btn) => {
    btn.addEventListener("click", () => rejectRequest(btn.getAttribute("data-reject"), btn));
  });
}

async function approveRequest(request, btn) {
  if (!confirm(`"${request.subjectTitle}" (${request.examName})-এর মার্কস প্রকাশ্যে merge করতে চান? এতে scriptIdentityMap থেকে পরিচয় বের করা হবে।`)) return;
  btn.disabled = true;

  try {
    const mappingsSnap = await getDocs(
      query(
        collection(db, "scriptIdentityMap"),
        where("examId", "==", request.examId),
        where("subjectCode", "==", request.subjectCode)
      )
    );

    let merged = 0;
    for (const mDoc of mappingsSnap.docs) {
      const mapping = mDoc.data();
      const marksSnap = await getDoc(doc(db, "scriptMarks", mapping.scriptId));
      if (!marksSnap.exists()) continue;
      const marks = marksSnap.data();

      const resultId = `${mapping.studentId}_${mapping.examId}`;
      const existingSnap = await getDoc(doc(db, "results", resultId));
      const existing = existingSnap.exists() ? existingSnap.data() : { subjects: [], published: false };
      const subjects = (existing.subjects || []).filter((s) => s.code !== mapping.subjectCode);
      subjects.push({
        code: mapping.subjectCode,
        title: request.subjectTitle,
        marks: marks.marksObtained,
        totalMarks: marks.totalMarks,
        grade: marks.grade
      });

      await setDoc(
        doc(db, "results", resultId),
        {
          studentId: mapping.studentId,
          examId: mapping.examId,
          examName: request.examName,
          subjects,
          published: existing.published || false
        },
        { merge: true }
      );

      await logAudit(admin, "merge_result", "results", resultId, {
        scriptId: mapping.scriptId,
        subjectCode: mapping.subjectCode
      });
      merged++;
    }

    await updateDoc(doc(db, "resultPublishRequests", request.id), {
      status: "APPROVED",
      reviewedBy: admin.id,
      reviewedAt: new Date().toISOString()
    });
    await logAudit(admin, "approve_publish_request", "resultPublishRequests", request.id, { merged });

    await loadPublishRequests();
    await loadExamOptions();
  } catch (err) {
    alert("Approve করা যায়নি: " + err.message);
    btn.disabled = false;
  }
}

async function rejectRequest(requestId, btn) {
  const note = prompt("প্রত্যাখ্যানের কারণ (ঐচ্ছিক):") || "";
  btn.disabled = true;
  try {
    await updateDoc(doc(db, "resultPublishRequests", requestId), {
      status: "REJECTED",
      reviewedBy: admin.id,
      reviewedAt: new Date().toISOString(),
      note
    });
    await logAudit(admin, "reject_publish_request", "resultPublishRequests", requestId, { note });
    await loadPublishRequests();
  } catch (err) {
    alert("Reject করা যায়নি: " + err.message);
    btn.disabled = false;
  }
}

/* ---------------- Publish results for a whole exam ---------------- */

const publishExamSelect = document.getElementById("publishExamSelect");
const publishExamBtn = document.getElementById("publishExamBtn");
const publishExamMessage = document.getElementById("publishExamMessage");

async function loadExamOptions() {
  const snap = await getDocs(collection(db, "exams"));
  const exams = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  publishExamSelect.innerHTML = exams.length
    ? exams.map((e) => `<option value="${e.id}">${e.name}</option>`).join("")
    : `<option value="">কোনো পরীক্ষা নেই</option>`;
}

publishExamBtn.addEventListener("click", async () => {
  const examId = publishExamSelect.value;
  if (!examId) return;
  if (!confirm("এই পরীক্ষার সব প্রস্তুত ফলাফল স্টুডেন্টদের কাছে প্রকাশ করতে চান?")) return;

  publishExamBtn.disabled = true;
  try {
    const snap = await getDocs(query(collection(db, "results"), where("examId", "==", examId)));
    await Promise.all(snap.docs.map((d) => updateDoc(doc(db, "results", d.id), { published: true })));
    await logAudit(admin, "publish_results", "exams", examId, { count: snap.size });
    publishExamMessage.style.color = "#1a6b2c";
    publishExamMessage.textContent = `${snap.size} জন স্টুডেন্টের ফলাফল প্রকাশ করা হয়েছে।`;
  } catch (err) {
    publishExamMessage.style.color = "#a3271f";
    publishExamMessage.textContent = "প্রকাশ করা যায়নি: " + err.message;
  } finally {
    publishExamBtn.disabled = false;
  }
});

/* ---------------- Generic student request approvals ---------------- */

const requestTabs = document.getElementById("requestTabs");
const requestsArea = document.getElementById("requestsArea");
let currentCollection = "specialExamApplications";

const SKIP_KEYS = new Set(["status", "studentId"]);

async function loadRequests() {
  requestsArea.innerHTML = `<div class="placeholder-note">লোড হচ্ছে...</div>`;
  const snap = await getDocs(query(collection(db, currentCollection), where("status", "==", "PENDING")));
  if (snap.empty) {
    requestsArea.innerHTML = `<div class="placeholder-note">এই ক্যাটাগরিতে অপেক্ষমাণ কোনো অনুরোধ নেই।</div>`;
    return;
  }
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  requestsArea.innerHTML = items
    .map((item) => {
      const rows = Object.entries(item)
        .filter(([k]) => !SKIP_KEYS.has(k) && k !== "id")
        .map(([k, v]) => `<div class="kv"><span>${k}</span><strong>${typeof v === "object" ? JSON.stringify(v) : v}</strong></div>`)
        .join("");
      return `
        <div class="card reveal-card" style="margin-bottom:10px;">
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:6px;">Student: ${item.studentId}</div>
          ${rows}
          <div style="display:flex;gap:10px;margin-top:10px;">
            <button class="btn btn-primary" data-approve="${item.id}">Approve</button>
            <button class="btn" data-reject="${item.id}" style="background:#fbe1df;color:#a3271f;">Reject</button>
          </div>
        </div>`;
    })
    .join("");

  requestsArea.querySelectorAll("[data-approve]").forEach((btn) => {
    btn.addEventListener("click", () => decideRequest(btn.getAttribute("data-approve"), "APPROVED", btn));
  });
  requestsArea.querySelectorAll("[data-reject]").forEach((btn) => {
    btn.addEventListener("click", () => decideRequest(btn.getAttribute("data-reject"), "REJECTED", btn));
  });
}

async function decideRequest(id, status, btn) {
  btn.disabled = true;
  try {
    await updateDoc(doc(db, currentCollection, id), {
      status,
      reviewedBy: admin.id,
      reviewedAt: new Date().toISOString()
    });
    await logAudit(admin, status === "APPROVED" ? "approve_request" : "reject_request", currentCollection, id, {});
    await loadRequests();
  } catch (err) {
    alert("আপডেট করা যায়নি: " + err.message);
    btn.disabled = false;
  }
}

requestTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-col]");
  if (!btn) return;
  requestTabs.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
  currentCollection = btn.dataset.col;
  loadRequests();
});

await loadPublishRequests();
await loadExamOptions();
await loadRequests();
