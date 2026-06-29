require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

// ── Security Headers ──────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        connectSrc: ["'self'"],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5000'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ── Body Parsers ──────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Rate Limiters ─────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30,
  message: { message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true, legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 30,
  message: { message: 'Too many uploads. Try again later.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 500,
  standardHeaders: true, legacyHeaders: false,
});

// ── Static Files ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ────────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api/auth',          authLimiter,   require('./routes/auth'));
app.use('/api/users',                        require('./routes/users'));
app.use('/api/posts',                        require('./routes/posts'));
app.use('/api/comments',                     require('./routes/comments'));
app.use('/api/upload',        uploadLimiter, require('./routes/upload'));
app.use('/api/search',                       require('./routes/search'));
app.use('/api/notifications',                require('./routes/notifications'));

// ── SPA Fallback ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ message: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET not set in .env'); process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('FATAL: MONGODB_URI not set in .env'); process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(process.env.PORT || 5000, () => {
      console.log('🚀 Aether running on http://localhost:' + (process.env.PORT || 5000));
    });
  })
  .catch(err => {
    console.error('MongoDB error:', err.message);
    process.exit(1);
  });