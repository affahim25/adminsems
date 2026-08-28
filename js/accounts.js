/* Firestore collections: students/{id}, teachers/{id}, examCommittee/{id},
   admins/{id} — full CRUD here, matching the plan's "Dashboard/Admin ->
   can edit/delete everything".

   Creating a brand-new account: createSecondaryAuthUser() (firebase-config.js)
   makes the Firebase Auth user via a throwaway secondary App instance, so
   the signed-in admin's own session on the primary app is never touched.
   There's no custom claim to set (that always required the Admin SDK) —
   the Firestore profile doc itself IS the role record now; firestore.rules'
   role() function looks up which collection contains the uid. */
import { requireAdmin } from "./auth-guard.js";
import { renderLayout } from "./layout.js";
import { logAudit } from "./audit.js";
import {
  db,
  createSecondaryAuthUser,
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc
} from "./firebase-config.js";

const admin = await requireAdmin();
renderLayout("accounts.html", admin);

const ROLE_CONFIG = {
  students: {
    label: "Student",
    fields: [
      { key: "roll", label: "Roll" },
      { key: "className", label: "Class" },
      { key: "program", label: "Program" },
      { key: "batch", label: "Batch" },
      { key: "phone", label: "Phone" },
      { key: "guardianPhone", label: "Guardian Phone" }
    ],
    columns: ["roll", "name", "className", "email"]
  },
  teachers: {
    label: "Teacher",
    fields: [
      { key: "subject", label: "Subject" },
      { key: "phone", label: "Phone" }
    ],
    columns: ["name", "subject", "email"]
  },
  examCommittee: {
    label: "Exam Committee",
    fields: [{ key: "phone", label: "Phone" }],
    columns: ["name", "phone", "email"]
  },
  admins: {
    label: "Admin",
    fields: [],
    columns: ["name", "email"]
  }
};

let currentRole = "students";
let allDocs = [];

const roleTabs = document.getElementById("roleTabs");
const createTitle = document.getElementById("createTitle");
const extraFields = document.getElementById("extraFields");
const createForm = document.getElementById("createForm");
const createMessage = document.getElementById("createMessage");
const searchBox = document.getElementById("searchBox");
const listHead = document.getElementById("listHead");
const listBody = document.getElementById("listBody");
const editCard = document.getElementById("editCard");
const editFields = document.getElementById("editFields");
const editForm = document.getElementById("editForm");
const editMessage = document.getElementById("editMessage");

function renderExtraFields(container, fields, values = {}) {
  container.innerHTML = fields
    .map(
      (f) => `<div class="form-group"><label>${f.label}</label><input data-field="${f.key}" value="${values[f.key] ?? ""}" /></div>`
    )
    .join("");
}

function switchRole(role) {
  currentRole = role;
  roleTabs.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.role === role));
  createTitle.textContent = `নতুন ${ROLE_CONFIG[role].label} যোগ করুন`;
  renderExtraFields(extraFields, ROLE_CONFIG[role].fields);
  editCard.style.display = "none";
  loadList();
}

roleTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-role]");
  if (btn) switchRole(btn.dataset.role);
});

async function loadList() {
  const cfg = ROLE_CONFIG[currentRole];
  const snap = await getDocs(collection(db, currentRole));
  allDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  listHead.innerHTML = `<tr>${cfg.columns.map((c) => `<th>${c}</th>`).join("")}<th></th></tr>`;
  renderRows(allDocs);
}

function renderRows(list) {
  const cfg = ROLE_CONFIG[currentRole];
  listBody.innerHTML = list.length
    ? list
        .map(
          (item) => `<tr>
            ${cfg.columns.map((c) => `<td>${item[c] ?? ""}</td>`).join("")}
            <td><button class="btn btn-secondary" data-edit="${item.id}" style="padding:5px 12px;font-size:12px;">Edit</button></td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="${cfg.columns.length + 1}" class="placeholder-note">কেউ নেই।</td></tr>`;

  listBody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openEdit(btn.getAttribute("data-edit")));
  });
}

searchBox.addEventListener("input", () => {
  const term = searchBox.value.trim().toLowerCase();
  if (!term) {
    renderRows(allDocs);
    return;
  }
  renderRows(allDocs.filter((d) => [d.name, d.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))));
});

