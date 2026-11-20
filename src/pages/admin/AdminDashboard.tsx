import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  GraduationCap,
  History,
  FileBarChart2,
  BookOpenCheck,
  Plus,
  Search,
  Pencil,
  Trash2,
  KeyRound,
  ArrowLeft,
  Download,
  Printer,
  Power,
  CheckSquare,
  Square,
  UserPlus,
} from 'lucide-react';
import { apiFetch, downloadCsv } from '../../lib/api.ts';
import type {
  AuthUser,
  School,
  BkTeacher,
  StudentRecord,
  SchoolClass,
  AuditLog,
} from '../../shared/types.ts';
import {
  DashboardShell,
  StatCard,
  StatusLabel,
  SimpleBarChart,
  Modal,
  ConfirmModal,
  type NavItem,
} from '../../components/UiPrimitives.tsx';
import { GeminiChatPanel } from '../../components/GeminiChatPanel.tsx';
import { ImageStudioPanel } from '../../components/ImageStudioPanel.tsx';

const ADMIN_NAV: NavItem[] = [
  { id: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'sekolah', label: 'Sekolah', icon: Building2 },
  { id: 'pengguna', label: 'Pengguna', icon: Users },
  { id: 'data-siswa', label: 'Data Siswa', icon: GraduationCap },
  { id: 'audit-log', label: 'Audit Log', icon: History },
  { id: 'laporan', label: 'Laporan', icon: FileBarChart2 },
  { id: 'panduan', label: 'Panduan & Uji', icon: BookOpenCheck },
];

interface AdminOverviewData {
  stats: {
    totalSchools: number;
    activeSchools: number;
    totalBkTeachers: number;
    totalStudents: number;
    activeAccounts: number;
    totalConsultations: number;
    totalAssessments: number;
    totalUsageRecords: number;
    totalTargets: number;
    totalJournals: number;
  };
  featureUsage: Array<{ label: string; count: number }>;
  schoolDistribution: Array<{
    id: string;
    name: string;
    level: string;
    status: string;
    bkCount: number;
    studentCount: number;
    assessmentCount: number;
    consultationCount: number;
  }>;
  activityTrend: Array<{ day: string; count: number }>;
  recentAuditLogs: Array<{
    id: string;
    username: string;
    userRole: string;
    action: string;
    entityType: string;
    details: string;
    createdAt: string;
  }>;
}

interface UnifiedUserRow {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: string;
  schoolId: string | null;
  schoolName: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  bkTeacherId: string | null;
  studentId: string | null;
}

interface SchoolReportRow {
  id: string;
  name: string;
  npsn: string;
  level: string;
  status: string;
  bkCount: number;
  studentCount: number;
  assessmentCount: number;
  usageCount: number;
  targetCount: number;
  journalCount: number;
  consultationTotal: number;
  consultationWaiting: number;
  consultationProcessing: number;
  consultationDone: number;
}

const TEST_CHECKLIST_ITEMS = [
  '1. Login Admin Central berhasil dan masuk ke Dashboard Admin Central.',
  '2. Login Guru BK berhasil dan hanya menampilkan data sekolahnya.',
  '3. Login Peserta Didik berhasil dan masuk ke Dashboard Peserta Didik.',
  '4. Penambahan beberapa sekolah baru dengan NPSN unik tersimpan ke database.',
  '5. Penambahan beberapa Guru BK dalam satu sekolah berfungsi.',
  '6. Pembuatan akun Peserta Didik dan penempatan kelas berfungsi.',
  '7. Pembatasan akses antarsekolah & antar-role menolak akses ilegal (403/redirect).',
  '8. Pengisian dan penyimpanan kuesioner Cek Diri (4 indikator) berhasil.',
  '9. Penambahan, edit, dan hapus Catatan Penggunaan tersimpan.',
  '10. Pembuatan dan pembaruan progres Target Saya berhasil.',
  '11. Penyimpanan Jurnal Refleksi pribadi serta opsi berbagi sukarela ke Guru BK.',
  '12. Akses Pustaka Edukasi dengan pencarian & filter kategori berfungsi.',
  '13. Pengiriman permintaan konsultasi dari Peserta Didik ke Guru BK sekolahnya.',
  '14. Respons, perubahan status, dan penjadwalan oleh Guru BK tersimpan.',
  '15. Pengujian logout dan login kembali mempertahankan seluruh data database.',
  '16. Tampilan responsif teruji rapi pada layar HP maupun laptop.',
];

