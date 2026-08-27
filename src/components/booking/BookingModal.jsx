import { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Input, { Select } from '../ui/Input.jsx';
import { api } from '../../api/client.js';
import { formatThaiDate, formatTime, todayKey } from '../../utils/date.js';
import TimeSelector, { validateTime } from './TimeSelector.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../context/ConfirmContext.jsx';

const PURPOSES = ['การเรียนการสอน', 'ประชุม', 'จัดกิจกรรม', 'อื่นๆ'];

function emptyForm(draft) {
  return {
    date: draft.date,
    period: draft.period,
    start: draft.start,
    end: draft.end,
    purpose: [],
    years: [],
    subjects: [],
    equipment: [],
    otherPurpose: '',
    otherEquipment: '',
    recurring: false,
    weeks: 4,
  };
}

function formFromBooking(booking) {
  return {
    date: booking.date,
    period: booking.period,
    start: booking.start,
    end: booking.end,
    purpose: booking.purpose || [],
    years: (booking.years || []).map(String),
    subjects: booking.subjects || [],
    equipment: booking.equipment || [],
    otherPurpose: booking.otherPurpose || '',
    otherEquipment: booking.otherEquipment || '',
    recurring: false,
    weeks: 4,
  };
}

// สร้างข้อความอธิบาย conflict จากข้อมูลที่ backend ส่งมา (ใครจองไว้ ช่วงเวลาไหน)
// เพื่อให้ user เห็นรายละเอียดจริง แทนที่จะเห็นแค่ "ห้องถูกจองแล้ว" เฉยๆ
function formatConflicts(conflicts) {
  if (!conflicts?.length) return '';
  return conflicts
    .map((c) => `${formatTime(c.start)}–${formatTime(c.end)} (โดย ${c.bookerName})`)
    .join(', ');
}

export default function BookingModal({ open, onClose, room, draft, meta, onSuccess, mode = 'create', editingBooking = null }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const isEdit = mode === 'edit' && editingBooking;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(() => (isEdit ? formFromBooking(editingBooking) : emptyForm(draft)));

  const wasOpen = useRef(false);

  useEffect(() => {
    // รีเซ็ต step/form เฉพาะตอน modal "เพิ่งถูกเปิด" (false -> true) เท่านั้น
    // ห้ามผูกกับ draft ตรงๆ เพราะ draft เป็น object literal ใหม่ทุกครั้งที่ BookingPage
    // re-render จาก polling (ทุก 10 วิ) ทำให้ modal รีเซ็ตกลับไปหน้า 1 เองระหว่างกรอกฟอร์ม
    if (open && !wasOpen.current) {
      setStep(1);
      setError('');
      setForm(isEdit ? formFromBooking(editingBooking) : emptyForm(draft));
    }
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft, isEdit, editingBooking?.id]);

  if (!room || !meta) return null;

  const timeError = form.period === 'fullday' ? '' : validateTime(form.period, form.start, form.end, meta.timeWindows);
  const teaching = form.purpose.includes('การเรียนการสอน');

  const toggle = (key, value) => {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));
  };

  const buildPayload = () => ({
    roomId: room.id,
    date: form.date,
    period: form.period,
    start: form.period === 'fullday' ? meta.timeWindows.fullday.start : form.start,
    end: form.period === 'fullday' ? meta.timeWindows.fullday.end : form.end,
    purpose: form.purpose,
    years: form.years.map(Number),
    subjects: form.subjects,
    equipment: form.equipment,
    otherPurpose: form.otherPurpose,
    otherEquipment: form.otherEquipment,
  });

  const submit = async () => {
    setError('');
    if (!form.purpose.length) return setError('กรุณาเลือกวัตถุประสงค์');
    if (form.purpose.includes('อื่นๆ') && !form.otherPurpose.trim()) return setError('กรุณาระบุวัตถุประสงค์อื่น');
    if (timeError) return setError(timeError);
    if (form.recurring && (!Number.isInteger(Number(form.weeks)) || form.weeks < 2 || form.weeks > 12)) {
      return setError('จำนวนสัปดาห์ต้องอยู่ระหว่าง 2-12');
    }

    setLoading(true);
    try {
      if (isEdit) {
        await api.updateBooking(editingBooking.id, buildPayload());
        showToast('แก้ไขการจองสำเร็จ');
      } else if (form.recurring) {
        const result = await api.createRecurringBooking({ ...buildPayload(), weeks: Number(form.weeks) });
        if (result.created.length && !result.skipped.length) {
          showToast(`จองสำเร็จทั้งหมด ${result.created.length} ครั้ง รอผู้ดูแลระบบยืนยัน`);
        } else if (result.created.length && result.skipped.length) {
          showToast(`จองสำเร็จ ${result.created.length} ครั้ง · ชนเวลา ${result.skipped.length} ครั้ง (${result.skipped.map((s) => formatThaiDate(s.date)).join(', ')})`, 'info');
        } else {
          setError(`ห้องถูกจองในช่วงเวลานี้ทุกสัปดาห์: ${result.skipped.map((s) => formatThaiDate(s.date)).join(', ')}`);
          setLoading(false);
          return;
        }
      } else {
        await api.createBooking(buildPayload());
        showToast('จองสำเร็จ รอผู้ดูแลระบบยืนยัน');
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      if (err.data?.conflicts?.length) {
        setError(`ห้องถูกจองในช่วงเวลานี้แล้ว: ${formatConflicts(err.data.conflicts)}`);
        showToast('ห้องถูกจองในช่วงเวลานี้แล้ว', 'error');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSafeClose = async () => {
    if (step > 1 || form.purpose.length > 0 || form.equipment.length > 0) {
      const ok = await confirm({
        title: 'ปิดแบบฟอร์ม',
        message: 'ปิดแล้วข้อมูลที่กรอกจะหายทั้งหมด ต้องการปิดหรือไม่?',
        confirmText: 'ปิด',
        variant: 'danger',
      });
      if (!ok) return;
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={handleSafeClose} title={isEdit ? `แก้ไขการจอง ${room.name}` : `จอง ${room.name}`} size="lg">
      <div className="mb-3 flex gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
        ))}
      </div>
      <div className="mb-4 flex justify-between text-[11px] font-bold text-slate-400">
        <span className={step === 1 ? 'text-brand-600 dark:text-brand-400' : ''}>1. วันเวลา</span>
        <span className={step === 2 ? 'text-brand-600 dark:text-brand-400' : ''}>2. รายละเอียด</span>
        <span className={step === 3 ? 'text-brand-600 dark:text-brand-400' : ''}>3. อุปกรณ์</span>
      </div>


      <div className="mb-4 rounded-xl bg-brand-50 p-3 text-sm dark:bg-cyan-950/40">
        <strong>{room.name}</strong> ({room.capacity})
        <div className="text-slate-600 dark:text-slate-400">
          {formatThaiDate(form.date)} · {formatTime(form.period === 'fullday' ? meta.timeWindows.fullday.start : form.start)}–{formatTime(form.period === 'fullday' ? meta.timeWindows.fullday.end : form.end)}
        </div>
      </div>

      {step === 1 && (
        <div className="grid gap-3">
          <Input label="วันที่" type="date" min={todayKey()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select label="ช่วงเวลา" value={form.period} onChange={(e) => {
            const p = e.target.value;
            const w = meta.timeWindows[p];
            setForm({ ...form, period: p, start: w.start, end: Math.min(w.start + 1, w.end) });
          }}>
            {Object.entries(meta.timeWindows).map(([key, w]) => (
              <option key={key} value={key}>{w.label} ({formatTime(w.start)}–{formatTime(w.end)})</option>
            ))}
          </Select>
          {form.period !== 'fullday' ? (
            <TimeSelector
              period={form.period}
              timeWindows={meta.timeWindows}
              start={form.start}
              end={form.end}
              onStartChange={(start) => setForm({ ...form, start })}
              onEndChange={(end) => setForm({ ...form, end })}
              error={timeError}
            />
          ) : (
            <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/40">จองทั้งวัน 08:00–16:00</p>
          )}

          {!isEdit && (
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} />
                จองซ้ำทุกสัปดาห์ (สำหรับวิชาที่เข้าห้องเดิมทุกสัปดาห์)
              </label>
              {form.recurring && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span>จำนวนสัปดาห์:</span>
                  <input
                    type="number"
                    min={2}
                    max={12}
                    value={form.weeks}
                    onChange={(e) => setForm({ ...form, weeks: Number(e.target.value) })}
                    className="min-h-9 w-20 rounded-lg border border-slate-300 px-2 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <span className="text-xs text-slate-500">(2-12 สัปดาห์ นับจากวันที่เลือกด้านบน)</span>
                </div>
              )}
            </div>
          )}

          <Button onClick={() => (timeError && form.period !== 'fullday' ? setError(timeError) : setStep(2))}>ถัดไป</Button>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3">
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">วัตถุประสงค์</legend>
            <div className="grid gap-2">
              {PURPOSES.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.purpose.includes(p)} onChange={() => toggle('purpose', p)} />
                  {p}
                </label>
              ))}
              {form.purpose.includes('อื่นๆ') && (
                <Input placeholder="ระบุวัตถุประสงค์อื่น" value={form.otherPurpose} onChange={(e) => setForm({ ...form, otherPurpose: e.target.value })} />
              )}
            </div>
          </fieldset>
          {teaching && (
            <fieldset>
              <legend className="mb-2 text-sm font-bold">รายละเอียดการเรียนการสอน</legend>
              {[5, 6, 7].map((year) => (
                <div key={year} className="mb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.years.includes(String(year))} onChange={() => toggle('years', String(year))} />
                    ชั้นปีที่ {year}
                  </label>
                  {form.years.includes(String(year)) && (
                    <div className="ml-6 mt-1 flex flex-wrap gap-1">
                      {(meta.subjects[year] || []).map((s) => (
                        <label key={s} className="flex items-center gap-1 rounded-lg border border-blue-200 px-2 py-1 text-xs dark:border-blue-900">
                          <input type="checkbox" checked={form.subjects.includes(s)} onChange={() => toggle('subjects', s)} />
                          {s}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </fieldset>
          )}
          <div className="flex gap-2">
            <Button variant="neutral" onClick={() => setStep(1)}>ย้อนกลับ</Button>
            <Button onClick={() => setStep(3)}>ถัดไป</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-3">
          <fieldset>
            <legend className="mb-2 text-sm font-bold">ขออุปกรณ์เพิ่มเติม</legend>
            <div className="flex flex-wrap gap-2">
              {meta.equipment.map((item) => (
                <label key={item} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={form.equipment.includes(item)} onChange={() => toggle('equipment', item)} />
                  {item}
                </label>
              ))}
            </div>
            <Input className="mt-2" placeholder="อุปกรณ์อื่นๆ (ถ้ามี)" value={form.otherEquipment} onChange={(e) => setForm({ ...form, otherEquipment: e.target.value })} />
          </fieldset>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex gap-2">
            <Button variant="neutral" onClick={() => setStep(2)}>ย้อนกลับ</Button>
            <Button loading={loading} onClick={submit}>{isEdit ? 'บันทึกการแก้ไข' : 'ยืนยันการจอง'}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
