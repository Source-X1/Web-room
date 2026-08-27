import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

function parseNotification(row) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    type: row.type,
    message: row.message,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  };
}

router.get('/', authRequired, (req, res) => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user.id);
  res.json(rows.map(parseNotification));
});

// ต้องอยู่ก่อน /:id/read เพื่อกัน Express ดักคำว่า "unread-count" เป็น param id
router.get('/unread-count', authRequired, (req, res) => {
  const db = getDb();
  const count = db.prepare(
    'SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(req.user.id).c;
  res.json({ count });
});

router.patch('/:id/read', authRequired, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'ไม่พบการแจ้งเตือน' });

  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json(parseNotification({ ...row, is_read: 1 }));
});

router.post('/read-all', authRequired, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  res.json({ message: 'อ่านทั้งหมดแล้ว' });
});

export default router;
