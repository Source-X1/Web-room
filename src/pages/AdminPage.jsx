import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api/client.js';
import Card from '../components/ui/Card.jsx';
import Badge, { EmptyState } from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input, { Select } from '../components/ui/Input.jsx';
import { formatThaiDate, formatTime } from '../utils/date.js';
import { useToast } from '../context/ToastContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

const ROLE_CONFIG = {
  admin: {
    label: 'ผู้ดูแลระบบ (Admin)',
    shortLabel: 'Admin',
    icon: '👑',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800',
    desc: 'สิทธิ์สูงสุด จัดการผู้ใช้งาน กำหนดยศ เพิ่ม/แก้ไขห้องพัก และรีเซ็ตข้อมูลระบบ',
  },
  user: {
    label: 'ผู้ใช้งานทั่วไป (User)',
    shortLabel: 'User',
    icon: '👤',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    desc: 'สิทธิ์จองห้องเรียนและตรวจสอบสถานะการอนุมัติการจองทั่วไป',
  },
};

function formatEquipment(b) {
  const items = b.equipment || [];
  const other = b.otherEquipment?.trim();
  if (!items.length && !other) return '-';
  const parts = [];
  if (items.length) parts.push(items.join(', '));
  if (other) parts.push(`(อื่นๆ: ${other})`);
  return parts.join(' ');
}

