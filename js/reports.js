/* Everything here is computed client-side from existing collections —
   no new Firestore collection is introduced for reports. Fine for a
   school-sized dataset; a large deployment would want these aggregated
   by a scheduled Cloud Function instead of reading full collections on
   every page load. */
import { requireAdmin } from "./auth-guard.js";
import { renderLayout } from "./layout.js";
import { db, collection, getDocs, query, where } from "./firebase-config.js";

const admin = await requireAdmin();
renderLayout("reports.html", admin);

async function loadOverall() {
  const box = document.getElementById("overallStats");
  const [studentsSnap, resultsSnap, billingSnap] = await Promise.all([
    getDocs(collection(db, "students")),
    getDocs(collection(db, "results")),
    getDocs(collection(db, "billing"))
  ]);

  const publishedCount = resultsSnap.docs.filter((d) => d.data().published).length;

  box.innerHTML = `
    <div class="stat-tile"><div class="stat-num">${studentsSnap.size}</div><div class="stat-label">মোট স্টুডেন্ট</div></div>
    <div class="stat-tile"><div class="stat-num">${resultsSnap.size}</div><div class="stat-label">রেজাল্ট রেকর্ড</div></div>
    <div class="stat-tile"><div class="stat-num">${publishedCount}</div><div class="stat-label">প্রকাশিত</div></div>
    <div class="stat-tile"><div class="stat-num">${billingSnap.size}</div><div class="stat-label">বিলিং রেকর্ড</div></div>
  `;
}

async function loadExamSummary() {
  const body = document.getElementById("examSummaryBody");
  const [examsSnap, resultsSnap] = await Promise.all([getDocs(collection(db, "exams")), getDocs(collection(db, "results"))]);

  const exams = examsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const results = resultsSnap.docs.map((d) => d.data());

  if (!exams.length) {
    body.innerHTML = `<tr><td colspan="3" class="placeholder-note">কোনো পরীক্ষা নেই।</td></tr>`;
    return;
  }

  body.innerHTML = exams
    .map((exam) => {
      const examResults = results.filter((r) => r.examId === exam.id);
      const published = examResults.filter((r) => r.published).length;
      const avgSubjects = examResults.length
        ? (examResults.reduce((sum, r) => sum + (r.subjects?.length || 0), 0) / examResults.length).toFixed(1)
        : "-";
      return `<tr><td>${exam.name}</td><td>${published} / ${examResults.length}</td><td>${avgSubjects}</td></tr>`;
    })
    .join("");
}

loadOverall();
loadExamSummary();
