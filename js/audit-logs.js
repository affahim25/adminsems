/* Firestore collection: auditLogs/{logId} — read-only view of everything
   this portal has ever done that touches identity or approvals. Not
   editable or deletable from the UI on purpose — it's a record, not a
   worklist. */
import { requireAdmin } from "./auth-guard.js";
import { renderLayout } from "./layout.js";
import { db, collection, query, orderBy, limit, getDocs } from "./firebase-config.js";

const admin = await requireAdmin();
renderLayout("audit-logs.html", admin);

const logsArea = document.getElementById("logsArea");
const filterBox = document.getElementById("filterBox");
let allLogs = [];

function render(list) {
  logsArea.innerHTML = list.length
    ? list
        .map(
          (l) => `<div class="audit-row">
            <span class="action">${l.action}</span> — <span class="meta">${l.targetType} · ${l.targetId || ""} · ${l.actorName || l.actorId} · ${(l.at || "").slice(0, 16).replace("T", " ")}</span>
          </div>`
        )
        .join("")
    : `<div class="placeholder-note">কোনো লগ নেই।</div>`;
}

filterBox.addEventListener("input", () => {
  const term = filterBox.value.trim().toLowerCase();
  render(
    term
      ? allLogs.filter((l) => [l.action, l.targetType, l.targetId].filter(Boolean).some((v) => String(v).toLowerCase().includes(term)))
      : allLogs
  );
});

async function load() {
  const snap = await getDocs(query(collection(db, "auditLogs"), orderBy("at", "desc"), limit(200)));
  allLogs = snap.docs.map((d) => d.data());
  render(allLogs);
}

load();
