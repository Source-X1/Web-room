import { Router } from 'express';
import { getDb, createAuditLog } from '../db/database.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { SUBJECTS, EQUIPMENT, TIME_WINDOWS } from '../data/constants.js';
import { isDateKey, addDaysToKey } from '../utils/booking.js';
import { randomUUID } from 'crypto';
import { emitEvent } from '../utils/socket.js';

const router = Router();


router.get('/', authRequired, (req, res) => {
  const db = getDb();
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY name').all();
  res.json(rooms.map((r) => ({
    id: r.id,
    name: r.name,
    capacity: r.capacity,
    building: r.building,
    type: r.type,
    status: r.status || 'active',
  })));
});

router.post('/', authRequired, adminRequired, (req, res) => {
  const { name, capacity, building, type } = req.body || {};
  if (!name?.trim() || !capacity?.trim()) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อห้องและความจุ' });
  }

  const db = getDb();
  const id = `r_${randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO rooms (id, name, capacity, building, type, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(id, name.trim(), capacity.trim(), building?.trim() || 'อาคารหลัก', type || 'classroom');

  createAuditLog(db, {
    adminId: req.user.id,
    adminName: req.user.displayName,
    action: 'CREATE_ROOM',
    details: `เพิ่มห้องใหม่ ${name.trim()} (${capacity.trim()}, ${building?.trim() || 'อาคารหลัก'})`,
  });

  const created = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
  emitEvent('ROOMS_UPDATED');
  res.status(201).json(created);
});

router.patch('/:id', authRequired, adminRequired, (req, res) => {
  const { name, capacity, building, type, status } = req.body || {};
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'ไม่พบห้อง' });

  const nextName = name?.trim() || room.name;
  const nextCap = capacity?.trim() || room.capacity;
  const nextBldg = building?.trim() || room.building;
  const nextType = type || room.type;
  const nextStatus = status || room.status || 'active';

  db.prepare(`
    UPDATE rooms SET name = ?, capacity = ?, building = ?, type = ?, status = ? WHERE id = ?
  `).run(nextName, nextCap, nextBldg, nextType, nextStatus, room.id);

  createAuditLog(db, {
    adminId: req.user.id,
    adminName: req.user.displayName,
    action: 'UPDATE_ROOM',
    details: `แก้ไขข้อมูลห้อง ${nextName} (สถานะ: ${nextStatus})`,
  });

  const updated = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room.id);
  emitEvent('ROOMS_UPDATED');
  res.json(updated);
});

router.delete('/:id', authRequired, adminRequired, (req, res) => {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'ไม่พบห้อง' });

  db.prepare('DELETE FROM rooms WHERE id = ?').run(room.id);

  createAuditLog(db, {
    adminId: req.user.id,
    adminName: req.user.displayName,
    action: 'DELETE_ROOM',
    details: `ลบห้อง ${room.name}`,
  });

  emitEvent('ROOMS_UPDATED');
  res.json({ message: 'ลบห้องสำเร็จ' });
});


router.get('/meta', authRequired, (_req, res) => {
  res.json({ subjects: SUBJECTS, equipment: EQUIPMENT, timeWindows: TIME_WINDOWS });
});

// มุมมองห้องว่างแบบรายสัปดาห์: คืนตารางห้อง x 7 วัน พร้อมช่วงเวลาที่ถูกจองในแต่ละวัน
// ต้องอยู่ก่อน /availability ไม่ได้เพราะคนละ path segment กัน แต่วางไว้ก่อนเพื่อให้อ่านง่าย
router.get('/week-availability', authRequired, (req, res) => {
  const { startDate, roomId } = req.query;
  if (!startDate || !isDateKey(startDate)) {
    return res.status(400).json({ error: 'กรุณาระบุวันที่เริ่มต้น (YYYY-MM-DD)' });
  }

  const db = getDb();
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(startDate, i));

  let rooms = db.prepare('SELECT * FROM rooms ORDER BY name').all();
  if (roomId) rooms = rooms.filter((r) => r.id === roomId);

  const bookings = db.prepare(
    "SELECT * FROM bookings WHERE date BETWEEN ? AND ? AND status != 'cancelled'"
  ).all(days[0], days[6]);

  const result = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    building: room.building,
    days: days.map((date) => ({
      date,
      bookings: bookings
        .filter((b) => b.room_id === room.id && b.date === date)
        .map((b) => ({
          start: b.start_time,
          end: b.end_time,
          status: b.status,
          bookerName: b.booker_name,
        }))
        .sort((a, b) => a.start - b.start),
    })),
  }));

  res.json({ days, rooms: result });
});

router.get('/availability', authRequired, (req, res) => {
  const { date, period, start, end } = req.query;
  if (!date) return res.status(400).json({ error: 'กรุณาระบุวันที่' });

  const db = getDb();
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY name').all();
  const bookings = db.prepare(
    "SELECT * FROM bookings WHERE date = ? AND status != 'cancelled'"
  ).all(date);

  const startTime = start ? Number(start) : null;
  const endTime = end ? Number(end) : null;

  const result = rooms.map((room) => {
    const isMaintenance = room.status === 'maintenance';
    const roomBookings = bookings.filter((b) => b.room_id === room.id);
    let busy = isMaintenance;
    let conflicts = [];

    if (isMaintenance) {
      conflicts = [{ start: 7, end: 20, bookerName: 'ระบบ (ปิดปรับปรุง)', status: 'maintenance' }];
    } else if (startTime != null && endTime != null) {
      conflicts = roomBookings.filter((b) => startTime < b.end_time && endTime > b.start_time);
      busy = conflicts.length > 0;
    } else if (period && TIME_WINDOWS[period]) {
      const w = TIME_WINDOWS[period];
      conflicts = roomBookings.filter((b) => w.start < b.end_time && w.end > b.start_time);
      busy = conflicts.length > 0;
    }

    return {
      id: room.id,
      name: room.name,
      capacity: room.capacity,
      building: room.building,
      type: room.type,
      status: room.status || 'active',
      busy,
      conflicts: conflicts.map((b) => ({
        start: b.start_time || b.start,
        end: b.end_time || b.end,
        bookerName: b.bookerName || b.booker_name,
        status: b.status,
      })),
    };
  });


  res.json(result);
});

export default router;
