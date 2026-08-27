import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();

router.get('/', authRequired, adminRequired, (req, res) => {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();
  res.json(
    logs.map((l) => ({
      id: l.id,
      adminId: l.admin_id,
      adminName: l.admin_name,
      action: l.action,
      details: l.details,
      createdAt: l.created_at,
    }))
  );
});

export default router;
