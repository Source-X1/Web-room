import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { getDb } from '../db/database.js';
import { signToken, authRequired } from '../middleware/auth.js';
import { ADMIN_USERNAME } from '../data/constants.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }
  if (user.role !== 'admin' && !user.approved) {
    return res.status(403).json({ error: 'บัญชียังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ' });
  }

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      isAdmin: user.role === 'admin',
    },
  });
});

router.post('/register', (req, res) => {
  const { displayName, username, password, passwordConfirm } = req.body || {};
  if (!displayName?.trim() || !username?.trim() || !password) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  }
  if (username.trim().length < 3) {
    return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' });
  }
  if (password !== passwordConfirm) {
    return res.status(400).json({ error: 'รหัสผ่านยืนยันไม่ตรงกัน' });
  }
  if (username.trim().toLowerCase() === ADMIN_USERNAME) {
    return res.status(400).json({ error: 'ไม่สามารถใช้ชื่อผู้ใช้นี้ได้' });
  }

  const db = getDb();
  const exists = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());
  if (exists) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });

  const hash = bcrypt.hashSync(password, 10);
  const id = randomUUID();
  db.prepare(
    'INSERT INTO users (id, username, password_hash, display_name, role, approved, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, username.trim(), hash, displayName.trim(), 'user', 0, Date.now());

  res.status(201).json({ message: 'สมัครสำเร็จ รอผู้ดูแลระบบอนุมัติ' });
});

router.get('/me', authRequired, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, display_name, role, approved FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้งาน' });
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    isAdmin: user.role === 'admin',
  });
});

router.post('/change-password', authRequired, (req, res) => {
  const { oldPassword, newPassword, newPasswordConfirm } = req.body || {};
  if (!oldPassword || !newPassword || !newPasswordConfirm) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร' });
  }
  if (newPassword !== newPasswordConfirm) {
    return res.status(400).json({ error: 'รหัสผ่านใหม่ไม่ตรงกัน' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || !bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
});

export default router;
