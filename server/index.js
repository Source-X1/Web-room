import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import roomRoutes from './routes/rooms.js';
import userRoutes from './routes/users.js';
import statsRoutes from './routes/stats.js';
import notificationRoutes from './routes/notifications.js';
import auditRoutes from './routes/audit.js';
import { getDb } from './db/database.js';
import { initSocket } from './utils/socket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// Initialize Real-time WebSockets
initSocket(httpServer);

app.use(cors({
  origin: isProd ? true : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  getDb();
  res.json({ ok: true, message: 'Room Booking API & Real-time WebSockets' });
});

app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'ไม่พบ API endpoint' });
});

if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.use((_req, res) => {
    res.status(404).json({ error: 'ไม่พบ endpoint' });
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  getDb();
  console.log(`API server & Real-Time WebSockets running at http://localhost:${PORT}`);
});
