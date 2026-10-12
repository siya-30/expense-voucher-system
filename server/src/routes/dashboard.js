const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { asyncH } = require('../middleware/errors');

const router = express.Router();
router.use(authenticate);

router.get('/', asyncH(async (req, res) => {
  const { id, role } = req.user;

  if (role === 'EMPLOYEE') {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status='Draft')::int AS drafts,
              COUNT(*) FILTER (WHERE status='Pending Approval')::int AS pending,
              COUNT(*) FILTER (WHERE status='Approved')::int AS approved,
              COUNT(*) FILTER (WHERE status='Rejected')::int AS rejected,
              COALESCE(SUM(amount) FILTER (WHERE status <> 'Draft'), 0)::float8 AS total_claimed
       FROM vouchers WHERE user_id = $1`,
      [id]
    );
    const recent = await db.query(
      `SELECT id, voucher_number, title, amount, status, updated_at FROM vouchers
       WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 5`,
      [id]
    );
    return res.json({
      role,
      stats: rows[0],
      recent: recent.rows.map((r) => ({
        voucherId: r.id, voucherNumber: r.voucher_number, title: r.title,
        amount: Number(r.amount), label: r.status, at: r.updated_at,
      })),
    });
  }

  if (role === 'DIRECTOR') {
    const [pending, today, recent] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS pending_count, COALESCE(SUM(amount), 0)::float8 AS pending_amount
         FROM vouchers WHERE status = 'Pending Approval'`
      ),
      db.query(
        `SELECT COUNT(*) FILTER (WHERE to_status='Approved')::int AS approved_today,
                COUNT(*) FILTER (WHERE to_status='Rejected')::int AS rejected_today
         FROM voucher_history WHERE created_at::date = CURRENT_DATE`
      ),
      db.query(
        `SELECT h.to_status, h.created_at, v.id, v.voucher_number, v.title, v.amount, a.name AS actor
         FROM voucher_history h
         JOIN vouchers v ON v.id = h.voucher_id
         LEFT JOIN users a ON a.id = h.actor_id
         WHERE h.to_status IN ('Pending Approval','Approved','Rejected')
         ORDER BY h.id DESC LIMIT 8`
      ),
    ]);
    return res.json({
      role,
      stats: { ...pending.rows[0], ...today.rows[0] },
      recent: recent.rows.map((r) => ({
        voucherId: r.id, voucherNumber: r.voucher_number, title: r.title, amount: Number(r.amount),
        label: r.to_status === 'Pending Approval' ? 'Submitted for approval' : r.to_status,
        by: r.actor, at: r.created_at,
      })),
    });
  }

  // ACCOUNTS
  const [stats, recent] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status='Pending Approval')::int AS pending,
              COUNT(*) FILTER (WHERE status='Approved')::int AS approved,
              COUNT(*) FILTER (WHERE status='Rejected')::int AS rejected,
              COALESCE(SUM(amount) FILTER (WHERE status='Approved'), 0)::float8 AS approved_amount
       FROM vouchers WHERE status <> 'Draft'`
    ),
    db.query(
      `SELECT v.id, v.voucher_number, v.title, v.amount, v.approval_date, u.name AS employee
       FROM vouchers v JOIN users u ON u.id = v.user_id
       WHERE v.status = 'Approved' ORDER BY v.approval_date DESC LIMIT 8`
    ),
  ]);
  res.json({
    role,
    stats: stats.rows[0],
    recent: recent.rows.map((r) => ({
      voucherId: r.id, voucherNumber: r.voucher_number, title: r.title, amount: Number(r.amount),
      label: 'Approved', by: r.employee, at: r.approval_date,
    })),
  });
}));

module.exports = router;
