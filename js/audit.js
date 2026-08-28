/* Firestore collection: auditLogs/{logId} (auto-ID)
   Every sensitive read/write this portal does (identity reveals, request
   approvals/rejections, account creation/deletion, result publishing)
   should call logAudit() right after. Kept as one shared helper so no
   page forgets to log something the Phase 5 plan explicitly calls for
   ("Audit logs"). */
import { db, addDoc, collection } from "./firebase-config.js";

export async function logAudit(admin, action, targetType, targetId, details = {}) {
  try {
    await addDoc(collection(db, "auditLogs"), {
      action,
      actorId: admin.id,
      actorName: admin.name || "",
      targetType,
      targetId,
      details,
      at: new Date().toISOString()
    });
  } catch (err) {
    /* Never let a logging failure block the actual action the admin was
       trying to do — just surface it in the console. */
    console.error("audit log failed:", err);
  }
}