function openEdit(id) {
  const item = allDocs.find((d) => d.id === id);
  if (!item) return;
  document.getElementById("e-id").value = id;
  const cfg = ROLE_CONFIG[currentRole];
  editFields.innerHTML =
    `<div class="form-group"><label>Name</label><input data-field="name" value="${item.name ?? ""}" /></div>` +
    cfg.fields.map((f) => `<div class="form-group"><label>${f.label}</label><input data-field="${f.key}" value="${item[f.key] ?? ""}" /></div>`).join("") +
    `<div class="form-group"><label>Email</label><input value="${item.email ?? ""}" disabled /></div>`;
  editMessage.textContent = "";
  editCard.style.display = "block";
  editCard.scrollIntoView({ behavior: "smooth" });
}

document.getElementById("cancelEditBtn").addEventListener("click", () => {
  editCard.style.display = "none";
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("e-id").value;
  const updates = {};
  editFields.querySelectorAll("[data-field]").forEach((inp) => {
    updates[inp.getAttribute("data-field")] = inp.value.trim();
  });
  const submitBtn = editForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  try {
    await updateDoc(doc(db, currentRole, id), updates);
    await logAudit(admin, "update_account", currentRole, id, updates);
    editMessage.style.color = "#1a6b2c";
    editMessage.textContent = "সংরক্ষণ হয়েছে।";
    await loadList();
  } catch (err) {
    editMessage.style.color = "#a3271f";
    editMessage.textContent = "সংরক্ষণ করা যায়নি: " + err.message;
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById("deleteBtn").addEventListener("click", async () => {
  const id = document.getElementById("e-id").value;
  const item = allDocs.find((d) => d.id === id);
  if (!confirm(`${item?.name ?? "এই রেকর্ড"}-এর প্রোফাইল ডকুমেন্ট মুছে ফেলতে চান?`)) return;
  try {
    await deleteDoc(doc(db, currentRole, id));
    await logAudit(admin, "delete_account_doc", currentRole, id, {});
    editCard.style.display = "none";
    await loadList();
  } catch (err) {
    editMessage.style.color = "#a3271f";
    editMessage.textContent = "মুছে ফেলা যায়নি: " + err.message;
  }
});

createForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cfg = ROLE_CONFIG[currentRole];
  const submitBtn = createForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  createMessage.textContent = "তৈরি হচ্ছে...";
  createMessage.style.color = "";

  const profile = { name: document.getElementById("c-name").value.trim() };
  extraFields.querySelectorAll("[data-field]").forEach((inp) => {
    profile[inp.getAttribute("data-field")] = inp.value.trim();
  });

  const email = document.getElementById("c-email").value.trim();
  const password = document.getElementById("c-password").value;

  let uid;
  try {
    uid = await createSecondaryAuthUser(email, password);
  } catch (err) {
    createMessage.style.color = "#a3271f";
    createMessage.textContent = "Auth ইউজার তৈরি করা যায়নি: " + err.message;
    submitBtn.disabled = false;
    return;
  }

  try {
    await setDoc(doc(db, currentRole, uid), {
      ...profile,
      email,
      createdAt: new Date().toISOString(),
      createdBy: admin.id
    });
    await logAudit(admin, "create_account", currentRole, uid, { email });
    createMessage.style.color = "#1a6b2c";
    createMessage.textContent = `${cfg.label} তৈরি হয়েছে।`;
    createForm.reset();
    renderExtraFields(extraFields, cfg.fields);
    await loadList();
  } catch (err) {
    /* Profile doc failed after the Auth user was already created — this
       portal's client SDK can only delete a user it's currently signed
       into (the throwaway secondary session, already gone), so an admin
       may need to remove the orphaned login from the Firebase Console
       manually in this rare case. */
    createMessage.style.color = "#a3271f";
    createMessage.textContent =
      "প্রোফাইল তৈরি করা যায়নি: " + err.message + " (Auth ইউজার ইতিমধ্যে তৈরি হয়ে গেছে, প্রয়োজনে Firebase Console থেকে ম্যানুয়ালি মুছুন)";
  } finally {
    submitBtn.disabled = false;
  }
});

switchRole("students");
