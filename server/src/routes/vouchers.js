const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { upload, withCleanup } = require('../middleware/upload');
const { HttpError, asyncH } = require('../middleware/errors');
const { CATEGORIES } = require('../constants');

const router = express.Router();
router.use(authenticate);
router.param('id', (req, res, next, v) =>
  /^\d+$/.test(v) ? next() : next(new HttpError(400, 'Invalid voucher id')));

const BASE_SELECT = `
  SELECT v.*, u.name AS employee_name, u.employee_code, d.name AS director_name
  FROM vouchers v
  JOIN users u ON u.id = v.user_id
  LEFT JOIN users d ON d.id = v.director_id`;

const toDto = (r) => ({
  id: r.id,
  voucherNumber: r.voucher_number,
  voucherDate: r.voucher_date,
  expenseDate: r.expense_date,
  department: r.department,
  title: r.title,
  category: r.category,
  description: r.description,
  amount: Number(r.amount),
  status: r.status,
  employeeId: r.user_id,
  employeeName: r.employee_name,
  employeeCode: r.employee_code,
  employeeSignature: r.employee_signature_path,
  directorName: r.director_name,
  directorSignature: r.director_signature_path,
  approvalDate: r.approval_date,
  rejectionReason: r.rejection_reason,
  submittedAt: r.submitted_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// ---------- helpers ----------
async function loadVoucher(user, id) {
  const { rows } = await db.query(`${BASE_SELECT} WHERE v.id = $1`, [id]);
  const v = rows[0];
  const hidden =
    !v ||
    (user.role === 'EMPLOYEE' && v.user_id !== user.id) || // employees: own vouchers only
    (user.role !== 'EMPLOYEE' && v.status === 'Draft');    // drafts are private to the employee
  if (hidden) throw new HttpError(404, 'Voucher not found');
  return v;
}

const logHistory = (voucherId, from, to, actorId, note = null) =>
  db.query(
    'INSERT INTO voucher_history (voucher_id, from_status, to_status, actor_id, note) VALUES ($1,$2,$3,$4,$5)',
    [voucherId, from, to, actorId, note]
  );

async function savedSignature(userId) {
  const { rows } = await db.query('SELECT signature_path FROM users WHERE id = $1', [userId]);
  return rows[0]?.signature_path || null;
}

function readFields(b) {
  const s = (x) => (x === undefined || x === null ? '' : String(x).trim());
  return {
    department: s(b.department),
    title: s(b.title),
    category: s(b.category) || 'Other',
    description: s(b.description) || null,
    expenseDate: s(b.expenseDate),
    amount: s(b.amount),
  };
}

function validateFields(f) {
  const e = {};
  if (!f.department) e.department = 'Department is required';
  if (!f.title) e.title = 'Expense title is required';
  if (f.title.length > 200) e.title = 'Expense title must be 200 characters or fewer';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.expenseDate) || isNaN(Date.parse(f.expenseDate))) {
    e.expenseDate = 'Expense date is required';
  }
  if (!f.amount) e.amount = 'Amount is required';
  else if (!Number.isFinite(Number(f.amount)) || Number(f.amount) <= 0) e.amount = 'Amount must be greater than zero';
  else if (Number(f.amount) >= 1e10) e.amount = 'Amount is too large';
  if (!CATEGORIES.includes(f.category)) e.category = 'Invalid expense category';
  if (Object.keys(e).length) throw new HttpError(400, 'Validation failed', e);
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

// ---------- list (search / filter / sort / paginate) ----------
const SORTS = {
  voucherNumber: 'v.voucher_number',
  employeeName: 'u.name',
  expenseDate: 'v.expense_date',
  amount: 'v.amount',
  status: 'v.status',
  createdAt: 'v.created_at',
  updatedAt: 'v.updated_at',
};

router.get('/', asyncH(async (req, res) => {
  const q = req.query;
  const params = [];
  const where = [];
  const add = (sql, val) => { params.push(val); where.push(sql.replace('?', `$${params.length}`)); };

  if (req.user.role === 'EMPLOYEE') add('v.user_id = ?', req.user.id);
  else where.push("v.status <> 'Draft'");

  const search = String(q.search || '').trim();
  if (search) {
    params.push(`%${search}%`);
    const i = params.length;
    where.push(`(v.voucher_number ILIKE $${i} OR u.name ILIKE $${i} OR v.title ILIKE $${i})`);
  }
  if (q.department) add('v.department = ?', String(q.department));
  if (q.category) add('v.category = ?', String(q.category));
  if (q.status) add('v.status = ?', String(q.status));
  if (q.dateFrom) {
    if (!isDate(q.dateFrom)) throw new HttpError(400, 'Invalid dateFrom');
    add('v.expense_date >= ?', q.dateFrom);
  }
  if (q.dateTo) {
    if (!isDate(q.dateTo)) throw new HttpError(400, 'Invalid dateTo');
    add('v.expense_date <= ?', q.dateTo);
  }
  for (const [key, op] of [['minAmount', '>='], ['maxAmount', '<=']]) {
    if (q[key] !== undefined && q[key] !== '') {
      if (!Number.isFinite(Number(q[key]))) throw new HttpError(400, `Invalid ${key}`);
      add(`v.amount ${op} ?`, Number(q[key]));
    }
  }

  const sortCol = SORTS[q.sortBy] || SORTS.createdAt;
  const order = String(q.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 10, 1), 50);
  const page = Math.max(parseInt(q.page, 10) || 1, 1);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [count, data] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS n FROM vouchers v JOIN users u ON u.id = v.user_id ${whereSql}`, params),
    db.query(
      `${BASE_SELECT} ${whereSql} ORDER BY ${sortCol} ${order}, v.id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params
    ),
  ]);
  const total = count.rows[0].n;
  res.json({
    data: data.rows.map(toDto),
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  });
}));