export function AdminDashboard({
  user,
  activeTab,
  onSelectTab,
  onLogout,
  accessNotice,
  onDismissNotice,
}: {
  user: AuthUser;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  accessNotice?: string | null;
  onDismissNotice?: () => void;
}) {
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [schoolDetail, setSchoolDetail] = useState<{
    school: School;
    classes: SchoolClass[];
    bkTeachers: BkTeacher[];
    students: StudentRecord[];
    stats: {
      bkCount: number;
      studentCount: number;
      assessmentCount: number;
      usageRecordCount: number;
      targetCount: number;
      consultationTotal: number;
      consultationDone: number;
    };
  } | null>(null);

  const [users, setUsers] = useState<UnifiedUserRow[]>([]);
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userSchoolFilter, setUserSchoolFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [studentSchoolFilter, setStudentSchoolFilter] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditRoleFilter, setAuditRoleFilter] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  const [reports, setReports] = useState<SchoolReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Modals State
  const [schoolModalOpen, setSchoolModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [schoolForm, setSchoolForm] = useState({
    name: '',
    npsn: '',
    level: 'SMA',
    address: '',
    email: '',
    phone: '',
    status: 'ACTIVE',
  });

  const [deleteSchoolTarget, setDeleteSchoolTarget] = useState<School | null>(null);

  const [bkModalOpen, setBkModalOpen] = useState(false);
  const [editingBk, setEditingBk] = useState<BkTeacher | null>(null);
  const [bkForm, setBkForm] = useState({
    fullName: '',
    nip: '',
    email: '',
    username: '',
    password: '',
    schoolId: '',
    title: 'Guru Bimbingan & Konseling',
    bio: '',
    status: 'ACTIVE',
  });

  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentForm, setStudentForm] = useState({
    fullName: '',
    nisNisn: '',
    gender: 'Laki-laki',
    email: '',
    username: '',
    password: '',
    schoolId: '',
    classId: '',
    status: 'ACTIVE',
  });
  const [studentFormClasses, setStudentFormClasses] = useState<SchoolClass[]>([]);

  const [classModalOpen, setClassModalOpen] = useState(false);
  const [classForm, setClassForm] = useState({ name: '', gradeLevel: '10', academicYear: '2026/2027' });

  const [resetPwdUser, setResetPwdUser] = useState<{ id: string; name: string } | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const [deleteBkTarget, setDeleteBkTarget] = useState<BkTeacher | null>(null);

  const [checkedTests, setCheckedTests] = useState<Record<number, boolean>>({});
  const [guideSubTab, setGuideSubTab] = useState<'panduan' | 'uji' | 'ai-tools'>('panduan');

  const loadOverview = useCallback(async () => {
    const data = await apiFetch<AdminOverviewData>('/api/admin/overview');
    setOverview(data);
  }, []);

  const loadSchools = useCallback(async (q = '') => {
    const data = await apiFetch<{ schools: School[] }>(`/api/admin/schools?q=${encodeURIComponent(q)}`);
    setSchools(data.schools);
  }, []);

  const loadSchoolDetail = useCallback(async (id: string) => {
    const data = await apiFetch<NonNullable<typeof schoolDetail>>(`/api/admin/schools/${id}`);
    setSchoolDetail(data);
  }, []);

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams();
    if (userRoleFilter) params.set('role', userRoleFilter);
    if (userSchoolFilter) params.set('schoolId', userSchoolFilter);
    if (userSearch) params.set('q', userSearch);
    const data = await apiFetch<{ users: UnifiedUserRow[] }>(`/api/admin/users?${params.toString()}`);
    setUsers(data.users);
  }, [userRoleFilter, userSchoolFilter, userSearch]);

  const loadStudents = useCallback(async () => {
    const params = new URLSearchParams();
    if (studentSchoolFilter) params.set('schoolId', studentSchoolFilter);
    if (studentClassFilter) params.set('className', studentClassFilter);
    if (studentSearch) params.set('q', studentSearch);
    const data = await apiFetch<{ students: StudentRecord[] }>(`/api/admin/students?${params.toString()}`);
    setStudents(data.students);
  }, [studentSchoolFilter, studentClassFilter, studentSearch]);

  const loadAuditLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (auditRoleFilter) params.set('role', auditRoleFilter);
    if (auditSearch) params.set('q', auditSearch);
    const data = await apiFetch<{ logs: AuditLog[] }>(`/api/admin/audit-logs?${params.toString()}`);
    setAuditLogs(data.logs);
  }, [auditRoleFilter, auditSearch]);

  const loadReports = useCallback(async () => {
    const data = await apiFetch<{ perSchool: SchoolReportRow[] }>('/api/admin/reports');
    setReports(data.perSchool);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFeedback(null);
    const run = async () => {
      try {
        if (activeTab === 'ringkasan') {
          await loadOverview();
        } else if (activeTab === 'sekolah') {
          await loadSchools(schoolSearch);
          if (selectedSchoolId) {
            await loadSchoolDetail(selectedSchoolId);
          }
        } else if (activeTab === 'pengguna') {
          await Promise.all([loadSchools(''), loadUsers()]);
        } else if (activeTab === 'data-siswa') {
          await Promise.all([loadSchools(''), loadStudents()]);
        } else if (activeTab === 'audit-log') {
          await loadAuditLogs();
        } else if (activeTab === 'laporan') {
          await loadReports();
        }
      } catch (err) {
        if (active) {
          setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal memuat data.' });
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [
    activeTab,
    selectedSchoolId,
    schoolSearch,
    loadOverview,
    loadSchools,
    loadSchoolDetail,
    loadUsers,
    loadStudents,
    loadAuditLogs,
    loadReports,
  ]);

  useEffect(() => {
    if (!studentForm.schoolId) {
      setStudentFormClasses([]);
      return;
    }
    apiFetch<{ classes: SchoolClass[] }>(`/api/admin/schools/${studentForm.schoolId}`)
      .then((d) => setStudentFormClasses(d.classes))
      .catch(() => setStudentFormClasses([]));
  }, [studentForm.schoolId]);

  function openAddSchool() {
    setEditingSchool(null);
    setSchoolForm({ name: '', npsn: '', level: 'SMA', address: '', email: '', phone: '', status: 'ACTIVE' });
    setSchoolModalOpen(true);
  }

  function openEditSchool(s: School) {
    setEditingSchool(s);
    setSchoolForm({
      name: s.name,
      npsn: s.npsn,
      level: s.level,
      address: s.address,
      email: s.email,
      phone: s.phone,
      status: s.status,
    });
    setSchoolModalOpen(true);
  }

  async function saveSchool(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingSchool) {
        await apiFetch(`/api/admin/schools/${editingSchool.id}`, {
          method: 'PUT',
          body: JSON.stringify(schoolForm),
        });
        setFeedback({ type: 'ok', text: `Data sekolah "${schoolForm.name}" berhasil diperbarui.` });
      } else {
        await apiFetch('/api/admin/schools', {
          method: 'POST',
          body: JSON.stringify(schoolForm),
        });
        setFeedback({ type: 'ok', text: `Sekolah "${schoolForm.name}" berhasil ditambahkan.` });
      }
      setSchoolModalOpen(false);
      await loadSchools(schoolSearch);
      if (selectedSchoolId) await loadSchoolDetail(selectedSchoolId);
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan sekolah.' });
    }
  }

  async function toggleSchoolStatus(s: School) {
    const next = s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiFetch(`/api/admin/schools/${s.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      await loadSchools(schoolSearch);
      if (selectedSchoolId === s.id) await loadSchoolDetail(s.id);
      setFeedback({ type: 'ok', text: `Status sekolah "${s.name}" diubah menjadi ${next === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal mengubah status.' });
    }
  }

  async function confirmDeleteSchool() {
    if (!deleteSchoolTarget) return;
    try {
      await apiFetch(`/api/admin/schools/${deleteSchoolTarget.id}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', text: `Sekolah "${deleteSchoolTarget.name}" telah dihapus.` });
      if (selectedSchoolId === deleteSchoolTarget.id) {
        setSelectedSchoolId(null);
        setSchoolDetail(null);
      }
      setDeleteSchoolTarget(null);
      await loadSchools(schoolSearch);
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus sekolah.' });
    }
  }

  function openAddBk(prefillSchoolId = '') {
    setEditingBk(null);
    setBkForm({
      fullName: '',
      nip: '',
      email: '',
      username: '',
      password: '',
      schoolId: prefillSchoolId || schools[0]?.id || '',
      title: 'Guru Bimbingan & Konseling',
      bio: '',
      status: 'ACTIVE',
    });
    setBkModalOpen(true);
  }

  function openEditBk(bk: BkTeacher) {
    setEditingBk(bk);
    setBkForm({
      fullName: bk.fullName,
      nip: bk.nip || '',
      email: bk.email,
      username: bk.username,
      password: '',
      schoolId: bk.schoolId,
      title: bk.title,
      bio: bk.bio || '',
      status: bk.status,
    });
    setBkModalOpen(true);
  }

  async function saveBk(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingBk) {
        await apiFetch(`/api/admin/bk-teachers/${editingBk.id}`, {
          method: 'PUT',
          body: JSON.stringify(bkForm),
        });
        setFeedback({ type: 'ok', text: `Data Guru BK "${bkForm.fullName}" berhasil diperbarui.` });
      } else {
        await apiFetch('/api/admin/bk-teachers', {
          method: 'POST',
          body: JSON.stringify(bkForm),
        });
        setFeedback({ type: 'ok', text: `Akun Guru BK "${bkForm.fullName}" berhasil dibuat dan siap digunakan login.` });
      }
      setBkModalOpen(false);
      if (selectedSchoolId) await loadSchoolDetail(selectedSchoolId);
      if (activeTab === 'pengguna') await loadUsers();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan Guru BK.' });
    }
  }

  async function confirmDeleteBk() {
    if (!deleteBkTarget) return;
    try {
      await apiFetch(`/api/admin/bk-teachers/${deleteBkTarget.id}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', text: `Akun Guru BK "${deleteBkTarget.fullName}" dihapus.` });
      setDeleteBkTarget(null);
      if (selectedSchoolId) await loadSchoolDetail(selectedSchoolId);
      if (activeTab === 'pengguna') await loadUsers();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus Guru BK.' });
    }
  }

  function openAddStudent(prefillSchoolId = '') {
    setStudentForm({
      fullName: '',
      nisNisn: '',
      gender: 'Laki-laki',
      email: '',
      username: '',
      password: '',
      schoolId: prefillSchoolId || schools[0]?.id || '',
      classId: '',
      status: 'ACTIVE',
    });
    setStudentModalOpen(true);
  }

  async function saveStudent(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/students', {
        method: 'POST',
        body: JSON.stringify(studentForm),
      });
      setFeedback({ type: 'ok', text: `Akun Peserta Didik "${studentForm.fullName}" berhasil dibuat.` });
      setStudentModalOpen(false);
      if (selectedSchoolId) await loadSchoolDetail(selectedSchoolId);
      if (activeTab === 'pengguna') await loadUsers();
      if (activeTab === 'data-siswa') await loadStudents();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal membuat akun peserta didik.' });
    }
  }

  async function toggleUserStatus(u: { id: string; username: string; status: 'ACTIVE' | 'INACTIVE' }) {
    const next = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiFetch(`/api/admin/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      setFeedback({ type: 'ok', text: `Status akun "${u.username}" diubah menjadi ${next === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}.` });
      if (activeTab === 'pengguna') await loadUsers();
      if (activeTab === 'data-siswa') await loadStudents();
      if (selectedSchoolId) await loadSchoolDetail(selectedSchoolId);
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal mengubah status akun.' });
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetPwdUser) return;
    try {
      await apiFetch(`/api/admin/users/${resetPwdUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: newPasswordInput }),
      });
      setFeedback({ type: 'ok', text: `Password untuk "${resetPwdUser.name}" berhasil direset.` });
      setResetPwdUser(null);
      setNewPasswordInput('');
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal mereset password.' });
    }
  }

  async function saveClass(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSchoolId) return;
    try {
      await apiFetch(`/api/admin/schools/${selectedSchoolId}/classes`, {
        method: 'POST',
        body: JSON.stringify(classForm),
      });
      setClassModalOpen(false);
      setClassForm({ name: '', gradeLevel: '10', academicYear: '2026/2027' });
      await loadSchoolDetail(selectedSchoolId);
      setFeedback({ type: 'ok', text: 'Kelas baru berhasil ditambahkan.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menambah kelas.' });
    }
  }

  function exportAdminReportCsv() {
    downloadCsv(
      `laporan-digital-balance-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Sekolah',
        'NPSN',
        'Jenjang',
        'Status',
        'Guru BK',
        'Peserta Didik',
        'Cek Diri',
        'Catatan Penggunaan',
        'Target',
        'Jurnal (Agregat)',
        'Konsultasi Total',
        'Konsultasi Selesai',
      ],
      reports.map((r) => [
        r.name,
        r.npsn,
        r.level,
        r.status,
        r.bkCount,
        r.studentCount,
        r.assessmentCount,
        r.usageCount,
        r.targetCount,
        r.journalCount,
        r.consultationTotal,
        r.consultationDone,
      ])
    );
  }

  return (
    <DashboardShell
      roleTitle="ADMIN CENTRAL"
      subtitle="Pengelola Multi-Sekolah"
      userName={user.fullName}
      navItems={ADMIN_NAV}
      activeTab={activeTab}
      onSelectTab={(tab) => {
        if (tab !== 'sekolah') {
          setSelectedSchoolId(null);
          setSchoolDetail(null);
        }
        onSelectTab(tab);
      }}
      onLogout={onLogout}
      mobileBottomIds={['ringkasan', 'sekolah', 'pengguna', 'laporan']}
      accessNotice={accessNotice}
      onDismissNotice={onDismissNotice}
    >
      {feedback && (
        <div
          className={`mb-5 px-4 py-3 rounded-xl border text-sm flex items-center justify-between gap-4 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-xs font-semibold underline shrink-0">
            Tutup
          </button>
        </div>
      )}

      {/* 1. RINGKASAN */}
      {activeTab === 'ringkasan' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display">Ringkasan Sistem</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Statistik keseluruhan DIGITAL BALANCE berdasarkan data langsung dari database.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onSelectTab('sekolah');
                openAddSchool();
              }}
              className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Sekolah</span>
            </button>
          </div>

          {overview ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatCard label="Sekolah Terdaftar" value={overview.stats.totalSchools} subtext={`${overview.stats.activeSchools} sekolah aktif`} accent />
                <StatCard label="Total Guru BK" value={overview.stats.totalBkTeachers} subtext="Pendamping sekolah" />
                <StatCard label="Peserta Didik" value={overview.stats.totalStudents} subtext="Terdaftar lintas sekolah" />
                <StatCard label="Akun Aktif" value={overview.stats.activeAccounts} subtext="Semua role aktif" />
                <StatCard label="Aktivitas Cek Diri" value={overview.stats.totalAssessments} subtext="Total pengisian" />
                <StatCard label="Permintaan Konsultasi" value={overview.stats.totalConsultations} subtext="Agregat layanan BK" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-slate-900 mb-1">Statistik Penggunaan Fitur</h2>
                  <p className="text-xs text-slate-500 mb-5">Jumlah entri nyata pada setiap layanan DIGITAL BALANCE</p>
                  <SimpleBarChart
                    data={overview.featureUsage.map((f) => ({ label: f.label, value: f.count }))}
                    unit="entri"
                  />
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-slate-900 mb-1">Perkembangan Aktivitas Pengguna</h2>
                  <p className="text-xs text-slate-500 mb-5">Aktivitas sistem harian tercatat dalam Audit Log</p>
                  <SimpleBarChart
                    data={overview.activityTrend.map((d) => ({ label: d.day, value: d.count }))}
                    unit="aktivitas"
                    emptyText="Belum ada aktivitas tercatat."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">Sebaran Sekolah</h2>
                    <button
                      type="button"
                      onClick={() => onSelectTab('sekolah')}
                      className="text-xs font-semibold text-violet-700 hover:underline"
                    >
                      Kelola Sekolah
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-5 py-3 font-medium">Sekolah</th>
                          <th className="text-right px-4 py-3 font-medium">Guru BK</th>
                          <th className="text-right px-4 py-3 font-medium">Siswa</th>
                          <th className="text-left px-5 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {overview.schoolDistribution.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="px-5 py-3 font-medium text-slate-900">{s.name}</td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">{s.bkCount}</td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">{s.studentCount}</td>
                            <td className="px-5 py-3">
                              <StatusLabel status={s.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">Aktivitas Terbaru (Audit Log)</h2>
                    <button
                      type="button"
                      onClick={() => onSelectTab('audit-log')}
                      className="text-xs font-semibold text-violet-700 hover:underline"
                    >
                      Lihat Semua
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {overview.recentAuditLogs.map((log) => (
                      <div key={log.id} className="px-5 py-3 text-xs space-y-0.5">
                        <div className="flex items-center justify-between text-slate-500">
                          <span className="font-semibold text-slate-800">{log.username} · {log.action}</span>
                          <span className="font-mono tabular-nums">{log.createdAt.slice(0, 16)}</span>
                        </div>
                        <p className="text-slate-600">{log.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-sm text-slate-500">Memuat statistik sistem...</div>
          )}
        </div>
      )}

      {/* 2. SEKOLAH & DETAIL SEKOLAH */}
      {activeTab === 'sekolah' && !selectedSchoolId && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display">Manajemen Sekolah</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Kelola sekolah mitra, detail kelas, Guru BK, dan status operasional dalam satu sistem.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddSchool}
              className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 self-start"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Sekolah</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={schoolSearch}
              onChange={(e) => setSchoolSearch(e.target.value)}
              placeholder="Cari sekolah berdasarkan nama atau NPSN..."
              className="flex-1 text-sm bg-transparent focus:outline-none text-slate-900"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Nama Sekolah &amp; NPSN</th>
                    <th className="text-left px-4 py-3 font-medium">Jenjang</th>
                    <th className="text-right px-4 py-3 font-medium">Guru BK</th>
                    <th className="text-right px-4 py-3 font-medium">Peserta Didik</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-5 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schools.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => setSelectedSchoolId(s.id)}
                          className="text-left font-semibold text-violet-700 hover:underline"
                        >
                          {s.name}
                        </button>
                        <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                          NPSN {s.npsn} · {s.email}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">{s.level}</td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-900">{s.bkCount ?? 0}</td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-900">{s.studentCount ?? 0}</td>
                      <td className="px-4 py-3.5">
                        <StatusLabel status={s.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSchoolId(s.id)}
                            className="px-2.5 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-md"
                          >
                            Detail
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditSchool(s)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                            title="Edit Sekolah"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSchoolStatus(s)}
                            className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-md"
                            title={s.status === 'ACTIVE' ? 'Nonaktifkan Sekolah' : 'Aktifkan Sekolah'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteSchoolTarget(s)}
                            className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                            title="Hapus Sekolah"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!schools.length && !loading && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                        Tidak ada sekolah yang sesuai dengan pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2B. DETAIL SEKOLAH */}
      {activeTab === 'sekolah' && selectedSchoolId && schoolDetail && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedSchoolId(null);
                  setSchoolDetail(null);
                }}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 mt-0.5"
                aria-label="Kembali ke daftar sekolah"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-slate-900 font-display">{schoolDetail.school.name}</h1>
                  <StatusLabel status={schoolDetail.school.status} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  NPSN {schoolDetail.school.npsn} · Jenjang {schoolDetail.school.level} · {schoolDetail.school.address} · {schoolDetail.school.phone}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start">
              <button
                type="button"
                onClick={() => openAddBk(schoolDetail.school.id)}
                className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>TAMBAH GURU BK</span>
              </button>
              <button
                type="button"
                onClick={() => openAddStudent(schoolDetail.school.id)}
                className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Siswa</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Guru BK Bertugas" value={schoolDetail.stats.bkCount} accent />
            <StatCard label="Peserta Didik" value={schoolDetail.stats.studentCount} />
            <StatCard label="Aktivitas Cek Diri" value={schoolDetail.stats.assessmentCount} />
            <StatCard
              label="Konsultasi (Selesai)"
              value={`${schoolDetail.stats.consultationTotal} (${schoolDetail.stats.consultationDone})`}
            />
          </div>

          {/* Guru BK List */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Data Guru BK</h2>
                <p className="text-xs text-slate-500">Satu sekolah dapat memiliki beberapa Guru BK aktif.</p>
              </div>
              <button
                type="button"
                onClick={() => openAddBk(schoolDetail.school.id)}
                className="text-xs font-semibold text-violet-700 hover:underline"
              >
                + Tambah Guru BK
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Nama &amp; Jabatan</th>
                    <th className="text-left px-4 py-3 font-medium">NIP</th>
                    <th className="text-left px-4 py-3 font-medium">Username / Email</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-5 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schoolDetail.bkTeachers.map((bk) => (
                    <tr key={bk.id}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{bk.fullName}</div>
                        <div className="text-xs text-slate-500">{bk.title}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{bk.nip || '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div className="font-mono text-slate-800">{bk.username}</div>
                        <div>{bk.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusLabel status={bk.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditBk(bk)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                            title="Edit Guru BK"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setResetPwdUser({ id: bk.userId, name: bk.fullName })}
                            className="p-1.5 text-slate-600 hover:text-violet-700 hover:bg-violet-50 rounded-md"
                            title="Reset Password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteBkTarget(bk)}
                            className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                            title="Hapus Guru BK"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!schoolDetail.bkTeachers.length && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                        Belum ada Guru BK terdaftar di sekolah ini. Klik TAMBAH GURU BK untuk mendaftarkan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Classes & Students */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Daftar Kelas</h2>
                <button
                  type="button"
                  onClick={() => setClassModalOpen(true)}
                  className="text-xs font-semibold text-violet-700 hover:underline"
                >
                  + Kelas
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {schoolDetail.classes.map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-slate-900">{c.name}</span>
                      <span className="text-xs text-slate-500 ml-2">Tingkat {c.gradeLevel}</span>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-600">
                      {c.studentCount ?? 0} siswa
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-900">Data Peserta Didik (Identitas Dasar)</h2>
                <p className="text-xs text-slate-500">Jurnal pribadi dan isi konsultasi tetap bersifat rahasia.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-5 py-3 font-medium">Nama</th>
                      <th className="text-left px-4 py-3 font-medium">NIS/NISN</th>
                      <th className="text-left px-4 py-3 font-medium">Kelas</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schoolDetail.students.map((st) => (
                      <tr key={st.id}>
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-900">{st.fullName}</div>
                          <div className="text-xs text-slate-500 font-mono">{st.username}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{st.nisNisn}</td>
                        <td className="px-4 py-3 text-slate-700">{st.className || '-'}</td>
                        <td className="px-4 py-3">
                          <StatusLabel status={st.status} />
                        </td>
                      </tr>
                    ))}
                    {!schoolDetail.students.length && (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                          Belum ada peserta didik terdaftar di sekolah ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. PENGGUNA */}
      {activeTab === 'pengguna' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display">Manajemen Pengguna</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Kelola akun Admin Central, Guru BK, dan Peserta Didik di seluruh sekolah.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openAddBk()}
                className="px-3.5 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Tambah Guru BK</span>
              </button>
              <button
                type="button"
                onClick={() => openAddStudent()}
                className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Peserta Didik</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Cari nama, username, email..."
                className="w-full text-sm bg-transparent focus:outline-none"
              />
            </div>
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="">Semua Role</option>
              <option value="ADMIN_CENTRAL">Admin Central</option>
              <option value="GURU_BK">Guru BK</option>
              <option value="PESERTA_DIDIK">Peserta Didik</option>
            </select>
            <select
              value={userSchoolFilter}
              onChange={(e) => setUserSchoolFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="">Semua Sekolah</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Nama Pengguna</th>
                    <th className="text-left px-4 py-3 font-medium">Username</th>
                    <th className="text-left px-4 py-3 font-medium">Role</th>
                    <th className="text-left px-4 py-3 font-medium">Sekolah</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Terdaftar</th>
                    <th className="text-right px-5 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{u.fullName}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{u.username}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-violet-700">{u.role}</td>
                      <td className="px-4 py-3 text-slate-700">{u.schoolName}</td>
                      <td className="px-4 py-3">
                        <StatusLabel status={u.status} />
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-xs text-slate-500">
                        {u.createdAt.slice(0, 10)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setResetPwdUser({ id: u.id, name: u.fullName })}
                            className="p-1.5 text-slate-600 hover:text-violet-700 hover:bg-violet-50 rounded-md"
                            title="Reset Password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          {u.id !== user.id && (
                            <button
                              type="button"
                              onClick={() => toggleUserStatus(u)}
                              className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-md"
                              title={u.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. DATA SISWA */}
      {activeTab === 'data-siswa' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">Data Siswa Lintas Sekolah</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Menampilkan identitas dasar dan status akun peserta didik. Jurnal pribadi dan isi konsultasi tetap bersifat rahasia.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Cari nama, username, NIS/NISN..."
                className="w-full text-sm bg-transparent focus:outline-none"
              />
            </div>
            <select
              value={studentSchoolFilter}
              onChange={(e) => setStudentSchoolFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="">Semua Sekolah</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={studentClassFilter}
              onChange={(e) => setStudentClassFilter(e.target.value)}
              placeholder="Filter nama kelas (contoh: X IPA 1)"
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Nama Siswa</th>
                    <th className="text-left px-4 py-3 font-medium">NIS/NISN</th>
                    <th className="text-left px-4 py-3 font-medium">Sekolah</th>
                    <th className="text-left px-4 py-3 font-medium">Kelas</th>
                    <th className="text-left px-4 py-3 font-medium">Status Akun</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{st.fullName}</div>
                        <div className="text-xs text-slate-500 font-mono">{st.username} · {st.email}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{st.nisNisn}</td>
                      <td className="px-4 py-3 text-slate-700">{st.schoolName}</td>
                      <td className="px-4 py-3 text-slate-700">{st.className}</td>
                      <td className="px-4 py-3">
                        <StatusLabel status={st.status} />
                      </td>
                    </tr>
                  ))}
                  {!students.length && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                        Tidak ada data siswa yang sesuai filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. AUDIT LOG */}
      {activeTab === 'audit-log' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">Audit Log Sistem</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Catatan kronologis aktivitas autentikasi, pengelolaan sekolah, akun Guru BK, dan perubahan status.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Cari username, aksi, atau keterangan..."
                className="w-full text-sm bg-transparent focus:outline-none"
              />
            </div>
            <select
              value={auditRoleFilter}
              onChange={(e) => setAuditRoleFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="">Semua Role</option>
              <option value="ADMIN_CENTRAL">Admin Central</option>
              <option value="GURU_BK">Guru BK</option>
              <option value="PESERTA_DIDIK">Peserta Didik</option>
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Waktu</th>
                    <th className="text-left px-4 py-3 font-medium">Pengguna</th>
                    <th className="text-left px-4 py-3 font-medium">Aksi</th>
                    <th className="text-left px-5 py-3 font-medium">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((l) => (
                    <tr key={l.id}>
                      <td className="px-5 py-3 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                        {l.createdAt}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-semibold text-slate-900">{l.username}</div>
                        <div className="text-slate-500">{l.userRole}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-violet-700 whitespace-nowrap">
                        {l.action}
                      </td>
                      <td className="px-5 py-3 text-slate-700">{l.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. LAPORAN */}
      {activeTab === 'laporan' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display">Laporan Sistem Multi-Sekolah</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Rekapitulasi agregat aktivitas layanan DIGITAL BALANCE per sekolah tanpa memaparkan data pribadi sensitif.
              </p>
            </div>
            <div className="flex items-center gap-2 no-print">
              <button
                type="button"
                onClick={exportAdminReportCsv}
                className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Unduh CSV</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Sekolah</th>
                    <th className="text-right px-3 py-3 font-medium">Guru BK</th>
                    <th className="text-right px-3 py-3 font-medium">Siswa</th>
                    <th className="text-right px-3 py-3 font-medium">Cek Diri</th>
                    <th className="text-right px-3 py-3 font-medium">Catatan</th>
                    <th className="text-right px-3 py-3 font-medium">Target</th>
                    <th className="text-right px-5 py-3 font-medium">Konsultasi (Selesai)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900">{r.name}</div>
                        <div className="text-xs text-slate-500">NPSN {r.npsn} · {r.level}</div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{r.bkCount}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{r.studentCount}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{r.assessmentCount}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{r.usageCount}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{r.targetCount}</td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {r.consultationTotal} ({r.consultationDone})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. PANDUAN & UJI */}
      {activeTab === 'panduan' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">Panduan &amp; Pengujian Aplikasi</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Petunjuk operasional tiap role, daftar periksa pengujian fungsional, dan alat bantu AI materi.
            </p>
          </div>

          <div className="inline-flex p-1 bg-slate-200/70 rounded-lg gap-1">
            {[
              { id: 'panduan', label: 'Panduan Peran' },
              { id: 'uji', label: 'Checklist Pengujian' },
              { id: 'ai-tools', label: 'Asisten & Studio Ilustrasi' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setGuideSubTab(t.id as typeof guideSubTab)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  guideSubTab === t.id ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {guideSubTab === 'panduan' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="text-base font-semibold text-violet-700">Panduan Admin Central</h2>
                <ul className="text-sm text-slate-600 space-y-2 list-disc pl-4">
                  <li>Tambahkan sekolah baru beserta NPSN dan jenjang pendidikan di menu Sekolah.</li>
                  <li>Masuk ke Detail Sekolah lalu klik TAMBAH GURU BK untuk mendaftarkan satu atau beberapa Guru BK.</li>
                  <li>Kelola status aktif/nonaktif akun maupun reset password di menu Pengguna.</li>
                  <li>Pantau Audit Log dan unduh laporan agregat multi-sekolah di menu Laporan.</li>
                </ul>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="text-base font-semibold text-violet-700">Panduan Guru BK</h2>
                <ul className="text-sm text-slate-600 space-y-2 list-disc pl-4">
                  <li>Kelola peserta didik dan kelas khusus di sekolah tempat bertugas.</li>
                  <li>Pantau ringkasan agregat 4 indikator Cek Diri sebagai pemetaan kebutuhan layanan non-diagnostik.</li>
                  <li>Tanggapi permintaan konsultasi siswa dengan status Menunggu, Diproses, atau Selesai beserta jadwal sesi.</li>
                  <li>Baca catatan refleksi yang dibagikan siswa secara sukarela pada menu Catatan dan Refleksi.</li>
                </ul>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="text-base font-semibold text-violet-700">Panduan Peserta Didik</h2>
                <ul className="text-sm text-slate-600 space-y-2 list-disc pl-4">
                  <li>Isi Cek Diri secara berkala untuk memahami pola penggunaan media sosial pribadi.</li>
                  <li>Catat durasi dan tujuan penggunaan aplikasi di menu Catatan Penggunaan.</li>
                  <li>Buat target harian atau mingguan di Target Saya dan pantau progresnya.</li>
                  <li>Tulis Jurnal Refleksi (bersifat pribadi) dan hubungi Guru BK sekolah bila butuh pendampingan.</li>
                </ul>
              </div>
            </div>
          )}

          {guideSubTab === 'uji' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-semibold text-slate-900">Checklist Pengujian Fungsi DIGITAL BALANCE</h2>
                <span className="text-xs font-mono tabular-nums text-violet-700 font-semibold">
                  {Object.values(checkedTests).filter(Boolean).length} / {TEST_CHECKLIST_ITEMS.length} Teruji
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {TEST_CHECKLIST_ITEMS.map((item, idx) => {
                  const checked = Boolean(checkedTests[idx]);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCheckedTests((p) => ({ ...p, [idx]: !p[idx] }))}
                      className="w-full py-3 flex items-center gap-3 text-left text-sm hover:bg-slate-50 px-2 rounded-lg"
                    >
                      {checked ? (
                        <CheckSquare className="w-4 h-4 text-violet-700 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className={checked ? 'line-through text-slate-400' : 'text-slate-800'}>{item}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {guideSubTab === 'ai-tools' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GeminiChatPanel
                userRoleLabel="Admin Central"
                defaultPrompts={[
                  'Buatkan kerangka panduan literasi digital untuk sekolah mitra baru',
                  'Rancang ide topik materi edukasi tentang kontrol diri media sosial',
                ]}
              />
              <ImageStudioPanel />
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      <Modal
        open={schoolModalOpen}
        onClose={() => setSchoolModalOpen(false)}
        title={editingSchool ? 'Edit Data Sekolah' : 'Tambah Sekolah Baru'}
      >
        <form onSubmit={saveSchool} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nama Sekolah</label>
            <input
              required
              type="text"
              value={schoolForm.name}
              onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
              placeholder="Contoh: SMA Negeri 3 Nusantara"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">NPSN</label>
              <input
                required
                type="text"
                value={schoolForm.npsn}
                onChange={(e) => setSchoolForm({ ...schoolForm, npsn: e.target.value })}
                placeholder="8 digit NPSN"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Jenjang Pendidikan</label>
              <select
                value={schoolForm.level}
                onChange={(e) => setSchoolForm({ ...schoolForm, level: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="SMP">SMP / MTs</option>
                <option value="SMA">SMA / MA</option>
                <option value="SMK">SMK</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Alamat Sekolah</label>
            <input
              required
              type="text"
              value={schoolForm.address}
              onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Sekolah</label>
              <input
                required
                type="email"
                value={schoolForm.email}
                onChange={(e) => setSchoolForm({ ...schoolForm, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nomor Telepon</label>
              <input
                required
                type="text"
                value={schoolForm.phone}
                onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Status Sekolah</label>
            <select
              value={schoolForm.status}
              onChange={(e) => setSchoolForm({ ...schoolForm, status: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            >
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSchoolModalOpen(false)}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
            >
              Batal
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-violet-700 text-white rounded-lg hover:bg-violet-800">
              Simpan Sekolah
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={bkModalOpen}
        onClose={() => setBkModalOpen(false)}
        title={editingBk ? 'Edit Data Guru BK' : 'Tambah Guru BK'}
      >
        <form onSubmit={saveBk} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Sekolah Tempat Bertugas</label>
            <select
              required
              value={bkForm.schoolId}
              onChange={(e) => setBkForm({ ...bkForm, schoolId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            >
              <option value="">-- Pilih Sekolah --</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap</label>
              <input
                required
                type="text"
                value={bkForm.fullName}
                onChange={(e) => setBkForm({ ...bkForm, fullName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">NIP (Opsional)</label>
              <input
                type="text"
                value={bkForm.nip}
                onChange={(e) => setBkForm({ ...bkForm, nip: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                required
                type="email"
                value={bkForm.email}
                onChange={(e) => setBkForm({ ...bkForm, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Username</label>
              <input
                required
                type="text"
                value={bkForm.username}
                onChange={(e) => setBkForm({ ...bkForm, username: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>
          {!editingBk && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password Awal (min. 6 karakter)</label>
              <input
                required
                type="password"
                minLength={6}
                value={bkForm.password}
                onChange={(e) => setBkForm({ ...bkForm, password: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Jabatan</label>
              <input
                type="text"
                value={bkForm.title}
                onChange={(e) => setBkForm({ ...bkForm, title: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status Akun</label>
              <select
                value={bkForm.status}
                onChange={(e) => setBkForm({ ...bkForm, status: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setBkModalOpen(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">
              Batal
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-violet-700 text-white rounded-lg hover:bg-violet-800">
              Simpan Guru BK
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={studentModalOpen} onClose={() => setStudentModalOpen(false)} title="Tambah Akun Peserta Didik">
        <form onSubmit={saveStudent} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Sekolah</label>
              <select
                required
                value={studentForm.schoolId}
                onChange={(e) => setStudentForm({ ...studentForm, schoolId: e.target.value, classId: '' })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="">-- Pilih Sekolah --</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Kelas</label>
              <select
                value={studentForm.classId}
                onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="">-- Pilih Kelas --</option>
                {studentFormClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap</label>
              <input
                required
                type="text"
                value={studentForm.fullName}
                onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">NIS / NISN</label>
              <input
                required
                type="text"
                value={studentForm.nisNisn}
                onChange={(e) => setStudentForm({ ...studentForm, nisNisn: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                required
                type="email"
                value={studentForm.email}
                onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Username</label>
              <input
                required
                type="text"
                value={studentForm.username}
                onChange={(e) => setStudentForm({ ...studentForm, username: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Password Awal</label>
            <input
              required
              type="password"
              minLength={6}
              value={studentForm.password}
              onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setStudentModalOpen(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">
              Batal
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-violet-700 text-white rounded-lg hover:bg-violet-800">
              Buat Akun Siswa
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={classModalOpen} onClose={() => setClassModalOpen(false)} title="Tambah Kelas Baru" maxWidth="max-w-sm">
        <form onSubmit={saveClass} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nama Kelas</label>
            <input
              required
              type="text"
              value={classForm.name}
              onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
              placeholder="Contoh: X IPA 2"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tingkat</label>
            <input
              required
              type="text"
              value={classForm.gradeLevel}
              onChange={(e) => setClassForm({ ...classForm, gradeLevel: e.target.value })}
              placeholder="Contoh: 10"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setClassModalOpen(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">
              Batal
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-violet-700 text-white rounded-lg">
              Simpan
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(resetPwdUser)}
        onClose={() => setResetPwdUser(null)}
        title={`Reset Password: ${resetPwdUser?.name ?? ''}`}
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Password Baru (min. 6 karakter)</label>
            <input
              required
              type="password"
              minLength={6}
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setResetPwdUser(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">
              Batal
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-violet-700 text-white rounded-lg">
              Reset Password
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteSchoolTarget)}
        onClose={() => setDeleteSchoolTarget(null)}
        onConfirm={confirmDeleteSchool}
        title="Konfirmasi Hapus Sekolah"
        message={`Menghapus "${deleteSchoolTarget?.name}" akan menghapus seluruh data kelas, akun Guru BK, peserta didik, dan aktivitas sekolah tersebut. Lanjutkan?`}
      />

      <ConfirmModal
        open={Boolean(deleteBkTarget)}
        onClose={() => setDeleteBkTarget(null)}
        onConfirm={confirmDeleteBk}
        title="Konfirmasi Hapus Guru BK"
        message={`Hapus akun Guru BK "${deleteBkTarget?.fullName}" dari sistem?`}
      />
    </DashboardShell>
  );
}
