-- Expense Voucher Management System — PostgreSQL schema (idempotent)

CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  email          VARCHAR(150) NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           VARCHAR(20) NOT NULL CHECK (role IN ('EMPLOYEE','DIRECTOR','ACCOUNTS')),
  employee_code  VARCHAR(30),
  department     VARCHAR(100),
  signature_path TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS voucher_number_seq START 1;

CREATE TABLE IF NOT EXISTS vouchers (
  id                      SERIAL PRIMARY KEY,
  voucher_number          VARCHAR(30) NOT NULL UNIQUE,
  user_id                 INT NOT NULL REFERENCES users(id),
  voucher_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_date            DATE NOT NULL,
  department              VARCHAR(100) NOT NULL,
  title                   VARCHAR(200) NOT NULL,
  category                VARCHAR(50)  NOT NULL DEFAULT 'Other',
  description             TEXT,
  amount                  NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status                  VARCHAR(20) NOT NULL DEFAULT 'Draft'
                          CHECK (status IN ('Draft','Submitted','Pending Approval','Approved','Rejected')),
  employee_signature_path TEXT,
  director_id             INT REFERENCES users(id),
  director_signature_path TEXT,
  approval_date           TIMESTAMPTZ,
  rejection_reason        TEXT,
  submitted_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_rejected_has_reason
    CHECK (status <> 'Rejected' OR (rejection_reason IS NOT NULL AND length(trim(rejection_reason)) > 0)),
  CONSTRAINT chk_approved_has_signature
    CHECK (status <> 'Approved' OR director_signature_path IS NOT NULL),
  CONSTRAINT chk_submitted_has_signature
    CHECK (status = 'Draft' OR employee_signature_path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_vouchers_user   ON vouchers(user_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_expense_date ON vouchers(expense_date);

CREATE TABLE IF NOT EXISTS voucher_history (
  id          SERIAL PRIMARY KEY,
  voucher_id  INT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status   VARCHAR(20) NOT NULL,
  actor_id    INT REFERENCES users(id),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_history_voucher ON voucher_history(voucher_id);
