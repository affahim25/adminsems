# Admin Dashboard (Phase 5)

Part of a 4-portal system, all sharing one Firebase project:

1. Student Portal
2. Teacher Portal
3. Exam Committee Portal
4. **Admin Dashboard** (this project) — full management, the only portal
   that can reveal the secret student <-> script mapping, approvals,
   audit logs, reports.

Copy the same real `firebaseConfig` from the other portals into
`js/firebase-config.js` before deploying.

## Runs entirely on the Spark (free) plan — no Cloud Functions

This project has **no `functions/` folder and no Cloud Functions at
all**. Deploying even one Cloud Function forces a Firebase project onto
the Blaze (pay-as-you-go) plan — a billing card must be linked — even if
usage never goes above the free quota. Since this dashboard's only
Cloud Function need was creating logins, that's now done entirely with
the client SDK instead, so the project can stay on Spark (genuinely
free, no card) indefinitely.

### How account creation works without a Cloud Function

Creating a new login is really two things: a Firebase Auth user, and a
Firestore profile doc. The tricky part is that calling
`createUserWithEmailAndPassword()` on the browser's normal Auth instance
signs the **admin out** and signs the **new account in** instead —
unusable for an "add a teacher" form.

`js/firebase-config.js` solves this with `createSecondaryAuthUser()`: it
spins up a second, throwaway Firebase App instance with its own isolated
Auth. The new user is created there, never touching the primary Auth
instance the signed-in admin is using. `js/accounts.js` then writes the
Firestore profile doc (in `students`/`teachers`/`examCommittee`/`admins`,
whichever tab is active) using the primary app, where the admin is still
signed in.

There's no custom claim anymore either — custom claims can only be set
by the Admin SDK, i.e. server-side, so a Cloud-Function-free system
can't use them. `firestore.rules`' `role()` function instead checks
which of those four collections actually has a doc at the caller's uid.
This costs a handful of extra document reads per rule check, which is
still comfortably inside Spark's free 50,000-reads/day quota for a
school-sized project.

### Self-service first-admin registration

`register.html` / `js/register.js` still solves the chicken-and-egg
problem of the very first admin (nobody is an admin yet, so nobody can
use the normal Accounts-page flow). Since this page has no existing
admin session to protect, it creates the Auth user directly on the
primary Auth instance, then — in one Firestore transaction — creates
both `system/bootstrap` and the new `admins/{uid}` doc together.

The one-time guarantee no longer comes from a server-side transaction;
it comes from Firestore's own rules semantics: `firestore.rules` grants
`create` (never `update`) on `system/bootstrap`, and a `create` rule is
only ever invoked when the document doesn't already exist yet. So the
first successful registration permanently closes the door — every later
attempt is an `update`, which nothing allows. If the transaction is
rejected (already bootstrapped, or lost a same-instant race to someone
else), `register.js` deletes the Auth user it just created so the
project isn't left with a login that has no profile.

## How Identity Reveal / Approvals close the anonymity loop

Exam Committee locks `scriptMarks` (marks by scriptId, no student name)
and submits a `resultPublishRequests` doc. Approving that request here:

1. Reads `scriptIdentityMap` for that exam+subject (the ONLY portal that
   can — `firestore.rules` restricts read to `role() == 'admin'`).
2. For each script, reads its `scriptMarks` and merges a subject entry
   into `results/{studentId}_{examId}` (creating the doc if needed).
   `published` stays `false` at this point.
3. Every individual script revealed this way gets its own `auditLogs`
   entry, same as a manual lookup on the Identity Reveal page.

Publishing (making `results` visible to students) is a **separate**
button on the Approvals page — pick an exam, it flips `published: true`
on every matching result. Kept separate from the merge step on purpose,
so a committee's request can be approved/merged without accidentally
making unfinished results public the moment the last subject comes in.

## Folder structure

Same shared pattern as the other portals (`js/auth-guard.js` ->
`requireAdmin()`, `js/layout.js`, one `<page>.html` + `js/<page>.js`
pair per page), plus dashboard-only files:

- `js/audit.js` — `logAudit(admin, action, targetType, targetId, details)`,
  called from every page that touches identity or approvals.
- `js/firebase-config.js` — also exports `createSecondaryAuthUser()`
  (see above), used only by `js/accounts.js`.

Pages: `dashboard`, `profile`, `password-change`, `accounts`,
`approvals`, `identity-reveal`, `audit-logs`, `reports`, plus the public
(no `requireAdmin()`) `register` page for first-time setup.

## What's fully built vs. placeholder

**Fully working:** login, dashboard (system-wide stats + recent audit
feed), profile, password change, accounts (create client-side via
`createSecondaryAuthUser`, edit/delete the Firestore profile doc, for
all four roles — students, teachers, examCommittee, admins — with a tab
switcher), approvals (result publish requests with identity-reveal-and-merge,
a separate publish-by-exam action, and a generic approve/reject queue for
the five student-submitted request collections), identity reveal (lookup
by scriptId or by student+exam, every lookup audit-logged), audit logs
(searchable, most recent 200), reports (student/result/billing counts,
per-exam publish progress — all computed client-side from existing
collections).

**Still needed before production**, none of which live in this portal's
client code:
- Deleting an account here only removes the Firestore profile doc —
  the matching Firebase Auth login still exists (the client SDK can only
  delete a user it's *currently signed into*, which rules out deleting
  someone else's account from this dashboard). A `deletePortalUser` would
  need either a Cloud Function (back onto Blaze) or a manual removal from
  the Firebase Console.
- `js/reports.js` reads full collections client-side on every load —
  fine for a school-sized dataset, not for a large one.
- No server-side re-verification of a `resultPublishRequests` approval
  against `scriptMarks.locked` before merging — `firestore.rules` trusts
  the admin role here, matching how the whole system trusts Exam
  Committee's own lock step.

## Before deploying

1. Real `firebaseConfig` in `js/firebase-config.js`.
2. Deploy `firestore.rules` at the project level — this is the
   canonical, final version covering all four portals.
3. Open `register.html` once and create the first admin there. After
   that, every further account (including more admins) goes through this
   portal's Accounts page instead. Delete or gate `register.html` after
   the first admin is created if you'd rather not expose it publicly
   even temporarily — it becomes permanently inert (and harmless) the
   moment the first admin exists, since `system/bootstrap` can then never
   be created again.
4. Real `icons/icon-192.png` / `icons/icon-512.png` for the PWA manifest.
5. No `firebase deploy --only functions` step anymore, and no Blaze
   upgrade needed for this dashboard — the project can be created and
   stay on Spark from the start.
