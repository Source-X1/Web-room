export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateFromKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

export function todayKey() {
  return toDateKey(new Date());
}

export function formatThaiDate(key) {
  const date = dateFromKey(key);
  return date ? `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}` : '-';
}

export function formatTime(value) {
  const rounded = Math.round(Number(value) * 2) / 2;
  if (!Number.isFinite(rounded)) return '-';
  const hour = Math.floor(rounded);
  const minute = Math.round((rounded - hour) * 60);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatDuration(hours) {
  const totalMinutes = Math.round(Number(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m ? `${h} ชั่วโมง ${m} นาที` : `${h} ชั่วโมง`;
}

export function addDaysToKey(key, days) {
  const d = dateFromKey(key);
  if (!d) return key;
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

// เริ่มสัปดาห์ที่วันจันทร์ (สอดคล้องปฏิทินไทย/สากลที่ใช้ในองค์กร)
export function startOfWeekKey(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateKey(d);
}

export const THAI_WEEKDAYS_SHORT = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];

export function statusLabel(status) {
  if (status === 'confirmed') return 'ยืนยันแล้ว';
  if (status === 'cancelled') return 'ยกเลิก';
  return 'รอยืนยัน';
}

export function statusColor(status) {
  if (status === 'confirmed') return 'green';
  if (status === 'cancelled') return 'red';
  return 'yellow';
}