function timeAgo(ts) {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return 'เมื่อสักครู่';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ชั่วโมงที่แล้ว`;
  return `${Math.floor(diffHour / 24)} วันที่แล้ว`;
}

export default function AdminPage() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filter
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [dateRange, setDateRange] = useState({ dateFrom: '', dateTo: '' });

  // Bulk Selection
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedBookingIds, setSelectedBookingIds] = useState([]);

  // Modals
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [targetRoleUser, setTargetRoleUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('user');
  const [roleSubmitting, setRoleSubmitting] = useState(false);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomForm, setRoomForm] = useState({ name: '', capacity: '', building: 'อาคารหลัก', type: 'classroom', status: 'active' });

  const loadAll = useCallback(async () => {
    try {
      const params = {};
      if (dateRange.dateFrom) params.dateFrom = dateRange.dateFrom;
      if (dateRange.dateTo) params.dateTo = dateRange.dateTo;

      const [u, b, r, logs] = await Promise.all([
        api.getUsers(),
        api.getBookings(params),
        api.getRooms(),
        api.getAuditLogs().catch(() => []),
      ]);
      setUsers(u);
      setBookings(b);
      setRooms(r);
      setAuditLogs(logs);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [dateRange, showToast]);

  const { subscribe } = useSocket();

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Real-time WebSockets: อัปเดตข้อมูลแบบทันทีทันใดเมื่อมีการเปลี่ยนแปลง
  useEffect(() => {
    const unsub1 = subscribe('BOOKINGS_UPDATED', () => loadAll());
    const unsub2 = subscribe('USERS_UPDATED', () => loadAll());
    const unsub3 = subscribe('ROOMS_UPDATED', () => loadAll());
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [subscribe, loadAll]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAll();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Reset all bookings system
  const handleResetBookings = async () => {
    setResetSubmitting(true);
    try {
      const res = await api.resetBookings();
      showToast(res.message || 'รีเซ็ตล้างข้อมูลการจองเรียบร้อยแล้ว');
      setResetModalOpen(false);
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setResetSubmitting(false);
    }
  };

  // User & Role Actions
  const openRoleModal = (user) => {
    setTargetRoleUser(user);
    setSelectedRole(user.role === 'admin' ? 'admin' : 'user');
    setRoleModalOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!targetRoleUser) return;
    setRoleSubmitting(true);
    try {
      const res = await api.updateUserRole(targetRoleUser.id, selectedRole);
      showToast(res.message || 'อัปเดตสิทธิ์ผู้ใช้งานสำเร็จ');
      setRoleModalOpen(false);
      setTargetRoleUser(null);
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRoleSubmitting(false);
    }
  };

  const approveUserWithRole = async (id, roleToAssign = 'user') => {
    try {
      await api.approveUser(id, roleToAssign);
      showToast('อนุมัติผู้ใช้งานเรียบร้อยแล้ว');
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const removeUser = async (id) => {
    const ok = await confirm({
      title: 'ยืนยันลบผู้ใช้งาน',
      message: 'คุณต้องการลบบัญชีผู้ใช้งานนี้ออกจากระบบ? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
      confirmText: 'ลบผู้ใช้งาน',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteUser(id);
      showToast('ลบผู้ใช้งานสำเร็จ');
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const bulkApproveUsers = async () => {
    if (!selectedUserIds.length) return;
    for (const id of selectedUserIds) {
      await api.approveUser(id).catch(() => {});
    }
    showToast(`อนุมัติผู้ใช้ ${selectedUserIds.length} รายการสำเร็จ`);
    setSelectedUserIds([]);
    loadAll();
  };

  const confirmBooking = async (id) => {
    await api.updateBookingStatus(id, 'confirmed');
    showToast('ยืนยันการจองสำเร็จ');
    loadAll();
  };

  const bulkConfirmBookings = async () => {
    if (!selectedBookingIds.length) return;
    for (const id of selectedBookingIds) {
      await api.updateBookingStatus(id, 'confirmed').catch(() => {});
    }
    showToast(`ยืนยันการจอง ${selectedBookingIds.length} รายการสำเร็จ`);
    setSelectedBookingIds([]);
    loadAll();
  };

  const openCancelModal = (id) => {
    setCancelTarget(id);
    setCancelReason('');
  };

  const submitCancel = async () => {
    if (!cancelReason.trim()) return showToast('กรุณาระบุเหตุผลในการยกเลิก', 'error');
    setCancelSubmitting(true);
    try {
      await api.updateBookingStatus(cancelTarget, 'cancelled', cancelReason.trim());
      showToast('ยกเลิกการจองสำเร็จ');
      setCancelTarget(null);
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handleSaveRoom = async (e) => {
    e.preventDefault();
    try {
      if (editingRoom) {
        await api.updateRoom(editingRoom.id, roomForm);
        showToast('แก้ไขข้อมูลห้องสำเร็จ');
      } else {
        await api.createRoom(roomForm);
        showToast('เพิ่มห้องใหม่สำเร็จ');
      }
      setRoomModalOpen(false);
      setEditingRoom(null);
      loadAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const toggleRoomStatus = async (room) => {
    const nextStatus = room.status === 'maintenance' ? 'active' : 'maintenance';
    await api.updateRoom(room.id, { status: nextStatus });
    showToast(`เปลี่ยนสถานะห้อง ${room.name} เป็น ${nextStatus === 'maintenance' ? 'ปิดปรับปรุง' : 'ใช้งานปกติ'}`);
    loadAll();
  };

  const deleteRoom = async (id) => {
    const ok = await confirm({
      title: 'ยืนยันลบห้อง',
      message: 'คุณต้องการลบห้องนี้ออกจากระบบ? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
      confirmText: 'ลบห้อง',
      variant: 'danger',
    });
    if (!ok) return;
    await api.deleteRoom(id);
    showToast('ลบห้องสำเร็จ');
    loadAll();
  };

  // Filtered lists
  const pendingUsers = useMemo(() => users.filter((u) => !u.approved), [users]);
  const filteredPendingUsers = useMemo(
    () => pendingUsers.filter((u) => !userSearch || u.displayName.toLowerCase().includes(userSearch.toLowerCase()) || u.username.toLowerCase().includes(userSearch.toLowerCase())),
    [pendingUsers, userSearch]
  );

  const approvedUsers = useMemo(() => users.filter((u) => u.approved), [users]);
  const filteredApprovedUsers = useMemo(
    () =>
      approvedUsers.filter((u) => {
        const matchesSearch =
          !userSearch ||
          u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.username.toLowerCase().includes(userSearch.toLowerCase());
        const userRole = u.role === 'admin' ? 'admin' : 'user';
        const matchesRole = roleFilter === 'all' || userRole === roleFilter;
        return matchesSearch && matchesRole;
      }),
    [approvedUsers, userSearch, roleFilter]
  );

  const filteredBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          !bookingSearch ||
          b.roomName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
          b.bookerName.toLowerCase().includes(bookingSearch.toLowerCase())
      ),
    [bookings, bookingSearch]
  );

  const pendingBookings = useMemo(() => bookings.filter((b) => b.status === 'pending'), [bookings]);
  const activeRooms = useMemo(() => rooms.filter((r) => r.status !== 'maintenance'), [rooms]);
  const maintenanceRooms = useMemo(() => rooms.filter((r) => r.status === 'maintenance'), [rooms]);

  if (loading) return <EmptyState>กำลังโหลดข้อมูลผู้ดูแลระบบ...</EmptyState>;

  return (
    <div className="grid gap-6">
      {/* Modern Executive Admin Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 text-2xl font-black shadow-inner border border-brand-200/60 dark:border-brand-900/50">
              🛡️
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  ศูนย์ควบคุมผู้ดูแลระบบ
                </h1>
                <span className="rounded-lg bg-brand-100 px-2.5 py-0.5 text-xs font-black text-brand-800 dark:bg-brand-950 dark:text-brand-300 border border-brand-300 dark:border-brand-800">
                  Admin Control Center
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                จัดการสิทธิ์ยศผู้ใช้งาน (Admin / User) อนุมัติการจอง บริหารจัดการห้องเรียน และล้างข้อมูลระบบ
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleRefresh}
              className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition active:scale-95 cursor-pointer ${
                isRefreshing ? 'opacity-70' : ''
              }`}
            >
              <span className={isRefreshing ? 'animate-spin inline-block' : ''}>🔄</span>
              <span>รีเฟรชข้อมูล</span>
            </button>

            <button
              type="button"
              onClick={() => setResetModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95 cursor-pointer"
            >
              <span>🗑️</span>
              <span>รีเซ็ตข้อมูลการจอง</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-amber-100/50 p-5 shadow-sm dark:border-amber-900/50 dark:from-amber-950/30 dark:to-amber-900/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-300">ผู้ใช้รออนุมัติ</p>
            <span className="text-xl">⏳</span>
          </div>
          <p className="mt-2 text-3xl font-black text-amber-700 dark:text-amber-300">{pendingUsers.length}</p>
          <p className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-400">รอเปิดสิทธิ์ใช้งานระบบ</p>
        </div>

        <div className="rounded-2xl border border-brand-200/80 bg-gradient-to-br from-brand-50 to-brand-100/50 p-5 shadow-sm dark:border-brand-900/50 dark:from-brand-950/30 dark:to-brand-900/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-wider text-brand-900 dark:text-brand-300">การจองรอยืนยัน</p>
            <span className="text-xl">📅</span>
          </div>
          <p className="mt-2 text-3xl font-black text-brand-700 dark:text-brand-300">{pendingBookings.length}</p>
          <p className="mt-1 text-[11px] text-brand-800/80 dark:text-brand-400">รอแอดมินยืนยันคำขอ</p>
        </div>

        <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50 to-blue-100/50 p-5 shadow-sm dark:border-blue-900/50 dark:from-blue-950/30 dark:to-blue-900/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-wider text-blue-900 dark:text-blue-300">ห้องใช้งานปกติ</p>
            <span className="text-xl">🚪</span>
          </div>
          <p className="mt-2 text-3xl font-black text-blue-700 dark:text-blue-300">{activeRooms.length}</p>
          <p className="mt-1 text-[11px] text-blue-800/80 dark:text-blue-400">พร้อมรองรับการจอง</p>
        </div>

        <div className="rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 to-rose-100/50 p-5 shadow-sm dark:border-rose-900/50 dark:from-rose-950/30 dark:to-rose-900/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-wider text-rose-900 dark:text-rose-300">ห้องปิดปรับปรุง</p>
            <span className="text-xl">🔧</span>
          </div>
          <p className="mt-2 text-3xl font-black text-rose-700 dark:text-rose-300">{maintenanceRooms.length}</p>
          <p className="mt-1 text-[11px] text-rose-800/80 dark:text-rose-400">อยู่ระหว่างซ่อมบำรุง</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto dark:border-slate-700 gap-2 scrollbar-none">
        {[
          { id: 'overview', label: '👑 จัดการผู้ใช้งานและยศ (Admin & User)', count: pendingUsers.length },
          { id: 'bookings', label: '📅 จัดการการจองห้อง', count: pendingBookings.length },
          { id: 'rooms', label: '🚪 จัดการห้องพัก (CRUD)', count: rooms.length },
          { id: 'audit', label: '📜 Audit Logs' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2.5 border-b-2 px-5 py-3.5 text-sm font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-950/20 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-900/50 rounded-t-xl'
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                  tab.count > 0
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    : 'bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: USER MANAGEMENT (ADMIN & USER ROLES ONLY) */}
      {activeTab === 'overview' && (
        <Card title="จัดการผู้ใช้งานและกำหนดสิทธิ์ยศ (Admin & User)" icon="👑">
          {/* Controls & Filter Bar */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:w-72">
                <input
                  type="search"
                  placeholder="🔍 ค้นหาชื่อผู้ใช้ หรือ username..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Role filter pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                {[
                  { id: 'all', label: 'ทั้งหมด' },
                  { id: 'admin', label: '👑 Admin' },
                  { id: 'user', label: '👤 User' },
                ].map((rf) => (
                  <button
                    key={rf.id}
                    type="button"
                    onClick={() => setRoleFilter(rf.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                      roleFilter === rf.id
                        ? 'bg-slate-900 text-white dark:bg-brand-500 dark:text-slate-950 shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {rf.label}
                  </button>
                ))}
              </div>
            </div>

            {selectedUserIds.length > 0 && (
              <Button variant="primary" size="sm" onClick={bulkApproveUsers}>
                ✓ อนุมัติผู้ใช้ที่เลือก ({selectedUserIds.length})
              </Button>
            )}
          </div>

          {/* Pending Users Section */}
          {filteredPendingUsers.length > 0 && (
            <section className="mb-8 rounded-2xl border border-amber-300/70 bg-gradient-to-r from-amber-50 to-orange-50/40 p-5 shadow-sm dark:border-amber-900/50 dark:from-amber-950/40 dark:to-orange-950/20">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-amber-900 dark:text-amber-300 flex items-center gap-2">
                    <span>⏳ รายชื่อผู้ใช้งานรอการอนุมัติ</span>
                    <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-black text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                      {filteredPendingUsers.length} รายการ
                    </span>
                  </h3>
                  <p className="text-xs text-amber-800/80 dark:text-amber-400">เลือกสิทธิ์ (Admin / User) และกดอนุมัติเพื่อเปิดใช้งานบัญชี</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-amber-200 bg-white dark:border-amber-900/50 dark:bg-slate-900 shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-amber-100/80 text-left text-xs font-extrabold text-amber-950 dark:bg-amber-950/80 dark:text-amber-300">
                    <tr>
                      <th className="p-3.5 w-10">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.length === filteredPendingUsers.length && filteredPendingUsers.length > 0}
                          onChange={(e) => setSelectedUserIds(e.target.checked ? filteredPendingUsers.map((u) => u.id) : [])}
                        />
                      </th>
                      <th className="p-3.5">ชื่อ-นามสกุล</th>
                      <th className="p-3.5">ชื่อผู้ใช้ (Username)</th>
                      <th className="p-3.5">สิทธิ์การใช้งาน</th>
                      <th className="p-3.5 text-right">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPendingUsers.map((u) => {
                      return (
                        <tr key={u.id} className="border-t border-amber-100 dark:border-amber-900/30 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition">
                          <td className="p-3.5">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(u.id)}
                              onChange={(e) =>
                                setSelectedUserIds((prev) =>
                                  e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                                )
                              }
                            />
                          </td>
                          <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">{u.displayName}</td>
                          <td className="p-3.5 font-mono text-xs text-slate-500 dark:text-slate-400">{u.username}</td>
                          <td className="p-3.5">
                            <select
                              defaultValue={u.role === 'admin' ? 'admin' : 'user'}
                              id={`select-role-${u.id}`}
                              className="rounded-xl border border-amber-300 bg-amber-50/50 px-2.5 py-1 text-xs font-bold text-slate-800 dark:border-amber-800 dark:bg-slate-800 dark:text-slate-200 outline-none"
                            >
                              <option value="user">👤 ผู้ใช้งานทั่วไป (User)</option>
                              <option value="admin">👑 ผู้ดูแลระบบ (Admin)</option>
                            </select>
                          </td>
                          <td className="p-3.5">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  const selectEl = document.getElementById(`select-role-${u.id}`);
                                  const chosenRole = selectEl ? selectEl.value : 'user';
                                  approveUserWithRole(u.id, chosenRole);
                                }}
                              >
                                ✓ อนุมัติเข้าใช้
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => removeUser(u.id)}>
                                ปฏิเสธ/ลบ
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Approved Users Section with Role Assignment */}
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>👥 รายชื่อผู้ใช้งานในระบบทั้งหมด</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {filteredApprovedUsers.length} คน
                </span>
              </h3>
            </div>

            {filteredApprovedUsers.length === 0 ? (
              <EmptyState>ไม่พบผู้ใช้งานตามเงื่อนไขที่ระบุ</EmptyState>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100/70 text-left text-xs font-extrabold text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                    <tr>
                      <th className="p-3.5">ผู้ใช้งาน</th>
                      <th className="p-3.5">Username</th>
                      <th className="p-3.5">ยศ / สิทธิ์ปัจจุบัน</th>
                      <th className="p-3.5">คำอธิบายสิทธิ์</th>
                      <th className="p-3.5 text-right">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredApprovedUsers.map((u) => {
                      const userRoleKey = u.role === 'admin' ? 'admin' : 'user';
                      const cfg = ROLE_CONFIG[userRoleKey];
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-lg font-black shadow-inner">
                                {cfg.icon}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 dark:text-slate-100">{u.displayName}</p>
                                <span className="text-[11px] text-slate-400">ID: {u.id.substring(0, 8)}...</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 font-mono text-xs text-slate-500 dark:text-slate-400">{u.username}</td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-black uppercase shadow-xs ${cfg.badgeClass}`}>
                              <span>{cfg.icon}</span>
                              <span>{cfg.shortLabel}</span>
                            </span>
                          </td>
                          <td className="p-3.5 max-w-[280px]">
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{cfg.desc}</p>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openRoleModal(u)}
                                className="inline-flex items-center gap-1 rounded-xl bg-purple-50 hover:bg-purple-100 px-3 py-1.5 text-xs font-black text-purple-800 border border-purple-300 dark:bg-purple-950/70 dark:hover:bg-purple-900/80 dark:text-purple-300 dark:border-purple-800 transition cursor-pointer"
                              >
                                ⚡ เปลี่ยนยศ (Admin / User)
                              </button>
                              <Button size="sm" variant="danger" onClick={() => removeUser(u.id)}>
                                ลบผู้ใช้
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </Card>
      )}

      {/* TAB 2: BOOKINGS */}
      {activeTab === 'bookings' && (
        <Card title="จัดการการจองห้อง" icon="📅">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-3 sm:grid-cols-3 flex-1">
              <input
                type="search"
                placeholder="ค้นหาชื่อห้อง หรือผู้จอง..."
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <label className="grid gap-1 text-xs font-semibold text-slate-500">
                ตั้งแต่วันที่
                <input type="date" className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-600 dark:bg-slate-800" value={dateRange.dateFrom} onChange={(e) => setDateRange({ ...dateRange, dateFrom: e.target.value })} />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-500">
                ถึงวันที่
                <input type="date" className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-600 dark:bg-slate-800" value={dateRange.dateTo} onChange={(e) => setDateRange({ ...dateRange, dateTo: e.target.value })} />
              </label>
            </div>

            <Button variant="danger" size="sm" onClick={() => setResetModalOpen(true)}>
              🗑️ ล้างข้อมูลการจองทั้งหมด ({bookings.length})
            </Button>
          </div>

          {selectedBookingIds.length > 0 && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-brand-50 p-3 dark:bg-brand-950/40">
              <span className="text-xs font-bold text-brand-800 dark:text-brand-300">เลือก {selectedBookingIds.length} รายการ</span>
              <Button size="sm" variant="secondary" onClick={bulkConfirmBookings}>✓ ยืนยันการจองทั้งหมดที่เลือก</Button>
            </div>
          )}

          {filteredBookings.length === 0 ? (
            <EmptyState>ไม่พบรายการจอง</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-bold text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedBookingIds.length === filteredBookings.filter((b) => b.status === 'pending').length && filteredBookings.filter((b) => b.status === 'pending').length > 0}
                        onChange={(e) =>
                          setSelectedBookingIds(
                            e.target.checked ? filteredBookings.filter((b) => b.status === 'pending').map((b) => b.id) : []
                          )
                        }
                      />
                    </th>
                    <th className="p-3">ห้อง</th>
                    <th className="p-3">วันที่</th>
                    <th className="p-3">เวลา</th>
                    <th className="p-3">ผู้จอง</th>
                    <th className="p-3">วัตถุประสงค์</th>
                    <th className="p-3">อุปกรณ์ที่ขอ</th>
                    <th className="p-3">สถานะ</th>
                    <th className="p-3 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b) => (
                    <tr key={b.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                      <td className="p-3">
                        {b.status === 'pending' && (
                          <input
                            type="checkbox"
                            checked={selectedBookingIds.includes(b.id)}
                            onChange={(e) =>
                              setSelectedBookingIds((prev) =>
                                e.target.checked ? [...prev, b.id] : prev.filter((id) => id !== b.id)
                              )
                            }
                          />
                        )}
                      </td>
                      <td className="p-3 font-semibold">{b.roomName}</td>
                      <td className="p-3">{formatThaiDate(b.date)}</td>
                      <td className="p-3">{formatTime(b.start)}–{formatTime(b.end)}</td>
                      <td className="p-3">{b.bookerName}</td>
                      <td className="p-3 max-w-[150px] truncate">{[...b.purpose, ...b.subjects].join(', ') || '-'}</td>
                      <td className="p-3 max-w-[150px]">{formatEquipment(b)}</td>
                      <td className="p-3">
                        <Badge status={b.status} />
                        {b.status === 'cancelled' && b.cancelReason && (
                          <p className="mt-1 max-w-[180px] text-xs text-red-500 dark:text-red-400">เหตุผล: {b.cancelReason}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          {b.status === 'pending' && <Button size="sm" variant="secondary" onClick={() => confirmBooking(b.id)}>ยืนยัน</Button>}
                          {b.status !== 'cancelled' && <Button size="sm" variant="danger" onClick={() => openCancelModal(b.id)}>ยกเลิก</Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: ROOMS (CRUD) */}
      {activeTab === 'rooms' && (
        <Card title="จัดการห้องเรียนและห้องประชุม (CRUD)" icon="🚪">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-slate-500">จัดการ เพิ่ม แก้ไข และตั้งสถานะเปิด/ปิดปรับปรุงห้องในระบบ</p>
            <Button variant="primary" size="sm" onClick={() => {
              setEditingRoom(null);
              setRoomForm({ name: '', capacity: '40 คน', building: 'อาคารหลัก', type: 'classroom', status: 'active' });
              setRoomModalOpen(true);
            }}>
              + เพิ่มห้องใหม่
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-[700px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="p-3">ชื่อห้อง</th>
                  <th className="p-3">ความจุ</th>
                  <th className="p-3">อาคาร</th>
                  <th className="p-3">ประเภท</th>
                  <th className="p-3">สถานะห้อง</th>
                  <th className="p-3 text-right">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{r.name}</td>
                    <td className="p-3">{r.capacity}</td>
                    <td className="p-3">{r.building || 'อาคารหลัก'}</td>
                    <td className="p-3 font-mono text-xs uppercase">{r.type}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${r.status === 'maintenance' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'}`}>
                        {r.status === 'maintenance' ? '🔧 ปิดปรับปรุง' : '✓ ใช้งานปกติ'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => toggleRoomStatus(r)}>
                          {r.status === 'maintenance' ? 'เปิดใช้งาน' : 'ปิดปรับปรุง'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditingRoom(r);
                          setRoomForm({ name: r.name, capacity: r.capacity, building: r.building || '', type: r.type || 'classroom', status: r.status || 'active' });
                          setRoomModalOpen(true);
                        }}>
                          แก้ไข
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => deleteRoom(r.id)}>ลบ</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <Card title="Audit Logs (ประวัติการดำเนินการของผู้ดูแลระบบ)" icon="📜">
          {auditLogs.length === 0 ? (
            <EmptyState>ยังไม่มีประวัติการบันทึก Audit Log</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-bold text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="p-3">เวลา</th>
                    <th className="p-3">แอดมิน</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-t border-slate-100 text-xs dark:border-slate-800">
                      <td className="p-3 text-slate-400 whitespace-nowrap">{timeAgo(log.createdAt)}</td>
                      <td className="p-3 font-semibold">{log.adminName}</td>
                      <td className="p-3">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Modal: Change User Role (Admin / User Only) */}
      <Modal open={roleModalOpen} onClose={() => setRoleModalOpen(false)} title={`⚡ สลับยศผู้ใช้งาน (Admin / User)`} size="md">
        {targetRoleUser && (
          <div className="grid gap-5">
            <div className="rounded-2xl bg-slate-100/70 p-4 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">ผู้ใช้งานเป้าหมาย</p>
                  <p className="text-base font-black text-slate-900 dark:text-slate-100">{targetRoleUser.displayName}</p>
                  <p className="font-mono text-xs text-slate-500">@{targetRoleUser.username}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">ยศปัจจุบัน</p>
                  <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-bold uppercase ${ROLE_CONFIG[targetRoleUser.role === 'admin' ? 'admin' : 'user']?.badgeClass}`}>
                    {ROLE_CONFIG[targetRoleUser.role === 'admin' ? 'admin' : 'user']?.icon} {ROLE_CONFIG[targetRoleUser.role === 'admin' ? 'admin' : 'user']?.shortLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                เลือกระดับยศ/สิทธิ์ที่ต้องการมอบหมาย:
              </label>

              {Object.entries(ROLE_CONFIG).map(([key, config]) => {
                const isSelected = selectedRole === key;
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedRole(key)}
                    className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/40 shadow-sm ring-2 ring-brand-500/20'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <input
                      type="radio"
                      name="userRoleRadio"
                      checked={isSelected}
                      onChange={() => setSelectedRole(key)}
                      className="mt-1 h-4 w-4 text-brand-600 focus:ring-brand-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{config.icon}</span>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{config.label}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-normal">{config.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 flex gap-3 justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button type="button" variant="neutral" onClick={() => setRoleModalOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="button" variant="primary" loading={roleSubmitting} onClick={handleUpdateRole}>
                💾 บันทึกการเปลี่ยนยศ
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Reset All Bookings Confirmation */}
      <Modal open={resetModalOpen} onClose={() => setResetModalOpen(false)} title="🚨 ยืนยันการรีเซ็ตข้อมูลการจองทั้งหมด" size="sm">
        <div className="grid gap-4">
          <div className="rounded-2xl bg-red-50 p-4 border border-red-200 dark:bg-red-950/40 dark:border-red-900/50">
            <p className="text-sm font-bold text-red-800 dark:text-red-300 flex items-center gap-2">
              <span>⚠️ คำเตือนการล้างข้อมูล!</span>
            </p>
            <p className="mt-1 text-xs text-red-700 dark:text-red-400 leading-relaxed">
              การดำเนินการนี้จะทำการลบข้อมูลรายการจองห้องทั้งหมดในระบบจำนวน <strong className="underline">{bookings.length} รายการ</strong> ออกจากฐานข้อมูลถาวร และไม่สามารถกู้คืนกลับมาได้
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="neutral" onClick={() => setResetModalOpen(false)}>
              ยกเลิก
            </Button>
            <Button variant="danger" loading={resetSubmitting} onClick={handleResetBookings}>
              🗑️ ยืนยันล้างข้อมูลทั้งหมด
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Cancel Booking Reason */}
      <Modal open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="ระบุเหตุผลในการยกเลิก" size="sm">
        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">เหตุผล (ผู้จองจะเห็นข้อความนี้)</span>
            <textarea
              className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm text-slate-800 outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="เช่น ห้องปิดปรับปรุง, ข้อมูลการจองไม่ครบถ้วน, ตารางชนกับกิจกรรมสำคัญ"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="danger" loading={cancelSubmitting} onClick={submitCancel}>ยืนยันยกเลิก</Button>
            <Button variant="neutral" onClick={() => setCancelTarget(null)}>ปิด</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add/Edit Room */}
      <Modal open={roomModalOpen} onClose={() => setRoomModalOpen(false)} title={editingRoom ? `แก้ไขห้อง ${editingRoom.name}` : 'เพิ่มห้องใหม่'} size="md">
        <form onSubmit={handleSaveRoom} className="grid gap-3">
          <Input label="ชื่อห้อง" value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} required />
          <Input label="ความจุ (เช่น 40 คน)" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} required />
          <Input label="อาคาร" value={roomForm.building} onChange={(e) => setRoomForm({ ...roomForm, building: e.target.value })} required />
          <Select label="ประเภทห้อง" value={roomForm.type} onChange={(e) => setRoomForm({ ...roomForm, type: e.target.value })}>
            <option value="classroom">ห้องเรียน (Classroom)</option>
            <option value="meeting">ห้องประชุม (Meeting)</option>
            <option value="sim">Sim Lab</option>
          </Select>
          <Select label="สถานะห้อง" value={roomForm.status} onChange={(e) => setRoomForm({ ...roomForm, status: e.target.value })}>
            <option value="active">ใช้งานปกติ (Active)</option>
            <option value="maintenance">ปิดปรับปรุง (Maintenance)</option>
          </Select>
          <div className="mt-2 flex gap-2">
            <Button type="submit" variant="primary">{editingRoom ? 'บันทึกการแก้ไข' : 'เพิ่มห้อง'}</Button>
            <Button type="button" variant="neutral" onClick={() => setRoomModalOpen(false)}>ยกเลิก</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
