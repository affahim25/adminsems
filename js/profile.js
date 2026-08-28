import { requireAdmin } from "./auth-guard.js";
import { renderLayout } from "./layout.js";

const admin = await requireAdmin();
renderLayout("profile.html", admin);

document.getElementById("profileCard").innerHTML = `
  <div class="form-group"><label>Name</label><input value="${admin.name ?? ""}" disabled /></div>
  <div class="form-group"><label>Email</label><input value="${admin.email ?? ""}" disabled /></div>
  <div class="placeholder-note">প্রোফাইল পরিবর্তন করতে Accounts পেজ থেকে নিজের রেকর্ড এডিট করুন।</div>
`;
