import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import { Select } from '../components/ui/Input.jsx';
import { EmptyState } from '../components/ui/Badge.jsx';

export default function StatsPage() {
  const [mode, setMode] = useState('month');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getStats({ mode, month }).then(setStats).finally(() => setLoading(false));
  }, [mode, month]);

  return (
    <Card title="สถิติการใช้งาน" icon="▣">
      <div className="no-print mb-4 flex flex-wrap items-end gap-3">
        <Select label="มุมมอง" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="month">ประจำเดือน</option>
          <option value="year">ประจำปี</option>
        </Select>
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">เดือนอ้างอิง</span>
          <input type="month" className="min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-slate-800 outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:bg-slate-800" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <Button variant="outline" onClick={() => window.print()}>พิมพ์ / PDF</Button>
      </div>

      {loading || !stats ? <EmptyState>กำลังโหลด...</EmptyState> : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-brand-50 p-4 text-center dark:bg-brand-950/40">
              <p className="text-3xl font-extrabold text-brand-700 dark:text-brand-300">{stats.total}</p>
              <p className="mt-1 text-xs text-slate-500">จำนวนการจองทั้งหมด</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4 text-center dark:bg-emerald-950/40">
              <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">{stats.topRoom?.name || '-'}</p>
              <p className="mt-1 text-xs text-slate-500">ห้องที่ใช้บ่อยที่สุด</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4 text-center dark:bg-amber-950/40">
              <p className="text-lg font-extrabold text-amber-700 dark:text-amber-300">{stats.topSlot?.label || '-'}</p>
              <p className="mt-1 text-xs text-slate-500">ช่วงเวลายอดนิยม</p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-5 dark:border-slate-800 dark:bg-slate-900/30">
              <h3 className="mb-4 text-sm font-bold">จำนวนการจองแยกตามห้อง</h3>
              {stats.rooms.length === 0 ? <EmptyState>ไม่มีข้อมูล</EmptyState> : stats.rooms.map((r) => (
                <div key={r.name} className="mb-3 grid grid-cols-[1fr_2fr_28px] items-center gap-3">
                  <span className="truncate text-xs font-medium" title={r.name}>{r.name}</span>
                  <div className="h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-300 to-brand-500 shadow-sm" style={{ width: `${r.percent}%` }} />
                  </div>
                  <span className="text-right text-xs font-bold text-slate-600 dark:text-slate-400">{r.count}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-5 dark:border-slate-800 dark:bg-slate-900/30">
              <h3 className="mb-4 text-sm font-bold">ช่วงเวลาที่มีการจองมากที่สุด</h3>
              {stats.slots.length === 0 ? <EmptyState>ไม่มีข้อมูล</EmptyState> : stats.slots.map((s) => (
                <div key={s.label} className="mb-3 grid grid-cols-[1fr_2fr_28px] items-center gap-3">
                  <span className="text-xs font-medium">{s.label}</span>
                  <div className="h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-emerald-500 shadow-sm" style={{ width: `${s.percent}%` }} />
                  </div>
                  <span className="text-right text-xs font-bold text-slate-600 dark:text-slate-400">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
