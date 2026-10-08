const path = require('path');
const fs = require('fs');
const express = require('express');

const { attachUser } = require('./lib/auth');
const { errorHandler } = require('./lib/errors');
const authRoutes = require('./routes/auth');
const gigRoutes = require('./routes/gigs');
const orderRoutes = require('./routes/orders');
const reviewRoutes = require('./routes/reviews');
const miscRoutes = require('./routes/misc');

const app = express();
const PORT = process.env.PORT || 4123;

app.use(express.json({ limit: '256kb' }));
app.use(attachUser);

app.use('/api', authRoutes);
app.use('/api', gigRoutes);
app.use('/api', orderRoutes);
app.use('/api', reviewRoutes);
app.use('/api', miscRoutes);

// Unknown API path → clean JSON 404 (never an HTML stack trace).
app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: "No such endpoint." } });
});

// Serve the built React app when it exists (demo-day single-process mode).
const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🛹  Sidequest API on http://localhost:${PORT}`);
});
