const bcrypt = require('bcryptjs');
const db = require('./db');

const USERS = [
  ['Dinesh Rao',  'director@pspl.com',  'Director@123',  'DIRECTOR', 'DIR001', 'Admin'],
  ['Asha Menon',  'accounts@pspl.com',  'Accounts@123',  'ACCOUNTS', 'ACC001', 'Finance'],
  ['Rahul Verma', 'employee1@pspl.com', 'Employee@123',  'EMPLOYEE', 'EMP001', 'Engineering'],
  ['Priya Nair',  'employee2@pspl.com', 'Employee@123',  'EMPLOYEE', 'EMP002', 'Marketing'],
];

(async () => {
  for (const [name, email, password, role, code, dept] of USERS) {
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, employee_code, department)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
      [name, email, await bcrypt.hash(password, 10), role, code, dept]
    );
  }
  console.log('Seeded demo users.');
  await db.pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
