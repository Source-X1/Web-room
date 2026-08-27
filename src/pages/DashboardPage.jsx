import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Card from '../components/ui/Card.jsx';
import Badge, { EmptyState } from '../components/ui/Badge.jsx';
import { formatThaiDate, formatTime } from '../utils/date.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function DashboardPage() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => api.getDashboard().then(setData).finally(() => setLoading(false));
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <EmptyState>กำลังโหลด...</EmptyState>;
  if (!data) return <EmptyState>ไม่สามารถโหลดข้อมูลได้</EmptyState>;

  return (
    <div className="grid gap-4">
      {isAdmin && data.adminStats && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="!bg-amber-50 dark:!bg-amber-950/30">
            <p className="text-3xl font-extrabold text-amber-700 dark:text-amber-300">{data.adminStats.pendingUsers}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">ผู้ใช้รออนุมัติ · <Link to="/admin" className="text-brand-600 underline">จัดการ</Link></p>
          </Card>
          <Card className="!bg-brand-50 dark:!bg-brand-950/30">
            <p className="text-3xl font-extrabold text-brand-700 dark:text-brand-300">{data.adminStats.pendingBookings}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">การจองรอยืนยัน · <Link to="/admin" className="text-brand-600 underline">จัดการ</Link></p>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="การจองวันนี้" icon="▣">
          {data.todayBookings.length === 0 ? (
            <EmptyState>ไม่มีการจองวันนี้</EmptyState>
          ) : (
            <div className="grid max-h-72 gap-2 overflow-auto">
              {data.todayBookings.map((b) => (
                <div key={b.id} className="rounded-2xl border-l-4 border-brand-500 bg-brand-50/60 p-4 text-sm transition-all hover:bg-brand-50 dark:bg-brand-950/30 dark:hover:bg-brand-900/40">
                  <strong>{b.roomName}</strong>
                  <div className="mt-1 text-slate-600 dark:text-slate-400">{formatTime(b.start)}–{formatTime(b.end)} · {b.bookerName}</div>
                  <div className="mt-2"><Badge status={b.status} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="การจองถัดไปของฉัน" icon="◷">
          {data.myBookings.length === 0 ? (
            <div className="py-8 text-center">
              <p className="mb-3 text-sm text-slate-500">คุณยังไม่มีรายการจองห้องเรียนหรือห้องประชุม</p>
              <Link
                to="/booking"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-700 hover:shadow-lg"
              >
                <span>+</span> จองห้องเรียน/ห้องประชุมเลย
              </Link>
            </div>
          ) : (
            <div className="grid gap-2">
              {data.myBookings.map((b) => (
                <div key={b.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <strong>{b.roomName}</strong>
                  <div className="text-slate-600 dark:text-slate-400">{formatThaiDate(b.date)} · {formatTime(b.start)}–{formatTime(b.end)}</div>
                  <Badge status={b.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

