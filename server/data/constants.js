export const ROOMS = [
  { id: 'r1', name: 'ห้องเรียน 1', capacity: '12–13 คน', building: 'อาคารหลัก', type: 'classroom' },
  { id: 'r2', name: 'ห้องเรียน 2', capacity: '12–13 คน', building: 'อาคารหลัก', type: 'classroom' },
  { id: 'r3', name: 'ห้องเรียน 3', capacity: '12–13 คน', building: 'อาคารหลัก', type: 'classroom' },
  { id: 'r4', name: 'ห้องเรียน 4', capacity: '20 คน', building: 'อาคารหลัก', type: 'classroom' },
  { id: 'r5', name: 'ห้องเรียน 5', capacity: '12 คน', building: 'อาคารหลัก', type: 'classroom' },
  { id: 'r6', name: 'ห้องเรียน 6', capacity: '12 คน', building: 'อาคารหลัก', type: 'classroom' },
  { id: 'r7', name: 'ห้องประชุมใหญ่', capacity: '90 คน', building: 'อาคารหลัก', type: 'meeting' },
  { id: 'r8', name: 'ห้องเรียนมูลนิธิ', capacity: '15 คน', building: 'มูลนิธิ', type: 'classroom' },
  { id: 'r9', name: 'ห้องเรียน Sim 1', capacity: '12 คน', building: 'Sim Lab', type: 'sim' },
  { id: 'r10', name: 'ห้องเรียน Sim 2', capacity: '12 คน', building: 'Sim Lab', type: 'sim' },
  { id: 'r11', name: 'ห้องเรียน Sim 3', capacity: '12 คน', building: 'Sim Lab', type: 'sim' },
  { id: 'r12', name: 'ห้องประชุมสำนักงาน', capacity: '30 คน', building: 'สำนักงาน', type: 'meeting' },
  { id: 'r13', name: 'ศัลยกรรม ชั้น 5', capacity: '20 คน', building: 'ศัลยกรรม', type: 'classroom' },
  { id: 'r14', name: 'ห้องประชุมห้องคลอด ชั้น 2', capacity: '25 คน', building: 'ห้องคลอด', type: 'meeting' },
  { id: 'r15', name: 'ห้องเรียนชั้น 6 อาคารพระร่วง', capacity: '30 คน', building: 'อาคารพระร่วง', type: 'classroom' },
  { id: 'r16', name: 'ห้องเรียนชั้น 4 อาคารพระร่วง', capacity: '28 คน', building: 'อาคารพระร่วง', type: 'classroom' },
  { id: 'r17', name: 'อาคาร สธ. 100 ปี ชั้น 2', capacity: '35 คน', building: 'สธ. 100 ปี', type: 'classroom' },
  { id: 'r18', name: 'อาคาร สธ. 100 ปี ชั้น 3', capacity: '35 คน', building: 'สธ. 100 ปี', type: 'classroom' },
  { id: 'r19', name: 'อาคาร สธ. 100 ปี ชั้น 4', capacity: '35 คน', building: 'สธ. 100 ปี', type: 'classroom' },
  { id: 'r20', name: 'อาคาร 55 ปี ชั้น 2', capacity: '40 คน', building: 'อาคาร 55 ปี', type: 'classroom' },
  { id: 'r21', name: 'อาคาร 55 ปี ชั้น 3', capacity: '40 คน', building: 'อาคาร 55 ปี', type: 'classroom' },
];

export const SUBJECTS = {
  5: ['CHMD 5102', 'CHMD 5401', 'CHMD 5402', 'CHMD 5403', 'CHMD 5404', 'CHMD 5405', 'CHMD 5406'],
  6: ['CHMD 6101', 'CHMD 6401', 'CHMD 6402', 'CHMD 6403', 'CHMD 6404', 'CHMD 6405', 'CHMD 6406', 'CHMD 6407', 'CHMD 6408', 'CHMD 6409', 'CHMD 6410', 'CHMD 6411'],
  7: ['CHMD 7401', 'CHMD 7402', 'CHMD 7403', 'CHMD 7404', 'CHMD 7405'],
};

export const EQUIPMENT = ['ไมค์', 'ไมค์เคลื่อนที่', 'พอยเตอร์', 'สาย HDMI', 'สายแปลง Type-C'];

export const TIME_WINDOWS = {
  morning: { label: 'ช่วงเช้า', shortLabel: 'เช้า', start: 7, end: 13 },
  afternoon: { label: 'ช่วงบ่าย', shortLabel: 'บ่าย', start: 13, end: 18 },
  evening: { label: 'ช่วงเย็น', shortLabel: 'เย็น', start: 18, end: 20 },
  fullday: { label: 'ทั้งวัน', shortLabel: 'ทั้งวัน', start: 8, end: 16 },
};

export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export const ADMIN_USERNAME = 'admin';
export const ADMIN_DEFAULT_PASSWORD = 'admin1262';
