const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { upload, withCleanup } = require('../middleware/upload');
const { HttpError, asyncH } = require('../middleware/errors');

const router = express.Router();

const toUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  employeeCode: u.employee_code,
  department: u.department,
  signatureUrl: u.signature_path,
});

router.post('/login', asyncH(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
  res.json({ token, user: toUser(user) });
}));

router.get('/me', authenticate, asyncH(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]) throw new HttpError(401, 'User no longer exists');
  res.json(toUser(rows[0]));
}));

// Save a reusable signature on the user's profile
router.post('/signature', authenticate, upload.single('signature'), withCleanup(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Signature image is required');
  const { rows } = await db.query(
    'UPDATE users SET signature_path = $1 WHERE id = $2 RETURNING *',
    [`/uploads/${req.file.filename}`, req.user.id]
  );
  res.json(toUser(rows[0]));
}));

module.exports = router;
