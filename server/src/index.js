require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { dir: uploadsDir } = require('./middleware/upload');
const { authenticate } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errors');
const { CATEGORIES, DEPARTMENTS, STATUSES } = require('./constants');

if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
  console.error('Missing JWT_SECRET or DATABASE_URL. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/meta', authenticate, (req, res) =>
  res.json({ categories: CATEGORIES, departments: DEPARTMENTS, statuses: STATUSES }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vouchers', require('./routes/vouchers'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
