import { auth, signOut } from "./firebase-config.js";

const NAV_ITEMS = [
  { href: "dashboard.html", label: "Home" },
  { href: "profile.html", label: "Profile" },
  { href: "password-change.html", label: "Password Change" },
  { href: "accounts.html", label: "Accounts (Full Management)" },
  { href: "approvals.html", label: "Approvals" },
  { href: "identity-reveal.html", label: "Identity Reveal" },
  { href: "audit-logs.html", label: "Audit Logs" },
  { href: "reports.html", label: "Reports" }
];

export function renderLayout(activeHref, admin) {
  const initials = (admin.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  document.getElementById("header-root").innerHTML = `
    <header class="app-header">
      <div style="display:flex;align-items:center;gap:10px;">
        <button class="menu-toggle" id="menuToggleBtn" aria-label="Menu">&#9776;</button>
        <div class="brand">
          <div class="logo">AD</div>
          <span class="full-name">Admin Dashboard</span>
        </div>
      </div>
      <div class="user">
        <div class="avatar">${initials}</div>
        <div>
          <div>${admin.name || ""}</div>
          <a href="#" class="logout-link" id="logoutBtn">Logout</a>
        </div>
      </div>
    </header>
  `;

  document.getElementById("sidebar-backdrop-root").innerHTML = `<div class="sidebar-backdrop" id="sidebarBackdrop"></div>`;

  const navHtml = NAV_ITEMS.map((item) => {
    const isActive = item.href === activeHref;
    return `<li><a class="nav-link${isActive ? " active" : ""}" href="${item.href}">${item.label}</a></li>`;
  }).join("");

  document.getElementById("sidebar-root").innerHTML = `<nav class="sidebar" id="sidebarNav"><ul>${navHtml}</ul></nav>`;

  const sidebar = document.getElementById("sidebarNav");
  const backdrop = document.getElementById("sidebarBackdrop");
  document.getElementById("menuToggleBtn").addEventListener("click", () => {
    sidebar.classList.toggle("open");
    backdrop.classList.toggle("open");
  });
  backdrop.addEventListener("click", () => {
    sidebar.classList.remove("open");
    backdrop.classList.remove("open");
  });

  document.getElementById("logoutBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    window.location.href = "login.html";
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}
