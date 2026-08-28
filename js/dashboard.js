import { requireAdmin } from "./auth-guard.js";
import { renderLayout } from "./layout.js";
import { db, collection, getDocs, query, where, orderBy, limit } from "./firebase-config.js";

const admin = await requireAdmin();
renderLayout("dashboard.html", admin);
document.getElementById("welcomeName").textContent = admin.name ? `, ${admin.name}` : "";

async function loadStats() {
  const statsRow = document.getElementById("statsRow");
  const [studentsSnap, teachersSnap, committeeSnap, pendingRequestsSnap] = await Promise.all([
    getDocs(collection(db, "students")),
    getDocs(collection(db, "teachers")),
    getDocs(collection(db, "examCommittee")),
    getDocs(query(collection(db, "resultPublishRequests"), where("status", "==", "PENDING")))
  ]);

  statsRow.innerHTML = `
    <div class="stat-tile"><div class="stat-num">${studentsSnap.size}</div><div class="stat-label">স্টুডেন্ট</div></div>
    <div class="stat-tile"><div class="stat-num">${teachersSnap.size}</div><div class="stat-label">টিচার</div></div>
    <div class="stat-tile"><div class="stat-num">${committeeSnap.size}</div><div class="stat-label">Exam Committee</div></div>
    <div class="stat-tile"><div class="stat-num">${pendingRequestsSnap.size}</div><div class="stat-label">অপেক্ষমাণ Approval</div></div>
  `;
}

async function loadRecentAudit() {
  const box = document.getElementById("recentAudit");
  try {
    const snap = await getDocs(query(collection(db, "auditLogs"), orderBy("at", "desc"), limit(8)));
    if (snap.empty) {
      box.innerHTML = `<div class="placeholder-note">এখনো কোনো অডিট লগ নেই।</div>`;
      return;
    }
    box.innerHTML = snap.docs
      .map((d) => {
        const l = d.data();
        return `<div class="audit-row"><span class="action">${l.action}</span> — <span class="meta">${l.targetType} · ${(l.at || "").slice(0, 16).replace("T", " ")}</span></div>`;
      })
      .join("");
  } catch {
    box.innerHTML = `<div class="placeholder-note">লগ লোড করা যায়নি।</div>`;
  }
}

loadStats();
loadRecentAudit();