// ---------- details ----------
router.get('/:id', asyncH(async (req, res) => {
  const v = await loadVoucher(req.user, req.params.id);
  const hist = await db.query(
    `SELECT h.id, h.from_status, h.to_status, h.note, h.created_at, a.name AS actor_name
     FROM voucher_history h LEFT JOIN users a ON a.id = h.actor_id
     WHERE h.voucher_id = $1 ORDER BY h.id`,
    [v.id]
  );
  res.json({
    ...toDto(v),
    history: hist.rows.map((h) => ({
      id: h.id, from: h.from_status, to: h.to_status, note: h.note, actor: h.actor_name, at: h.created_at,
    })),
  });
}));

// ---------- employee: create / edit / delete / submit ----------
router.post('/', authorize('EMPLOYEE'), upload.single('employeeSignature'), withCleanup(async (req, res) => {
  const f = readFields(req.body);
  validateFields(f);
  const sig = req.file ? `/uploads/${req.file.filename}` : await savedSignature(req.user.id);

  const seq = await db.query("SELECT nextval('voucher_number_seq') AS n");
  const number = `EV-${new Date().getFullYear()}-${String(seq.rows[0].n).padStart(5, '0')}`;

  const { rows } = await db.query(
    `INSERT INTO vouchers (voucher_number, user_id, expense_date, department, title, category, description, amount, employee_signature_path)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [number, req.user.id, f.expenseDate, f.department, f.title, f.category, f.description, f.amount, sig]
  );
  await logHistory(rows[0].id, null, 'Draft', req.user.id, 'Voucher created');
  res.status(201).json(toDto(await loadVoucher(req.user, rows[0].id)));
}));

router.put('/:id', authorize('EMPLOYEE'), upload.single('employeeSignature'), withCleanup(async (req, res) => {
  const v = await loadVoucher(req.user, req.params.id);
  if (v.status !== 'Draft') throw new HttpError(409, 'Only Draft vouchers can be edited');
  const f = readFields(req.body);
  validateFields(f);
  const sig = req.file ? `/uploads/${req.file.filename}` : v.employee_signature_path || (await savedSignature(req.user.id));

  await db.query(
    `UPDATE vouchers SET expense_date=$2, department=$3, title=$4, category=$5, description=$6, amount=$7,
            employee_signature_path=$8, updated_at=NOW()
     WHERE id=$1 AND status='Draft'`,
    [v.id, f.expenseDate, f.department, f.title, f.category, f.description, f.amount, sig]
  );
  res.json(toDto(await loadVoucher(req.user, v.id)));
}));

router.delete('/:id', authorize('EMPLOYEE'), asyncH(async (req, res) => {
  const v = await loadVoucher(req.user, req.params.id);
  if (v.status !== 'Draft') throw new HttpError(409, 'Only Draft vouchers can be deleted');
  await db.query("DELETE FROM vouchers WHERE id = $1 AND status = 'Draft'", [v.id]);
  res.status(204).end();
}));

router.post('/:id/submit', authorize('EMPLOYEE'), asyncH(async (req, res) => {
  const v = await loadVoucher(req.user, req.params.id);
  if (v.status !== 'Draft') throw new HttpError(409, 'Only Draft vouchers can be submitted');
  if (!v.employee_signature_path) {
    throw new HttpError(400, 'Employee signature is required before submission', {
      employeeSignature: 'Employee signature is required before submission',
    });
  }
  const r = await db.query(
    `UPDATE vouchers SET status='Pending Approval', submitted_at=NOW(), updated_at=NOW()
     WHERE id=$1 AND status='Draft'`,
    [v.id]
  );
  if (!r.rowCount) throw new HttpError(409, 'Voucher was already submitted');
  await logHistory(v.id, 'Draft', 'Submitted', req.user.id, 'Submitted by employee');
  await logHistory(v.id, 'Submitted', 'Pending Approval', req.user.id, 'Awaiting Director approval');
  res.json(toDto(await loadVoucher(req.user, v.id)));
}));

// ---------- director: approve / reject ----------
router.post('/:id/approve', authorize('DIRECTOR'), upload.single('signature'), withCleanup(async (req, res) => {
  const v = await loadVoucher(req.user, req.params.id);
  if (v.status !== 'Pending Approval') throw new HttpError(409, 'Only vouchers pending approval can be approved');
  const sig = req.file ? `/uploads/${req.file.filename}` : await savedSignature(req.user.id);
  if (!sig) {
    throw new HttpError(400, 'Director signature is required before approval', {
      signature: 'Director signature is required before approval',
    });
  }
  const r = await db.query(
    `UPDATE vouchers SET status='Approved', director_id=$2, director_signature_path=$3,
            approval_date=NOW(), updated_at=NOW()
     WHERE id=$1 AND status='Pending Approval'`,
    [v.id, req.user.id, sig]
  );
  if (!r.rowCount) throw new HttpError(409, 'Voucher was already processed');
  await logHistory(v.id, 'Pending Approval', 'Approved', req.user.id, 'Approved by Director');
  res.json(toDto(await loadVoucher(req.user, v.id)));
}));

router.post('/:id/reject', authorize('DIRECTOR'), asyncH(async (req, res) => {
  const reason = String(req.body.reason || '').trim();
  if (!reason) throw new HttpError(400, 'Rejection reason is required', { reason: 'Rejection reason is required' });
  const v = await loadVoucher(req.user, req.params.id);
  if (v.status !== 'Pending Approval') throw new HttpError(409, 'Only vouchers pending approval can be rejected');
  const r = await db.query(
    `UPDATE vouchers SET status='Rejected', director_id=$2, rejection_reason=$3, updated_at=NOW()
     WHERE id=$1 AND status='Pending Approval'`,
    [v.id, req.user.id, reason]
  );
  if (!r.rowCount) throw new HttpError(409, 'Voucher was already processed');
  await logHistory(v.id, 'Pending Approval', 'Rejected', req.user.id, reason);
  res.json(toDto(await loadVoucher(req.user, v.id)));
}));

module.exports = router;
