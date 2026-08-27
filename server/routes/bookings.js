import { Router } from 'express';
import { getDb, parseBookingRow, createAuditLog } from '../db/database.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { randomUUID } from 'crypto';

import {
  isFutureOrToday,
  findConflicts,
  addDaysToKey,
  parseBookingPayload,
} from '../utils/booking.js';

import { emitEvent, emitToUser } from '../utils/socket.js';

const router = Router();

function getAllActiveBookings(db) {
  const rows = db.prepare("SELECT * FROM bookings WHERE status != 'cancelled'").all();
  return rows.map(parseBookingRow);
}

function createNotification(db, { userId, bookingId, type, message }) {
  db.prepare(`
    INSERT INTO notifications (id, user_id, booking_id, type, message, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(randomUUID(), userId, bookingId, type, message, Date.now());

  emitToUser(userId, 'NOTIFICATION_NEW', { type, message, bookingId });
}

router.get('/', authRequired, (req, res) => {
  const db = getDb();
  let query = 'SELECT * FROM bookings WHERE 1=1';
  const params = [];

  const { roomId, date, status, userId, dateFrom, dateTo, mine } = req.query;

  if (mine === 'true') {
    query += ' AND user_id = ?';
    params.push(req.user.id);
  }
  if (roomId) { query += ' AND room_id = ?'; params.push(roomId); }
  if (date) { query += ' AND date = ?'; params.push(date); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (userId && req.user.role === 'admin') { query += ' AND user_id = ?'; params.push(userId); }
  if (dateFrom) { query += ' AND date >= ?'; params.push(dateFrom); }
  if (dateTo) { query += ' AND date <= ?'; params.push(dateTo); }

  query += ' ORDER BY date ASC, start_time ASC, created_at DESC';
  const rows = db.prepare(query).all(...params);
  res.json(rows.map(parseBookingRow));
});

router.get('/check/conflicts', authRequired, (req, res) => {
  const { roomId, date, start, end } = req.query;
  if (!roomId || !date || !start || !end) {
    return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
  }
  const db = getDb();
  const active = getAllActiveBookings(db);
  const conflicts = findConflicts(active, {
    date,
    roomId,
    start: Number(start),
    end: Number(end),
  });
  res.json({ conflicts, available: conflicts.length === 0 });
});

// รีเซ็ต/ล้างข้อมูลการจองทั้งหมดในระบบ (Admin Only) - ต้องอยู่ก่อน /:id
router.post('/reset', authRequired, adminRequired, (req, res) => {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM bookings').get().c;

  const resetAll = db.transaction(() => {
    db.prepare('DELETE FROM notifications').run();
    db.prepare('DELETE FROM bookings').run();
  });

  resetAll();

  createAuditLog(db, {
    adminId: req.user?.id || 'admin',
    adminName: req.user?.displayName || req.user?.username || 'ผู้ดูแลระบบ',
    action: 'RESET_BOOKINGS',
    details: `รีเซ็ต/ล้างข้อมูลการจองทั้งหมดในระบบจำนวน ${count} รายการ`,
  });

  emitEvent('BOOKINGS_UPDATED');
  res.json({ message: `ล้างข้อมูลการจองทั้งหมดจำนวน ${count} รายการเรียบร้อยแล้ว`, count });
});

// ต้องอยู่ก่อน /:id เพื่อกัน Express ดักคำว่า "recurring" เป็น param id
router.post('/recurring', authRequired, (req, res) => {
  const weekCount = Number(req.body?.weeks);
  if (!Number.isInteger(weekCount) || weekCount < 2 || weekCount > 12) {
    return res.status(400).json({ error: 'จำนวนสัปดาห์ต้องอยู่ระหว่าง 2-12' });
  }

  const parsed = parseBookingPayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const {
    roomId, period, start, end,
    purpose, years, subjects, equipment, otherPurpose, otherEquipment,
  } = parsed.data;

  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) return res.status(404).json({ error: 'ไม่พบห้อง' });
  const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.user.id);

  const seriesId = randomUUID();

  const insertOne = db.transaction((targetDate) => {
    const active = getAllActiveBookings(db);
    const conflicts = findConflicts(active, { date: targetDate, roomId, start, end });
    if (conflicts.length) {
      const err = new Error('conflict');
      err.conflicts = conflicts;
      throw err;
    }
    const now = Date.now();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO bookings (
        id, room_id, room_name, date, start_time, end_time, period,
        user_id, booker_name, purpose, years, subjects, equipment,
        other_purpose, other_equipment, status, created_at, updated_at, series_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, room.id, room.name, targetDate, start, end, period,
      req.user.id, user.display_name,
      JSON.stringify(purpose), JSON.stringify(years), JSON.stringify(subjects), JSON.stringify(equipment),
      otherPurpose?.trim() || null, otherEquipment?.trim() || null,
      'pending', now, now, seriesId
    );
    return id;
  });

  const created = [];
  const skipped = [];

  for (let i = 0; i < weekCount; i += 1) {
    const targetDate = addDaysToKey(firstDate, i * 7);
    try {
      const id = insertOne(targetDate);
      created.push(parseBookingRow(db.prepare('SELECT * FROM bookings WHERE id = ?').get(id)));
    } catch (err) {
      skipped.push({ date: targetDate, conflicts: err.conflicts || [] });
    }
  }

  emitEvent('BOOKINGS_UPDATED');
  res.status(created.length ? 201 : 409).json({ created, skipped, seriesId });
});

router.get('/:id', authRequired, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'ไม่พบรายการจอง' });
  const booking = parseBookingRow(row);
  if (booking.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' });
  }
  res.json(booking);
});

router.post('/', authRequired, (req, res) => {
  const parsed = parseBookingPayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const {
    roomId, date, period, start, end,
    purpose, years, subjects, equipment, otherPurpose, otherEquipment,
  } = parsed.data;

  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) return res.status(404).json({ error: 'ไม่พบห้อง' });

  const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.user.id);

  const createBooking = db.transaction(() => {
    const active = getAllActiveBookings(db);
    const conflicts = findConflicts(active, { date, roomId, start, end });
    if (conflicts.length) {
      const err = new Error('ห้องถูกจองในช่วงเวลานี้แล้ว');
      err.status = 409;
      err.conflicts = conflicts;
      throw err;
    }

    const now = Date.now();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO bookings (
        id, room_id, room_name, date, start_time, end_time, period,
        user_id, booker_name, purpose, years, subjects, equipment,
        other_purpose, other_equipment, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, room.id, room.name, date, start, end, period,
      req.user.id, user.display_name,
      JSON.stringify(purpose), JSON.stringify(years), JSON.stringify(subjects), JSON.stringify(equipment),
      otherPurpose?.trim() || null, otherEquipment?.trim() || null,
      'pending', now, now
    );

    return id;
  });

  let bookingId;
  try {
    bookingId = createBooking();
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ error: err.message, conflicts: err.conflicts });
    }
    throw err;
  }

  const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  emitEvent('BOOKINGS_UPDATED');
  res.status(201).json(parseBookingRow(row));
});

router.patch('/:id', authRequired, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'ไม่พบรายการจอง' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์แก้ไข' });
  }
  if (row.status === 'cancelled') {
    return res.status(400).json({ error: 'ไม่สามารถแก้ไขรายการที่ถูกยกเลิกแล้ว' });
  }

  const parsed = parseBookingPayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const {
    roomId, date, period, start, end,
    purpose, years, subjects, equipment, otherPurpose, otherEquipment,
  } = parsed.data;

  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) return res.status(404).json({ error: 'ไม่พบห้อง' });

  const runUpdate = db.transaction(() => {
    const active = getAllActiveBookings(db);
    const conflicts = findConflicts(active, { date, roomId, start, end, ignoreBookingId: row.id });
    if (conflicts.length) {
      const err = new Error('ห้องถูกจองในช่วงเวลานี้แล้ว');
      err.status = 409;
      err.conflicts = conflicts;
      throw err;
    }

    const nextStatus = row.status === 'confirmed' ? 'pending' : row.status;
    db.prepare(`
      UPDATE bookings SET
        room_id = ?, room_name = ?, date = ?, start_time = ?, end_time = ?, period = ?,
        purpose = ?, years = ?, subjects = ?, equipment = ?, other_purpose = ?, other_equipment = ?,
        status = ?, cancel_reason = NULL, updated_at = ?
      WHERE id = ?
    `).run(
      room.id, room.name, date, start, end, period,
      JSON.stringify(purpose), JSON.stringify(years), JSON.stringify(subjects), JSON.stringify(equipment),
      otherPurpose?.trim() || null, otherEquipment?.trim() || null,
      nextStatus, Date.now(), row.id
    );

    if (nextStatus !== row.status) {
      createNotification(db, {
        userId: row.user_id,
        bookingId: row.id,
        type: 'booking_updated',
        message: `แก้ไขการจอง ${room.name} วันที่ ${date} แล้ว รอผู้ดูแลระบบยืนยันอีกครั้ง`,
      });
    }
  });

  try {
    runUpdate();
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message, conflicts: err.conflicts });
    throw err;
  }

  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(row.id);
  emitEvent('BOOKINGS_UPDATED');
  res.json(parseBookingRow(updated));
});

router.patch('/:id/status', authRequired, adminRequired, (req, res) => {
  const { status, reason } = req.body || {};
  if (!['confirmed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
  }
  if (status === 'cancelled' && !reason?.trim()) {
    return res.status(400).json({ error: 'กรุณาระบุเหตุผลในการยกเลิก/ปฏิเสธ' });
  }

  const db = getDb();
  const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'ไม่พบรายการจอง' });

  const trimmedReason = status === 'cancelled' ? reason.trim() : null;
  db.prepare('UPDATE bookings SET status = ?, cancel_reason = ?, updated_at = ? WHERE id = ?')
    .run(status, trimmedReason, Date.now(), req.params.id);

  const message = status === 'confirmed'
    ? `การจอง ${row.room_name} วันที่ ${row.date} เวลา ${row.start_time}-${row.end_time} ได้รับการยืนยันแล้ว`
    : `การจอง ${row.room_name} วันที่ ${row.date} ถูกยกเลิกโดยผู้ดูแลระบบ เหตุผล: ${trimmedReason}`;
  createNotification(db, {
    userId: row.user_id,
    bookingId: row.id,
    type: status === 'confirmed' ? 'booking_confirmed' : 'booking_cancelled',
    message,
  });

  createAuditLog(db, {
    adminId: req.user.id,
    adminName: req.user.displayName,
    action: status === 'confirmed' ? 'CONFIRM_BOOKING' : 'CANCEL_BOOKING',
    details: status === 'confirmed'
      ? `ยืนยันการจอง ${row.room_name} วันที่ ${row.date} (โดย ${row.booker_name})`
      : `ยกเลิกการจอง ${row.room_name} วันที่ ${row.date} เหตุผล: ${trimmedReason}`,
  });

  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);

  emitEvent('BOOKINGS_UPDATED');
  res.json(parseBookingRow(updated));
});

router.post('/:id/cancel', authRequired, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'ไม่พบรายการจอง' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์ยกเลิก' });
  }
  if (row.status === 'cancelled') {
    return res.status(400).json({ error: 'รายการนี้ถูกยกเลิกแล้ว' });
  }

  db.prepare("UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ?").run(Date.now(), req.params.id);
  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  emitEvent('BOOKINGS_UPDATED');
  res.json(parseBookingRow(updated));
});

export default router;
