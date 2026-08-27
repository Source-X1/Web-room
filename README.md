# Room Booking System

ระบบจองห้องเรียนและห้องประชุม — React + Tailwind + Express + SQLite

## เริ่มใช้งาน

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

## บัญชี Admin เริ่มต้น

- Username: `admin`
- Password: `admin1262`

## โครงสร้าง

- `src/` — React frontend (Tailwind CSS, dark mode)
- `server/` — Express API + SQLite database
- Database file: `server/data/room-booking.db` (สร้างอัตโนมัติ)

## Production

```bash
npm run build
npm start
```

ตั้งค่า environment:
- `PORT` — พอร์ต API (default 3001)
- `JWT_SECRET` — คีย์ JWT สำหรับ production
