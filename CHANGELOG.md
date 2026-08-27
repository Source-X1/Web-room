# สรุปการอัปเดต — ตามลำดับความสำคัญ 5 ข้อในรายงานรีวิว

## 1. เอารหัส admin ออกจากหน้า login
- ลบข้อความ `admin / admin1262` ออกจาก `src/pages/LoginPage.jsx`

## 2. แสดงเหตุผลตอนปฏิเสธ + รายละเอียด conflict ตอนจองชน
- Backend: `PATCH /api/bookings/:id/status` ตอนนี้ **บังคับ** ให้ admin ระบุ `reason` เมื่อยกเลิก/ปฏิเสธการจอง (เก็บลงคอลัมน์ `cancel_reason`)
- Backend: error 409 ตอนจองชนเวลา ส่งรายละเอียด conflict กลับมาครบ (ช่วงเวลา + ชื่อผู้จอง)
- Frontend: `AdminPage.jsx` เปิด Modal ให้กรอกเหตุผลก่อนยกเลิก (แทนการกดยกเลิกเฉยๆ)
- Frontend: `BookingModal.jsx` และ `BookingPage.jsx` แสดงรายละเอียด conflict ที่ชนกันให้ผู้ใช้เห็นตรงๆ
- Frontend: `ListPage.jsx` (การจองของฉัน) แสดงเหตุผลที่ถูกยกเลิกใต้สถานะ

## 3. ระบบแจ้งเตือนในแอป (in-app notification)
- Backend: ตาราง `notifications` ใหม่ + endpoint `/api/notifications` (list, unread-count, mark read, mark all read)
- Backend: สร้าง notification อัตโนมัติเมื่อ booking ถูกยืนยัน / ยกเลิก / แก้ไขจนต้องรออนุมัติใหม่
- Frontend: `NotificationBell.jsx` (ใหม่) — กระดิ่งพร้อม badge unread count, polling ทุก 15 วินาที, dropdown รายการแจ้งเตือน

## 4. มุมมองห้องว่างแบบรายสัปดาห์
- Backend: endpoint `GET /api/rooms/week-availability?startDate=YYYY-MM-DD&roomId=`
- Frontend: หน้าใหม่ `WeekViewPage.jsx` (route `/week-view`) — ตารางห้อง x 7 วัน, เลื่อนสัปดาห์ก่อนหน้า/ถัดไป, กรองตามห้อง

## 5. แก้ไข/เลื่อนเวลาการจอง + จองซ้ำเป็นชุด (recurring)
- Backend: `PATCH /api/bookings/:id` — แก้ไขวัน/เวลา/ห้อง/รายละเอียดของ booking ที่เป็นเจ้าของ (หรือ admin) โดยเช็ค conflict ใหม่ทุกครั้ง; ถ้า booking เคย "ยืนยันแล้ว" จะถูกดึงกลับเป็น "รออนุมัติ" อัตโนมัติเพราะเวลาที่ยืนยันไว้เปลี่ยนไปแล้ว
- Backend: `POST /api/bookings/recurring` — จองซ้ำทุกสัปดาห์ 2-12 ครั้ง ในคำขอเดียว แต่ละสัปดาห์เช็ค conflict แยกกัน สัปดาห์ไหนชนจะถูกข้ามและแจ้งกลับมาว่าชนวันไหน
- Frontend: `BookingModal.jsx` รองรับทั้งโหมดแก้ไข (`mode="edit"`) และตัวเลือก "จองซ้ำทุกสัปดาห์" ในขั้นตอนที่ 1
- Frontend: `ListPage.jsx` (การจองของฉัน) เพิ่มปุ่ม "แก้ไข" สำหรับ booking ที่ยังไม่ถูกยกเลิก

## Database Migration
Schema เปลี่ยนแปลงแบบ additive (`ALTER TABLE ... ADD COLUMN`, `CREATE TABLE IF NOT EXISTS`) รันอัตโนมัติตอน server เริ่มทำงาน — ไฟล์ `room-booking.db` เดิม (ถ้ามี) จะไม่ถูกลบ ข้อมูลเก่ายังอยู่ครบ

## การทดสอบที่ทำแล้ว
- ตรวจ syntax ทุกไฟล์ backend ด้วย `node --check` — ผ่านหมด
- ตรวจ syntax/parse ทุกไฟล์ frontend ด้วย `@babel/parser` — ผ่านหมด
- รัน ESLint ทั้งโปรเจกต์ — **0 errors** (มี 6 warning ที่เป็นโค้ดเดิมจากต้นฉบับ ไม่เกี่ยวกับงานนี้)
- ทดสอบ integration จริงผ่าน curl ครบทุก endpoint ใหม่: register→approve→login, สิทธิ์ user/admin, สร้าง/แก้ไข/ยกเลิก booking, recurring booking (ทั้งกรณีสำเร็จและกรณีชนกันทุกสัปดาห์), notification, week-availability
- **หมายเหตุ:** ไม่สามารถรัน `npm run build` (vite) ได้ในสภาพแวดล้อมนี้เนื่องจากปัญหา native binding ของ `rolldown` (bug ที่รู้จักของ npm optional-deps, https://github.com/npm/cli/issues/4828) — ไม่เกี่ยวกับโค้ดที่แก้ไข แนะนำให้รัน `npm install` ใหม่ในเครื่องของคุณก่อน `npm run build` ครั้งแรก
