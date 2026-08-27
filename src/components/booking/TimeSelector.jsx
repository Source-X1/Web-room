
import { formatDuration, formatTime } from '../../utils/date.js';

function hourOptions(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function TimeSelector({ period, timeWindows, start, end, onPeriodChange, onStartChange, onEndChange, error }) {
  const window = timeWindows[period] || timeWindows.morning;
  const hours = hourOptions(window.start, window.end);

  const startHour = Math.floor(start);
  const startMin = Math.round((start - startHour) * 60);
  const endHour = Math.floor(end);
  const endMin = Math.round((end - endHour) * 60);

  const setStart = (h, m) => onStartChange(Number(h) + Number(m) / 60);
  const setEnd = (h, m) => onEndChange(Number(h) + Number(m) / 60);

  const presets = [
    { label: '1 ชม.แรก', s: window.start, e: Math.min(window.start + 1, window.end) },
    { label: '2 ชม.แรก', s: window.start, e: Math.min(window.start + 2, window.end) },
    { label: 'ครึ่งแรก', s: window.start, e: window.start + (window.end - window.start) / 2 },
    { label: 'เต็มช่วง', s: window.start, e: window.end },
  ];

  const applyPreset = (p) => {
    onStartChange(p.s);
    onEndChange(p.e);
  };

  return (
    <div className="grid gap-3">
      <div>
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">เลือกเวลาด่วน</span>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(p)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                start === p.s && end === p.e
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {p.label} ({formatTime(p.s)}–{formatTime(p.e)})
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="mb-1 block text-sm font-semibold text-slate-600 dark:text-slate-300">เริ่ม</span>
          <div className="grid grid-cols-2 gap-2">
            <select className="min-h-10 rounded-xl border border-slate-300 bg-white px-2 dark:border-slate-600 dark:bg-slate-800" value={startHour} onChange={(e) => setStart(e.target.value, startMin)}>
              {hours.filter((h) => h < window.end).map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
            </select>
            <select className="min-h-10 rounded-xl border border-slate-300 bg-white px-2 dark:border-slate-600 dark:bg-slate-800" value={startMin} onChange={(e) => setStart(startHour, e.target.value)}>
              <option value="0">00</option>
              <option value="30">30</option>
            </select>
          </div>
        </div>
        <div>
          <span className="mb-1 block text-sm font-semibold text-slate-600 dark:text-slate-300">สิ้นสุด</span>
          <div className="grid grid-cols-2 gap-2">
            <select className="min-h-10 rounded-xl border border-slate-300 bg-white px-2 dark:border-slate-600 dark:bg-slate-800" value={endHour} onChange={(e) => setEnd(e.target.value, endMin)}>
              {hours.filter((h) => h > window.start).map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
            </select>
            <select className="min-h-10 rounded-xl border border-slate-300 bg-white px-2 dark:border-slate-600 dark:bg-slate-800" value={endMin} onChange={(e) => setEnd(endHour, e.target.value)} disabled={endHour >= window.end}>
              <option value="0">00</option>
              <option value="30">30</option>
            </select>
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && (
        <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-300">
          <strong>ระยะเวลา:</strong> {formatDuration(end - start)} ({formatTime(start)}–{formatTime(end)})
        </p>
      )}
    </div>
  );
}

export function validateTime(period, start, end, timeWindows) {
  const window = timeWindows[period];
  if (!window) return 'ช่วงเวลาไม่ถูกต้อง';
  if (start < window.start || end > window.end) return `ต้องอยู่ใน${window.label} (${formatTime(window.start)}–${formatTime(window.end)})`;
  if (end <= start) return 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม';
  if (end - start > 8) return 'จองได้สูงสุด 8 ชั่วโมง';
  return '';
}

