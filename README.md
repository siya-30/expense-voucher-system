# Expense Voucher Management System

Full-stack web app that digitises expense vouchers: employees create and submit them, the Director approves or rejects (with signature / reason), and the Accounts Team monitors approved vouchers for reimbursement.

**Stack:** React 18 + Vite + React Router · Node.js + Express · PostgreSQL · JWT auth · Multer image uploads

## Setup

Prerequisites: Node.js 18+, PostgreSQL 13+.

```bash
# 1. Database
createdb expense_vouchers

# 2. Backend
cd server
cp .env.example .env        # edit DATABASE_URL and JWT_SECRET
npm install
npm run setup               # applies db/schema.sql and seeds demo users
npm run dev                 # http://localhost:5000

# 3. Frontend (new terminal)
cd client
cp .env.example .env        # leave VITE_API_URL empty in dev
npm install
npm run dev                 # http://localhost:5173
```

### Demo accounts (created by `npm run setup`)

| Role | Email | Password |
|---|---|---|
| Director | director@pspl.com | Director@123 |
| Accounts Team | accounts@pspl.com | Accounts@123 |
| Employee | employee1@pspl.com | Employee@123 |
| Employee | employee2@pspl.com | Employee@123 |

### Quick walkthrough
1. Log in as an employee → **Create voucher** → upload a signature → **Submit for approval**.
2. Log in as the Director → **Pending approvals** → open the voucher → **Approve** (signature) or **Reject** (reason).
3. Log in as Accounts → **All vouchers** → view/print the approved voucher.
4. Log in as the employee again → status and rejection reason are visible.

## Project structure

```
server/  db/schema.sql · src/{index,db,migrate,seed,constants}.js
         src/middleware/{auth,upload,errors}.js · src/routes/{auth,vouchers,dashboard}.js
client/  src/{App,api,auth,utils}.js(x) · components/ · pages/ · styles.css
```

## Database schema

Defined in `server/db/schema.sql` (idempotent; run via `npm run migrate`).

- **users** — `id, name, email (unique), password_hash (bcrypt), role (EMPLOYEE|DIRECTOR|ACCOUNTS), employee_code, department, signature_path, created_at`. `signature_path` is an optional saved signature reused on vouchers / approvals.
- **vouchers** — `id, voucher_number (unique, auto), user_id → users, voucher_date, expense_date, department, title, category, description, amount (NUMERIC(12,2) CHECK > 0), status (Draft|Submitted|Pending Approval|Approved|Rejected), employee_signature_path, director_id → users, director_signature_path, approval_date, rejection_reason, submitted_at, created_at, updated_at`.
  Database constraints back the business rules: rejected ⇒ reason present, approved ⇒ director signature present, any non-draft ⇒ employee signature present.
- **voucher_history** — audit trail of every status transition: `voucher_id, from_status, to_status, actor_id, note, created_at`. Powers the timeline and the Director's "approved/rejected today" and "recent activity".
- **voucher_number_seq** — sequence used to generate numbers like `EV-2026-00001`.

## API documentation

Base URL `http://localhost:5000/api`. All endpoints except `login` and `health` need `Authorization: Bearer <jwt>`. Errors: `{ "message": "...", "details": { field: "..." } }` with 400 (validation), 401, 403 (wrong role), 404, 409 (invalid state transition).

| Method & path | Role | Description |
|---|---|---|
| `POST /auth/login` | public | `{email,password}` → `{token,user}` |
| `GET /auth/me` | any | Current user |
| `POST /auth/signature` | any | multipart `signature` (png/jpg/webp ≤ 2MB): saves profile signature |
| `GET /meta` | any | Categories, departments, statuses |
| `GET /dashboard` | any | Role-specific stats and recent activity |
| `GET /vouchers` | any | List, scoped by role. Query: `search` (voucher no / employee name / title), `department`, `category`, `status`, `dateFrom`, `dateTo` (expense date), `minAmount`, `maxAmount`, `sortBy` (`voucherNumber, employeeName, expenseDate, amount, status, createdAt, updatedAt`), `order` (`asc|desc`), `page`, `limit` (≤ 50) |
| `GET /vouchers/:id` | any (scoped) | Full details + history |
| `POST /vouchers` | Employee | multipart: `department, title, expenseDate, amount, category, description, employeeSignature?` → creates **Draft** |
| `PUT /vouchers/:id` | Employee (owner) | Same body; **Draft only** |
| `DELETE /vouchers/:id` | Employee (owner) | **Draft only** |
| `POST /vouchers/:id/submit` | Employee (owner) | Draft → Submitted → Pending Approval; requires employee signature |
| `POST /vouchers/:id/approve` | Director | multipart `signature?` (falls back to saved signature; required one way or the other) |
| `POST /vouchers/:id/reject` | Director | `{reason}` (required) |

Authorisation is enforced on the server (JWT + role middleware + row scoping), and mirrored in the UI with protected routes.

## Assumptions

- **Draft privacy:** Drafts are visible only to their creator. Director and Accounts see every voucher *except* drafts (nothing to act on yet). A direct request for someone else's voucher returns 404.
- **Statuses:** Submitting moves a voucher through *Submitted* straight to *Pending Approval* (both recorded in history); the voucher list shows *Pending Approval*.
- **Employee signature** can be uploaded on the voucher or saved once on the profile ("My signature") and reused. Same for the Director at approval time.
- **"Total Amount Claimed"** = sum of the employee's non-draft vouchers. **"Approved/Rejected Today"** counts decisions made today (from the audit history).
- **Rejected vouchers are final** (read-only); the employee creates a new voucher to resubmit.
- **Signature files** are served from `/uploads` with random 128-bit filenames; for production, move them to private object storage with signed URLs.
- Currency is INR. Users are created by seed script (no self-registration, not in scope).
- "Download" is provided as browser **Print** (print stylesheet; "Save as PDF" works).
