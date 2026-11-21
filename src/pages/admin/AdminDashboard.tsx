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
  Link2,
  Check,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Activity,
  Timer,
  Zap,
  ArrowRight,
  FileSpreadsheet,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiFetch, downloadCsv, formatLocalDateTime, formatLocalDate } from '../../lib/api.ts';
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
  schoolsList: Array<{
    id: string;
    name: string;
    level: string;
    status: string;
  }>;
  stats: {
    totalSchools: number;
    activeSchools: number;
    totalClasses: number;
    totalBkTeachers: number;
    activeBkTeachers: number;
    totalStudents: number;
    assessedStudents: number;
    assessmentCompletionPct: number;
    activeAccounts: number;
    totalConsultations: number;
    pendingConsultations: number;
    doneConsultations: number;
    attentionAlerts: number;
    totalAssessments: number;
    avgAssessmentScore: number;
    totalUsageRecords: number;
    totalTargets: number;
    completedTargets: number;
    targetCompletionPct: number;
    totalJournals: number;
    sharedJournals: number;
    totalFocusSessions: number;
  };
  featureUsage: Array<{ label: string; count: number }>;
  schoolDistribution: Array<{
    id: string;
    name: string;
    level: string;
    address: string;
    status: string;
    createdAt: string;
    bkCount: number;
    studentCount: number;
    userCount: number;
    classCount: number;
    assessmentCount: number;
    consultationCount: number;
    alertCount: number;
  }>;
  activityTrend: Array<{ day: string; count: number }>;
  activity7dBreakdown: {
    assessments: number;
    journals: number;
    usageRecords: number;
    consultations: number;
    totalEvents: number;
  };
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
  schoolLevel?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  bkTeacherId: string | null;
  studentId: string | null;
  nisNisn?: string | null;
  className?: string | null;
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
  onUserUpdated,
  accessNotice,
  onDismissNotice,
}: {
  user: AuthUser;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  onUserUpdated?: (updated: AuthUser) => void;
  accessNotice?: string | null;
  onDismissNotice?: () => void;
}) {
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [overviewSchoolFilter, setOverviewSchoolFilter] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [detailModalSchoolId, setDetailModalSchoolId] = useState<string | null>(null);
  const [detailModalLoading, setDetailModalLoading] = useState(false);
  const [copiedSchoolLink, setCopiedSchoolLink] = useState(false);
  const [schoolDetail, setSchoolDetail] = useState<{
    school: School;
    classes: SchoolClass[];
    bkTeachers: BkTeacher[];
    students: StudentRecord[];
    stats: {
      bkCount: number;
      studentCount: number;
      assessmentCount: number;
      journalCount?: number;
      reflectionCount?: number;
      reflection30dCount?: number;
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
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: string; fullName: string; roleLabel: string } | null>(null);
  const [deleteAuditTarget, setDeleteAuditTarget] = useState<AuditLog | null>(null);
  const [clearAuditModalOpen, setClearAuditModalOpen] = useState(false);

  const [adminAccountModalOpen, setAdminAccountModalOpen] = useState(false);
  const [adminAccountForm, setAdminAccountForm] = useState({
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    currentPassword: '',
    newPassword: '',
  });
  const [adminAccountSaving, setAdminAccountSaving] = useState(false);

  const [checkedTests, setCheckedTests] = useState<Record<number, boolean>>({});
  const [guideSubTab, setGuideSubTab] = useState<'panduan' | 'uji' | 'ai-tools'>('panduan');

  const loadOverview = useCallback(async () => {
    const query = overviewSchoolFilter ? `?schoolId=${encodeURIComponent(overviewSchoolFilter)}` : '';
    const data = await apiFetch<AdminOverviewData>(`/api/admin/overview${query}`);
    setOverview(data);
  }, [overviewSchoolFilter]);

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

  async function openSchoolDetailModal(id: string) {
    setDetailModalSchoolId(id);
    setCopiedSchoolLink(false);
    setDetailModalLoading(true);
    try {
      await loadSchoolDetail(id);
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal memuat detail sekolah.' });
      setDetailModalSchoolId(null);
    } finally {
      setDetailModalLoading(false);
    }
  }

  async function copyStudentLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSchoolLink(true);
      setTimeout(() => setCopiedSchoolLink(false), 2200);
    } catch {
      setFeedback({ type: 'err', text: 'Gagal menyalin tautan ke clipboard. Salin tautan secara manual.' });
    }
  }

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
      const refreshId = selectedSchoolId || detailModalSchoolId;
      if (refreshId) await loadSchoolDetail(refreshId);
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
      if (selectedSchoolId === s.id || detailModalSchoolId === s.id) await loadSchoolDetail(s.id);
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
      if (selectedSchoolId === deleteSchoolTarget.id || detailModalSchoolId === deleteSchoolTarget.id) {
        setSelectedSchoolId(null);
        setDetailModalSchoolId(null);
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
      await loadSchools(schoolSearch);
      const refreshId = selectedSchoolId || detailModalSchoolId;
      if (refreshId) await loadSchoolDetail(refreshId);
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
      await loadSchools(schoolSearch);
      const refreshId = selectedSchoolId || detailModalSchoolId;
      if (refreshId) await loadSchoolDetail(refreshId);
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
      await loadSchools(schoolSearch);
      const refreshId = selectedSchoolId || detailModalSchoolId;
      if (refreshId) await loadSchoolDetail(refreshId);
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

  async function confirmDeleteUser() {
    if (!deleteUserTarget) return;
    try {
      await apiFetch(`/api/admin/users/${deleteUserTarget.id}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', text: `Akun ${deleteUserTarget.roleLabel} "${deleteUserTarget.fullName}" berhasil dihapus.` });
      setDeleteUserTarget(null);
      if (activeTab === 'pengguna') await loadUsers();
      if (activeTab === 'data-siswa') await loadStudents();
      if (selectedSchoolId) await loadSchoolDetail(selectedSchoolId);
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus akun pengguna.' });
    }
  }

  async function confirmDeleteAuditLog() {
    if (!deleteAuditTarget) return;
    try {
      await apiFetch(`/api/admin/audit-logs/${deleteAuditTarget.id}`, { method: 'DELETE' });
      setDeleteAuditTarget(null);
      setFeedback({ type: 'ok', text: 'Satu entri riwayat Audit Log telah dihapus.' });
      await loadAuditLogs();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus riwayat log.' });
    }
  }

  async function confirmClearAuditLogs() {
    try {
      await apiFetch('/api/admin/audit-logs', { method: 'DELETE' });
      setClearAuditModalOpen(false);
      setFeedback({ type: 'ok', text: 'Seluruh riwayat Audit Log telah dibersihkan.' });
      await loadAuditLogs();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal membersihkan riwayat log.' });
    }
  }

  function openAdminAccountModal() {
    setAdminAccountForm({
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      currentPassword: '',
      newPassword: '',
    });
    setAdminAccountModalOpen(true);
  }

  async function saveAdminAccount(e: React.FormEvent) {
    e.preventDefault();
    setAdminAccountSaving(true);
    try {
      const res = await apiFetch<{ ok: boolean; user?: AuthUser }>('/api/admin/account', {
        method: 'PUT',
        body: JSON.stringify(adminAccountForm),
      });
      if (res.user && onUserUpdated) {
        onUserUpdated(res.user);
      }
      setAdminAccountModalOpen(false);
      setFeedback({
        type: 'ok',
        text: 'Kredensial akun Admin Central berhasil diperbarui. Simpan username dan password baru Anda secara pribadi.',
      });
      if (activeTab === 'pengguna') await loadUsers();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal memperbarui akun Admin.' });
    } finally {
      setAdminAccountSaving(false);
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

  function downloadSchoolReportRows(rowsInput: SchoolReportRow[]) {
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
      rowsInput.map((r) => [
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

  function exportAdminReportCsv() {
    downloadSchoolReportRows(reports);
  }

  async function handleDownloadOverviewExcel() {
    try {
      const data = await apiFetch<{ perSchool: SchoolReportRow[] }>('/api/admin/reports');
      const filteredRows = overviewSchoolFilter
        ? data.perSchool.filter((row) => row.id === overviewSchoolFilter)
        : data.perSchool;
      downloadSchoolReportRows(filteredRows);
      setFeedback({ type: 'ok', text: 'Laporan rekap sekolah (.csv / Excel) berhasil diunduh.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal mengunduh laporan.' });
    }
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
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">Admin Central</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Ringkasan sekolah, pengguna, dan status platform DIGITAL BALANCE.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 self-start xl:self-auto">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">Filter Sekolah:</span>
                <select
                  value={overviewSchoolFilter}
                  onChange={(e) => setOverviewSchoolFilter(e.target.value)}
                  className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none pr-1"
                  aria-label="Filter Sekolah Ringkasan"
                >
                  <option value="">Semua Sekolah</option>
                  {(overview?.schoolsList ?? []).map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleDownloadOverviewExcel}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-medium rounded-xl inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Unduh Laporan Excel</span>
              </button>
              <button
                type="button"
                onClick={openAdminAccountModal}
                className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-medium rounded-xl inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <KeyRound className="w-4 h-4 text-violet-700" />
                <span>Akun Admin</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('sekolah')}
                className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <Building2 className="w-4 h-4" />
                <span>Manajemen Sekolah</span>
              </button>
            </div>
          </div>

          {overview ? (
            <>
              {/* 3x3 KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Total Sekolah</span>
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                  <p className="text-3xl font-bold text-slate-900 font-mono tabular-nums mt-3">
                    {overview.stats.totalSchools}
                  </p>
                  <p className="text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                    {overview.stats.activeSchools} sekolah aktif · {overview.stats.totalClasses} kelas
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Total Guru BK</span>
                    <Users className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                  <p className="text-3xl font-bold text-slate-900 font-mono tabular-nums mt-3">
                    {overview.stats.totalBkTeachers}
                  </p>
                  <p className="text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                    {overview.stats.activeBkTeachers} pendamping aktif
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Total Siswa</span>
                    <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                  <p className="text-3xl font-bold text-slate-900 font-mono tabular-nums mt-3">
                    {overview.stats.totalStudents}
                  </p>
                  <p className="text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                    Tersebar di {overview.stats.totalClasses} kelas terdaftar
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Partisipasi Cek Diri</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>
                  <p className="text-3xl font-bold text-slate-900 font-mono tabular-nums mt-3">
                    {overview.stats.assessmentCompletionPct}%
                  </p>
                  <p className="text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                    {overview.stats.assessedStudents} dari {overview.stats.totalStudents} siswa telah mengisi
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Konsultasi Pending</span>
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  </div>
                  <p className="text-3xl font-bold text-slate-900 font-mono tabular-nums mt-3">
                    {overview.stats.pendingConsultations}
                  </p>
                  <p className="text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                    {overview.stats.pendingConsultations === 0
                      ? 'Semua permintaan tertangani'
                      : `${overview.stats.doneConsultations} selesai dari ${overview.stats.totalConsultations} permintaan`}
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Perlu Pendampingan</span>
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  </div>
                  <p className="text-3xl font-bold text-slate-900 font-mono tabular-nums mt-3">
                    {overview.stats.attentionAlerts}
                  </p>
                  <p className="text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                    Hasil Cek Diri perlu perhatian Guru BK
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Rata-Rata Skor Cek Diri</span>
                    <Activity className="w-4 h-4 text-violet-600 shrink-0" />
                  </div>
                  <p className="text-3xl font-bold text-slate-900 font-mono tabular-nums mt-3">
                    {overview.stats.avgAssessmentScore}
                  </p>
                  <p className="text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                    Dari {overview.stats.totalAssessments} pengisian (skala 16–64)
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Jurnal Refleksi</span>
                    <BookOpenCheck className="w-4 h-4 text-sky-600 shrink-0" />
                  </div>
                  <p className="text-3xl font-bold text-slate-900 font-mono tabular-nums mt-3">
                    {overview.stats.totalJournals}
                  </p>
                  <p className="text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                    {overview.stats.sharedJournals} jurnal dibagikan ke Guru BK
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Target &amp; Fokus Digital</span>
                    <Timer className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>
                  <p className="text-3xl font-bold text-slate-900 font-mono tabular-nums mt-3">
                    {overview.stats.targetCompletionPct}%
                  </p>
                  <p className="text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                    {overview.stats.completedTargets}/{overview.stats.totalTargets} target · {overview.stats.totalFocusSessions} sesi fokus
                  </p>
                </div>
              </div>

              {/* Bottom Split: Sekolah Terdaftar & Aktivitas 7 Hari */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-violet-700 shrink-0" />
                      <h2 className="text-base font-semibold text-slate-900">Sekolah Terdaftar</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectTab('sekolah')}
                      className="text-xs font-semibold text-violet-700 hover:text-violet-900 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <span>Kelola semua</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-5 py-3 font-semibold">Sekolah</th>
                          <th className="text-right px-4 py-3 font-semibold">Pengguna</th>
                          <th className="text-right px-4 py-3 font-semibold">Kelas</th>
                          <th className="text-right px-4 py-3 font-semibold">Alert</th>
                          <th className="text-right px-5 py-3 font-semibold">Bergabung</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {overview.schoolDistribution.map((s) => (
                          <tr
                            key={s.id}
                            onClick={() => {
                              onSelectTab('sekolah');
                              setSelectedSchoolId(s.id);
                            }}
                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <span className="w-7 h-7 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0">
                                  {s.name.trim().charAt(0).toUpperCase()}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 truncate">{s.name}</p>
                                  <p className="text-xs text-slate-500 truncate">
                                    {s.level} · {s.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-800 font-medium">
                              {s.userCount}
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700">
                              {s.classCount}
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                              <span className={s.alertCount > 0 ? 'font-semibold text-rose-700' : 'text-slate-500'}>
                                {s.alertCount}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                              {formatLocalDate(s.createdAt)}
                            </td>
                          </tr>
                        ))}
                        {overview.schoolDistribution.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                              Belum ada sekolah terdaftar.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-violet-700 shrink-0" />
                        <h2 className="text-base font-semibold text-slate-900">Aktivitas 7 Hari</h2>
                      </div>
                      <span className="text-xs font-mono tabular-nums font-semibold text-slate-700">
                        {overview.activity7dBreakdown.totalEvents} log
                      </span>
                    </div>

                    {/* 7-day Sparkline + Day Bars */}
                    {(() => {
                      const trend = overview.activityTrend;
                      const maxVal = Math.max(...trend.map((d) => d.count), 1);
                      const points = trend
                        .map((d, idx) => {
                          const x = trend.length > 1 ? (idx / (trend.length - 1)) * 220 + 10 : 120;
                          const y = 58 - (d.count / maxVal) * 44;
                          return `${x},${y}`;
                        })
                        .join(' ');
                      return (
                        <div className="mt-5">
                          <svg viewBox="0 0 240 72" className="w-full h-20 overflow-visible" role="img" aria-label="Grafik aktivitas 7 hari">
                            <line x1="8" y1="60" x2="232" y2="60" stroke="#E2E8F0" strokeWidth="1" />
                            {trend.length > 1 && (
                              <polyline
                                fill="none"
                                stroke="#6D28D9"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={points}
                              />
                            )}
                            {trend.map((d, idx) => {
                              const x = trend.length > 1 ? (idx / (trend.length - 1)) * 220 + 10 : 120;
                              const y = 58 - (d.count / maxVal) * 44;
                              return (
                                <g key={d.day}>
                                  <circle cx={x} cy={y} r="3.2" fill="#FFFFFF" stroke="#6D28D9" strokeWidth="2" />
                                </g>
                              );
                            })}
                          </svg>
                          <div className="grid grid-cols-7 gap-1 mt-1 text-center">
                            {trend.map((d) => (
                              <div key={d.day} className="space-y-0.5">
                                <p className="text-[11px] font-mono tabular-nums font-semibold text-slate-700">{d.count}</p>
                                <p className="text-[10px] font-mono tabular-nums text-slate-400">{d.day.slice(5)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="mt-5 pt-4 border-t border-slate-100 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Pengisian Cek Diri</span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900">
                          {overview.activity7dBreakdown.assessments}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Jurnal Refleksi</span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900">
                          {overview.activity7dBreakdown.journals}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Catatan Durasi Layar</span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900">
                          {overview.activity7dBreakdown.usageRecords}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Permintaan Konsultasi</span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900">
                          {overview.activity7dBreakdown.consultations}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectTab('audit-log')}
                    className="w-full py-2 px-3 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Lihat Audit Log Lengkap</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
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
                Daftar sekolah, tautan siswa, dan Guru BK di setiap sekolah.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddSchool}
              className="px-4 py-2.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 self-start shrink-0 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Sekolah</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={schoolSearch}
              onChange={(e) => setSchoolSearch(e.target.value)}
              placeholder="Cari sekolah berdasarkan nama, wilayah, atau NPSN..."
              className="flex-1 text-sm bg-transparent focus:outline-none text-slate-900"
            />
          </div>

          {(() => {
            const maxReflection30d = Math.max(...schools.map((sc) => sc.reflection30dCount ?? 0), 1);
            if (!schools.length && !loading) {
              return (
                <div className="bg-white border border-slate-200 rounded-2xl px-6 py-12 text-center space-y-3">
                  <p className="text-sm text-slate-500">Belum ada sekolah yang sesuai dengan pencarian.</p>
                  <button
                    type="button"
                    onClick={openAddSchool}
                    className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Sekolah Pertama</span>
                  </button>
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {schools.map((s) => {
                  const consultTotal = s.consultationCount ?? 0;
                  const consultDone = s.consultationDoneCount ?? 0;
                  const consultPct = consultTotal > 0 ? Math.round((consultDone / consultTotal) * 100) : 0;
                  const r30 = s.reflection30dCount ?? 0;
                  const r30Pct = r30 > 0 ? Math.max(8, Math.round((r30 / maxReflection30d) * 100)) : 0;

                  return (
                    <div
                      key={s.id}
                      className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-violet-300 transition-colors"
                    >
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-base font-bold text-slate-900 leading-snug line-clamp-2">
                              {s.name}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5 truncate" title={s.address}>
                              {s.address}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 pt-0.5">
                          <StatusLabel status={s.status} />
                        </div>
                      </div>

                      {/* 3-Column Metrics */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-100 rounded-xl py-3 px-2 text-center">
                        <div>
                          <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                            {s.bkCount ?? 0}
                          </div>
                          <div className="text-[11px] text-slate-500">Guru BK</div>
                        </div>
                        <div className="border-x border-slate-200/70">
                          <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                            {consultTotal}
                          </div>
                          <div className="text-[11px] text-slate-500">Permintaan</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                            {s.reflectionCount ?? s.assessmentCount ?? 0}
                          </div>
                          <div className="text-[11px] text-slate-500">Refleksi</div>
                        </div>
                      </div>

                      {/* Progress Rows */}
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Permintaan selesai</span>
                            <span className="font-mono tabular-nums font-semibold text-slate-900">
                              {consultDone}/{consultTotal}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                              style={{ width: `${consultPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Refleksi 30 hari</span>
                            <span className="font-mono tabular-nums font-semibold text-slate-900">
                              {r30}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-700 rounded-full transition-all duration-300"
                              style={{ width: `${r30Pct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-500 font-mono tabular-nums">
                          Bergabung {formatLocalDate(s.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => openSchoolDetailModal(s.id)}
                          className="px-3.5 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          Detail
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
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
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Data Peserta Didik (Per Kelas)</h2>
                  <p className="text-xs text-slate-500">Dikelompokkan per kelas · Jurnal pribadi &amp; isi konsultasi tetap rahasia.</p>
                </div>
                <span className="text-xs font-mono font-semibold text-slate-600 shrink-0">
                  {schoolDetail.students.length} siswa
                </span>
              </div>

              {(() => {
                const classOrder = schoolDetail.classes.map((c) => c.name);
                const grouped = new Map<string, StudentRecord[]>();
                for (const cName of classOrder) grouped.set(cName, []);
                for (const st of schoolDetail.students) {
                  const key = st.className && st.className !== '-' ? st.className : 'Belum Ditempatkan di Kelas';
                  if (!grouped.has(key)) grouped.set(key, []);
                  grouped.get(key)!.push(st);
                }
                const entries = Array.from(grouped.entries()).filter(([, list]) => list.length > 0);
                if (!entries.length) {
                  return (
                    <div className="px-5 py-8 text-center text-sm text-slate-500">
                      Belum ada peserta didik terdaftar di sekolah ini.
                    </div>
                  );
                }
                return (
                  <div className="divide-y divide-slate-200">
                    {entries.map(([clsLabel, list]) => (
                      <div key={clsLabel}>
                        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">
                            {clsLabel === 'Belum Ditempatkan di Kelas' ? clsLabel : `Kelas ${clsLabel}`}
                          </span>
                          <span className="text-xs font-mono text-slate-500">{list.length} siswa</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-white text-xs text-slate-500 border-b border-slate-100">
                              <tr>
                                <th className="text-left px-5 py-2.5 font-medium">Nama</th>
                                <th className="text-left px-4 py-2.5 font-medium">NIS/NISN</th>
                                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                                <th className="text-right px-5 py-2.5 font-medium">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {list.map((st) => (
                                <tr key={st.id} className="hover:bg-slate-50">
                                  <td className="px-5 py-3">
                                    <div className="font-medium text-slate-900">{st.fullName}</div>
                                    <div className="text-xs text-slate-500 font-mono">{st.username}</div>
                                  </td>
                                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{st.nisNisn}</td>
                                  <td className="px-4 py-3">
                                    <StatusLabel status={st.status} />
                                  </td>
                                  <td className="px-5 py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDeleteUserTarget({
                                          id: st.userId,
                                          fullName: st.fullName,
                                          roleLabel: 'Peserta Didik',
                                        })
                                      }
                                      className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                                      title="Hapus Peserta Didik"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
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
                Dikelompokkan per sekolah: Guru BK sesuai sekolah penugasan dan Peserta Didik sesuai kelas masing-masing.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openAdminAccountModal}
                className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg inline-flex items-center gap-2"
              >
                <KeyRound className="w-4 h-4 text-violet-700" />
                <span>Akun Admin</span>
              </button>
              <button
                type="button"
                onClick={() => openAddBk(userSchoolFilter || '')}
                className="px-3.5 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Tambah Guru BK</span>
              </button>
              <button
                type="button"
                onClick={() => openAddStudent(userSchoolFilter || '')}
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

          {users.some((u) => u.role === 'GURU_BK' && u.status === 'INACTIVE') && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-amber-900">
                <span className="font-semibold">
                  {users.filter((u) => u.role === 'GURU_BK' && u.status === 'INACTIVE').length} akun Guru BK
                </span>{' '}
                berstatus Nonaktif / Menunggu Persetujuan. Klik tombol aktivasi pada baris terkait agar Guru BK dapat masuk ke sistem.
              </div>
            </div>
          )}

          {(() => {
            const adminUsers = users.filter((u) => u.role === 'ADMIN_CENTRAL');
            const schoolUsers = users.filter((u) => u.role !== 'ADMIN_CENTRAL');

            // Group non-admin users strictly by school
            const schoolGroupMap = new Map<
              string,
              {
                schoolId: string;
                schoolName: string;
                bkTeachers: UnifiedUserRow[];
                studentsByClass: Map<string, UnifiedUserRow[]>;
              }
            >();

            for (const u of schoolUsers) {
              const sid = u.schoolId || '__no_school__';
              if (!schoolGroupMap.has(sid)) {
                schoolGroupMap.set(sid, {
                  schoolId: sid,
                  schoolName: u.schoolName || 'Belum Terhubung Sekolah',
                  bkTeachers: [],
                  studentsByClass: new Map<string, UnifiedUserRow[]>(),
                });
              }
              const grp = schoolGroupMap.get(sid)!;
              if (u.role === 'GURU_BK') {
                grp.bkTeachers.push(u);
              } else {
                const clsKey = u.className && u.className !== '-' ? u.className : 'Belum Ada Kelas';
                if (!grp.studentsByClass.has(clsKey)) {
                  grp.studentsByClass.set(clsKey, []);
                }
                grp.studentsByClass.get(clsKey)!.push(u);
              }
            }

            const schoolGroups = Array.from(schoolGroupMap.values()).sort((a, b) =>
              a.schoolName.localeCompare(b.schoolName, 'id')
            );

            if (adminUsers.length === 0 && schoolGroups.length === 0) {
              return (
                <div className="bg-white border border-slate-200 rounded-xl px-5 py-10 text-center text-sm text-slate-500">
                  Tidak ada akun pengguna yang sesuai dengan filter.
                </div>
              );
            }

            const renderUserActionButtons = (u: UnifiedUserRow) => (
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
                {u.role !== 'ADMIN_CENTRAL' && u.id !== user.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteUserTarget({
                        id: u.id,
                        fullName: u.fullName,
                        roleLabel: u.role === 'GURU_BK' ? 'Guru BK' : 'Peserta Didik',
                      })
                    }
                    className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                    title="Hapus Akun"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );

            return (
              <div className="space-y-6">
                {/* Admin Central Account Section */}
                {adminUsers.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3.5 bg-violet-50/70 border-b border-violet-100 flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">Admin Central (Pusat Sistem)</h2>
                        <p className="text-xs text-slate-500">Pengelola otoritas lintas sekolah</p>
                      </div>
                      <button
                        type="button"
                        onClick={openAdminAccountModal}
                        className="text-xs font-semibold text-violet-700 hover:underline"
                      >
                        Ubah Kredensial Admin
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-5 py-2.5 font-medium">Nama Pengguna</th>
                            <th className="text-left px-4 py-2.5 font-medium">Username</th>
                            <th className="text-left px-4 py-2.5 font-medium">Status</th>
                            <th className="text-left px-4 py-2.5 font-medium">Terdaftar</th>
                            <th className="text-right px-5 py-2.5 font-medium">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {adminUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-50">
                              <td className="px-5 py-3">
                                <div className="font-medium text-slate-900">{u.fullName}</div>
                                <div className="text-xs text-slate-500">{u.email}</div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-slate-700">{u.username}</td>
                              <td className="px-4 py-3">
                                <StatusLabel status={u.status} />
                              </td>
                              <td className="px-4 py-3 font-mono tabular-nums text-xs text-slate-500">
                                {formatLocalDate(u.createdAt)}
                              </td>
                              <td className="px-5 py-3 text-right">{renderUserActionButtons(u)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Per-School Separated Cards */}
                {schoolGroups.map((sg) => {
                  const totalStudentsInSchool = Array.from(sg.studentsByClass.values()).reduce(
                    (sum, arr) => sum + arr.length,
                    0
                  );
                  const classEntries = Array.from(sg.studentsByClass.entries()).sort(([a], [b]) => {
                    if (a === 'Belum Ada Kelas') return 1;
                    if (b === 'Belum Ada Kelas') return -1;
                    return a.localeCompare(b, 'id');
                  });

                  return (
                    <div key={sg.schoolId} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                      {/* School Section Header */}
                      <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-base font-bold text-slate-900 truncate">{sg.schoolName}</h2>
                            <p className="text-xs text-slate-500">
                              <span className="font-mono font-semibold text-slate-700">{sg.bkTeachers.length}</span> Guru BK ·{' '}
                              <span className="font-mono font-semibold text-slate-700">{totalStudentsInSchool}</span> Peserta Didik ·{' '}
                              <span className="font-mono font-semibold text-slate-700">{classEntries.length}</span> Kelas
                            </p>
                          </div>
                        </div>
                        {sg.schoolId !== '__no_school__' && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => openAddBk(sg.schoolId)}
                              className="px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg"
                            >
                              + Guru BK
                            </button>
                            <button
                              type="button"
                              onClick={() => openAddStudent(sg.schoolId)}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg"
                            >
                              + Peserta Didik
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Guru BK Sub-Section for This School */}
                      {sg.bkTeachers.length > 0 && (
                        <div className="border-b border-slate-200">
                          <div className="px-5 py-2.5 bg-violet-50/50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-violet-800">
                              Guru BK · {sg.schoolName}
                            </span>
                            <span className="text-xs font-mono text-violet-700 font-semibold">
                              {sg.bkTeachers.length} akun
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-white text-xs text-slate-500 border-b border-slate-100">
                                <tr>
                                  <th className="text-left px-5 py-2.5 font-medium">Nama Guru BK</th>
                                  <th className="text-left px-4 py-2.5 font-medium">Username</th>
                                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                                  <th className="text-left px-4 py-2.5 font-medium">Terdaftar</th>
                                  <th className="text-right px-5 py-2.5 font-medium">Aksi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {sg.bkTeachers.map((u) => (
                                  <tr key={u.id} className="hover:bg-slate-50">
                                    <td className="px-5 py-3">
                                      <div className="font-medium text-slate-900">{u.fullName}</div>
                                      <div className="text-xs text-slate-500">{u.email}</div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{u.username}</td>
                                    <td className="px-4 py-3">
                                      <StatusLabel status={u.status} />
                                    </td>
                                    <td className="px-4 py-3 font-mono tabular-nums text-xs text-slate-500">
                                      {formatLocalDate(u.createdAt)}
                                    </td>
                                    <td className="px-5 py-3 text-right">{renderUserActionButtons(u)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Peserta Didik Sub-Sections Grouped by Kelas */}
                      {classEntries.length > 0 && (
                        <div className="divide-y divide-slate-200">
                          {classEntries.map(([clsName, stuList]) => (
                            <div key={clsName}>
                              <div className="px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800">
                                  {clsName === 'Belum Ada Kelas' ? 'Peserta Didik · Belum Ada Kelas' : `Peserta Didik · Kelas ${clsName}`}
                                </span>
                                <span className="text-xs font-mono text-slate-500">
                                  {stuList.length} siswa
                                </span>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-white text-xs text-slate-500 border-b border-slate-100">
                                    <tr>
                                      <th className="text-left px-5 py-2.5 font-medium">Nama Peserta Didik</th>
                                      <th className="text-left px-4 py-2.5 font-medium">NIS/NISN</th>
                                      <th className="text-left px-4 py-2.5 font-medium">Username</th>
                                      <th className="text-left px-4 py-2.5 font-medium">Status</th>
                                      <th className="text-left px-4 py-2.5 font-medium">Terdaftar</th>
                                      <th className="text-right px-5 py-2.5 font-medium">Aksi</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {stuList.map((u) => (
                                      <tr key={u.id} className="hover:bg-slate-50">
                                        <td className="px-5 py-3">
                                          <div className="font-medium text-slate-900">{u.fullName}</div>
                                          <div className="text-xs text-slate-500">{u.email}</div>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{u.nisNisn || '-'}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{u.username}</td>
                                        <td className="px-4 py-3">
                                          <StatusLabel status={u.status} />
                                        </td>
                                        <td className="px-4 py-3 font-mono tabular-nums text-xs text-slate-500">
                                          {formatLocalDate(u.createdAt)}
                                        </td>
                                        <td className="px-5 py-3 text-right">{renderUserActionButtons(u)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* 4. DATA SISWA */}
      {activeTab === 'data-siswa' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display">Data Siswa Per Sekolah &amp; Kelas</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Dipisahkan per sekolah dan dikelompokkan sesuai kelasnya. Jurnal pribadi dan isi konsultasi tetap bersifat rahasia.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAddStudent(studentSchoolFilter || '')}
              className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Peserta Didik</span>
            </button>
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
              onChange={(e) => {
                setStudentSchoolFilter(e.target.value);
                setStudentClassFilter('');
              }}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="">Semua Sekolah</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={studentClassFilter}
              onChange={(e) => setStudentClassFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="">Semua Kelas</option>
              {Array.from(
                new Set(
                  students
                    .map((st) => st.className)
                    .filter((cn): cn is string => Boolean(cn && cn !== '-'))
                )
              )
                .sort((a, b) => a.localeCompare(b, 'id'))
                .map((clsName) => (
                  <option key={clsName} value={clsName}>
                    Kelas {clsName}
                  </option>
                ))}
            </select>
          </div>

          {(() => {
            const bySchool = new Map<
              string,
              {
                schoolId: string;
                schoolName: string;
                totalCount: number;
                classes: Map<string, StudentRecord[]>;
              }
            >();

            for (const st of students) {
              const sid = st.schoolId;
              if (!bySchool.has(sid)) {
                bySchool.set(sid, {
                  schoolId: sid,
                  schoolName: st.schoolName || 'Sekolah Mitra',
                  totalCount: 0,
                  classes: new Map<string, StudentRecord[]>(),
                });
              }
              const sGroup = bySchool.get(sid)!;
              sGroup.totalCount += 1;
              const clsKey = st.className && st.className !== '-' ? st.className : 'Belum Ada Kelas';
              if (!sGroup.classes.has(clsKey)) {
                sGroup.classes.set(clsKey, []);
              }
              sGroup.classes.get(clsKey)!.push(st);
            }

            const schoolEntries = Array.from(bySchool.values()).sort((a, b) =>
              a.schoolName.localeCompare(b.schoolName, 'id')
            );

            if (!schoolEntries.length) {
              return (
                <div className="bg-white border border-slate-200 rounded-xl px-5 py-10 text-center text-sm text-slate-500">
                  Tidak ada data siswa yang sesuai filter.
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {schoolEntries.map((sg) => {
                  const classEntries = Array.from(sg.classes.entries()).sort(([a], [b]) => {
                    if (a === 'Belum Ada Kelas') return 1;
                    if (b === 'Belum Ada Kelas') return -1;
                    return a.localeCompare(b, 'id');
                  });

                  return (
                    <div key={sg.schoolId} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                      {/* School Header */}
                      <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-base font-bold text-slate-900 truncate">{sg.schoolName}</h2>
                            <p className="text-xs text-slate-500">
                              <span className="font-mono font-semibold text-slate-700">{sg.totalCount}</span> peserta didik ·{' '}
                              <span className="font-mono font-semibold text-slate-700">{classEntries.length}</span> kelas
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openAddStudent(sg.schoolId)}
                          className="px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg self-start sm:self-auto"
                        >
                          + Tambah Siswa ke Sekolah Ini
                        </button>
                      </div>

                      {/* Class Sub-Sections inside this School */}
                      <div className="divide-y divide-slate-200">
                        {classEntries.map(([clsName, list]) => (
                          <div key={clsName}>
                            <div className="px-5 py-2.5 bg-violet-50/40 border-b border-slate-100 flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">
                                {clsName === 'Belum Ada Kelas' ? 'Belum Ada Kelas' : `Kelas ${clsName}`}
                              </span>
                              <span className="text-xs font-mono text-slate-600">{list.length} siswa</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-white text-xs text-slate-500 border-b border-slate-100">
                                  <tr>
                                    <th className="text-left px-5 py-2.5 font-medium">Nama Siswa</th>
                                    <th className="text-left px-4 py-2.5 font-medium">NIS/NISN</th>
                                    <th className="text-left px-4 py-2.5 font-medium">Jenis Kelamin</th>
                                    <th className="text-left px-4 py-2.5 font-medium">Status Akun</th>
                                    <th className="text-right px-5 py-2.5 font-medium">Aksi</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {list.map((st) => (
                                    <tr key={st.id} className="hover:bg-slate-50">
                                      <td className="px-5 py-3">
                                        <div className="font-medium text-slate-900">{st.fullName}</div>
                                        <div className="text-xs text-slate-500 font-mono">
                                          {st.username} · {st.email}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{st.nisNisn}</td>
                                      <td className="px-4 py-3 text-xs text-slate-600">{st.gender}</td>
                                      <td className="px-4 py-3">
                                        <StatusLabel status={st.status} />
                                      </td>
                                      <td className="px-5 py-3 text-right">
                                        <div className="inline-flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => setResetPwdUser({ id: st.userId, name: st.fullName })}
                                            className="p-1.5 text-slate-600 hover:text-violet-700 hover:bg-violet-50 rounded-md"
                                            title="Reset Password"
                                          >
                                            <KeyRound className="w-4 h-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              toggleUserStatus({
                                                id: st.userId,
                                                username: st.username,
                                                status: st.status,
                                              })
                                            }
                                            className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-md"
                                            title={st.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                                          >
                                            <Power className="w-4 h-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setDeleteUserTarget({
                                                id: st.userId,
                                                fullName: st.fullName,
                                                roleLabel: 'Peserta Didik',
                                              })
                                            }
                                            className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                                            title="Hapus Peserta Didik"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* 5. AUDIT LOG */}
      {activeTab === 'audit-log' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display">Audit Log Sistem</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Catatan kronologis aktivitas autentikasi, pengelolaan sekolah, akun Guru BK, dan perubahan status.
              </p>
            </div>
            <button
              type="button"
              disabled={auditLogs.length === 0}
              onClick={() => setClearAuditModalOpen(true)}
              className="px-3.5 py-2 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 text-sm font-medium rounded-lg inline-flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus Semua Riwayat</span>
            </button>
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
                    <th className="text-right px-5 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                        {formatLocalDateTime(l.createdAt, true)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-semibold text-slate-900">{l.username}</div>
                        <div className="text-slate-500">{l.userRole}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-violet-700 whitespace-nowrap">
                        {l.action}
                      </td>
                      <td className="px-5 py-3 text-slate-700">{l.details}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteAuditTarget(l)}
                          className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                          title="Hapus Riwayat Log"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!auditLogs.length && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                        Riwayat Audit Log kosong.
                      </td>
                    </tr>
                  )}
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

      {/* DETAIL SEKOLAH MODAL (QR & TAUTAN SISWA + GURU BK + AKSI) */}
      <Modal
        open={Boolean(detailModalSchoolId)}
        onClose={() => setDetailModalSchoolId(null)}
        title={schoolDetail?.school.name ?? 'Detail Sekolah'}
        maxWidth="max-w-xl"
        customHeader={
          schoolDetail && schoolDetail.school.id === detailModalSchoolId ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">{schoolDetail.school.name}</h3>
                  <p className="text-xs text-slate-500 truncate">
                    {schoolDetail.school.address} · Kode{' '}
                    <span className="font-mono font-semibold text-slate-700">
                      {schoolDetail.school.code || schoolDetail.school.npsn}
                    </span>
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <StatusLabel status={schoolDetail.school.status} />
              </div>
            </div>
          ) : (
            <h3 className="text-base font-semibold text-slate-900">Memuat Detail Sekolah...</h3>
          )
        }
      >
        {detailModalLoading || !schoolDetail || schoolDetail.school.id !== detailModalSchoolId ? (
          <div className="py-10 text-center text-sm text-slate-500">Memuat data sekolah...</div>
        ) : (
          (() => {
            const sc = schoolDetail.school;
            const schoolCode = sc.code || sc.npsn;
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            const studentInviteUrl = `${origin}/?s=${encodeURIComponent(schoolCode)}`;

            return (
              <div className="space-y-5">
                {/* QR Code & Student Link Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl shrink-0">
                    <QRCodeSVG value={studentInviteUrl} size={108} level="M" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5 text-center sm:text-left">
                    <div className="text-sm font-bold text-slate-900">Tautan siswa {sc.name}</div>
                    <div className="text-xs font-mono text-violet-700 break-all select-all">
                      {studentInviteUrl}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Siswa yang membuka atau memindai tautan ini otomatis terhubung ke sekolah dan Guru BK sekolah ini saat mendaftar.
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => copyStudentLink(studentInviteUrl)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-800 text-xs font-semibold rounded-lg transition-colors"
                      >
                        {copiedSchoolLink ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Tautan tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Link2 className="w-3.5 h-3.5" />
                            <span>Salin tautan</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Guru BK List */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold tracking-wider text-slate-500">
                      GURU BK ({schoolDetail.bkTeachers.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => openAddBk(sc.id)}
                      className="text-xs font-semibold text-violet-700 hover:underline inline-flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Tambah Guru BK</span>
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
                    {schoolDetail.bkTeachers.map((bk) => (
                      <div key={bk.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">{bk.fullName}</div>
                          <div className="text-xs text-slate-500 truncate">{bk.email}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusLabel status={bk.status} />
                          <button
                            type="button"
                            onClick={() => openEditBk(bk)}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                            title="Edit Guru BK"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setResetPwdUser({ id: bk.userId, name: bk.fullName })}
                            className="p-1 text-slate-500 hover:text-violet-700 hover:bg-violet-50 rounded-md"
                            title="Reset Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {!schoolDetail.bkTeachers.length && (
                      <div className="px-4 py-4 text-xs text-slate-500 text-center">
                        Belum ada Guru BK terdaftar di sekolah ini. Klik Tambah Guru BK untuk mendaftarkan.
                      </div>
                    )}
                  </div>
                </div>

                {/* Access to full Class & Student Management view */}
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
                  <span className="text-slate-600">
                    Kelas: <strong className="text-slate-900 font-mono">{schoolDetail.classes.length}</strong> · Peserta Didik:{' '}
                    <strong className="text-slate-900 font-mono">{schoolDetail.students.length}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = sc.id;
                      setDetailModalSchoolId(null);
                      setSelectedSchoolId(targetId);
                    }}
                    className="font-semibold text-violet-700 hover:underline"
                  >
                    Kelola Kelas &amp; Siswa →
                  </button>
                </div>

                {/* Bottom 3 Action Buttons */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => openEditSchool(sc)}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold rounded-xl transition-colors"
                  >
                    Ubah
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSchoolStatus(sc)}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold rounded-xl transition-colors"
                  >
                    {sc.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteSchoolTarget(sc)}
                    className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    Hapus
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Sekolah nonaktif tidak muncul di pilihan pendaftaran siswa. Menghapus sekolah akan menghapus data kelas, akun Guru BK, dan peserta didik di sekolah ini secara permanen.
                </p>
              </div>
            );
          })()
        )}
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

      <ConfirmModal
        open={Boolean(deleteUserTarget)}
        onClose={() => setDeleteUserTarget(null)}
        onConfirm={confirmDeleteUser}
        title={`Konfirmasi Hapus ${deleteUserTarget?.roleLabel ?? 'Pengguna'}`}
        message={`Menghapus akun ${deleteUserTarget?.roleLabel ?? 'pengguna'} "${deleteUserTarget?.fullName}" akan menghapus akun beserta seluruh data terkaitnya secara permanen. Lanjutkan?`}
      />

      <ConfirmModal
        open={Boolean(deleteAuditTarget)}
        onClose={() => setDeleteAuditTarget(null)}
        onConfirm={confirmDeleteAuditLog}
        title="Hapus Riwayat Audit Log"
        message={`Hapus catatan log aktivitas "${deleteAuditTarget?.action}" oleh ${deleteAuditTarget?.username}?`}
      />

      <ConfirmModal
        open={clearAuditModalOpen}
        onClose={() => setClearAuditModalOpen(false)}
        onConfirm={confirmClearAuditLogs}
        title="Hapus Semua Riwayat Audit Log"
        message="Seluruh catatan riwayat Audit Log yang tersimpan akan dihapus permanen. Lanjutkan?"
      />

      <Modal
        open={adminAccountModalOpen}
        onClose={() => setAdminAccountModalOpen(false)}
        title="Pengaturan Akun & Password Admin Central"
        maxWidth="max-w-md"
      >
        <form onSubmit={saveAdminAccount} className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Kredensial Admin Central hanya diketahui oleh Anda. Ubah username, email, atau password secara berkala untuk menjaga keamanan seluruh sekolah.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap</label>
            <input
              required
              type="text"
              value={adminAccountForm.fullName}
              onChange={(e) => setAdminAccountForm({ ...adminAccountForm, fullName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Username Admin</label>
              <input
                required
                type="text"
                value={adminAccountForm.username}
                onChange={(e) => setAdminAccountForm({ ...adminAccountForm, username: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Admin</label>
              <input
                required
                type="email"
                value={adminAccountForm.email}
                onChange={(e) => setAdminAccountForm({ ...adminAccountForm, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Password Saat Ini (wajib untuk konfirmasi)
            </label>
            <input
              required
              type="password"
              value={adminAccountForm.currentPassword}
              onChange={(e) => setAdminAccountForm({ ...adminAccountForm, currentPassword: e.target.value })}
              placeholder="Masukkan password saat ini"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Password Baru (opsional, min. 6 karakter)
            </label>
            <input
              type="password"
              minLength={6}
              value={adminAccountForm.newPassword}
              onChange={(e) => setAdminAccountForm({ ...adminAccountForm, newPassword: e.target.value })}
              placeholder="Kosongkan jika tidak ingin mengganti password"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAdminAccountModalOpen(false)}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={adminAccountSaving}
              className="px-4 py-2 text-sm font-medium bg-violet-700 text-white rounded-lg hover:bg-violet-800 disabled:opacity-60"
            >
              {adminAccountSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
