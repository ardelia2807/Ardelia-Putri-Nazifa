import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  MessageSquareHeart,
  BookOpenText,
  FileBarChart2,
  UserCircle2,
  Search,
  Plus,
  Pencil,
  KeyRound,
  Send,
  Download,
  Printer,
  Info,
  Lock,
  Trash2,
} from 'lucide-react';
import { apiFetch, downloadCsv, formatLocalDateTime, formatLocalDate } from '../../lib/api.ts';
import type {
  AuthUser,
  StudentRecord,
  SchoolClass,
  ConsultationRequest,
  ReflectionJournal,
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

const BK_NAV: NavItem[] = [
  { id: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'peserta-didik', label: 'Data Peserta Didik', icon: Users },
  { id: 'cek-diri', label: 'Cek Diri', icon: ClipboardCheck },
  { id: 'konsultasi', label: 'Permintaan Konsultasi', icon: MessageSquareHeart },
  { id: 'catatan-refleksi', label: 'Catatan dan Refleksi', icon: BookOpenText },
  { id: 'laporan', label: 'Laporan', icon: FileBarChart2 },
  { id: 'profil', label: 'Profil', icon: UserCircle2 },
];

interface BkOverview {
  schoolName: string;
  teacherName: string;
  stats: {
    studentCount: number;
    assessmentCount: number;
    consultationCount: number;
    waitingConsultations: number;
    usageCount: number;
    targetCount: number;
    sharedJournalCount: number;
  };
  featureUsage: Array<{ label: string; count: number }>;
  latestConsultations: Array<{
    id: string;
    topic: string;
    status: string;
    createdAt: string;
    preferredSchedule: string;
    studentName: string;
    className: string;
  }>;
}

interface BkAssessmentSummary {
  summary: {
    totalCount: number;
    avgIntensity: number;
    avgUrge: number;
    avgSocialEmotion: number;
    avgControlImpact: number;
    maxIndicatorScore: number;
  };
  categories: Array<{ category: string; count: number }>;
  classOverview: Array<{ className: string; assessmentCount: number; avgScore: number }>;
}

interface BkReport {
  period: string;
  schoolName: string;
  summary: {
    assessments: number;
    usageRecords: number;
    totalMinutes: number;
    targets: number;
    completedTargets: number;
    consultations: number;
    doneConsultations: number;
  };
  topApps: Array<{ appName: string; entries: number; totalMinutes: number }>;
}

export function BkDashboard({
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
  const [overview, setOverview] = useState<BkOverview | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('');

  const [assessments, setAssessments] = useState<BkAssessmentSummary | null>(null);
  const [consultations, setConsultations] = useState<ConsultationRequest[]>([]);
  const [consultStatusFilter, setConsultStatusFilter] = useState('');
  const [sharedJournals, setSharedJournals] = useState<ReflectionJournal[]>([]);
  const [report, setReport] = useState<BkReport | null>(null);
  const [reportPeriod, setReportPeriod] = useState<'7d' | '30d' | 'all'>('all');

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Student Modal
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [studentForm, setStudentForm] = useState({
    fullName: '',
    nisNisn: '',
    gender: 'Laki-laki',
    email: '',
    username: '',
    password: '',
    classId: '',
    status: 'ACTIVE',
  });

  // Class Modal
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [classForm, setClassForm] = useState({ name: '', gradeLevel: '10', academicYear: '2026/2027' });

  // Reset Password Modal
  const [resetTarget, setResetTarget] = useState<StudentRecord | null>(null);
  const [resetPassValue, setResetPassValue] = useState('');

  // Delete Student Confirm Modal
  const [deleteStudentTarget, setDeleteStudentTarget] = useState<StudentRecord | null>(null);

  // Consultation Response Modal
  const [activeConsult, setActiveConsult] = useState<ConsultationRequest | null>(null);
  const [consultResponseForm, setConsultResponseForm] = useState({
    status: 'DIPROSES',
    scheduledAt: '',
    responseText: '',
    scheduleNote: '',
  });

  // Profile Password Change
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '' });

  const loadOverview = useCallback(async () => {
    const data = await apiFetch<BkOverview>('/api/bk/overview');
    setOverview(data);
  }, []);

  const loadStudents = useCallback(async () => {
    const params = new URLSearchParams();
    if (studentClassFilter) params.set('classId', studentClassFilter);
    if (studentSearch) params.set('q', studentSearch);
    const [clsRes, stuRes] = await Promise.all([
      apiFetch<{ classes: SchoolClass[] }>('/api/bk/classes'),
      apiFetch<{ students: StudentRecord[] }>(`/api/bk/students?${params.toString()}`),
    ]);
    setClasses(clsRes.classes);
    setStudents(stuRes.students);
  }, [studentClassFilter, studentSearch]);

  const loadAssessments = useCallback(async () => {
    const data = await apiFetch<BkAssessmentSummary>('/api/bk/assessments');
    setAssessments(data);
  }, []);

  const loadConsultations = useCallback(async () => {
    const data = await apiFetch<{ consultations: ConsultationRequest[] }>(
      `/api/bk/consultations?status=${encodeURIComponent(consultStatusFilter)}`
    );
    setConsultations(data.consultations);
  }, [consultStatusFilter]);

  const loadSharedJournals = useCallback(async () => {
    const data = await apiFetch<{ journals: ReflectionJournal[] }>('/api/bk/shared-journals');
    setSharedJournals(data.journals);
  }, []);

  const loadReport = useCallback(async () => {
    const data = await apiFetch<BkReport>(`/api/bk/reports?period=${reportPeriod}`);
    setReport(data);
  }, [reportPeriod]);

  useEffect(() => {
    setFeedback(null);
    const run = async () => {
      try {
        if (activeTab === 'ringkasan') await loadOverview();
        else if (activeTab === 'peserta-didik') await loadStudents();
        else if (activeTab === 'cek-diri') await loadAssessments();
        else if (activeTab === 'konsultasi') await loadConsultations();
        else if (activeTab === 'catatan-refleksi') await loadSharedJournals();
        else if (activeTab === 'laporan') await loadReport();
      } catch (err) {
        setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal memuat data sekolah.' });
      }
    };
    run();
  }, [activeTab, loadOverview, loadStudents, loadAssessments, loadConsultations, loadSharedJournals, loadReport]);

  function openAddStudent(prefillClassId = '') {
    setEditingStudent(null);
    setStudentForm({
      fullName: '',
      nisNisn: '',
      gender: 'Laki-laki',
      email: '',
      username: '',
      password: '',
      classId: prefillClassId || studentClassFilter || classes[0]?.id || '',
      status: 'ACTIVE',
    });
    setStudentModalOpen(true);
  }

  function openEditStudent(st: StudentRecord) {
    setEditingStudent(st);
    setStudentForm({
      fullName: st.fullName,
      nisNisn: st.nisNisn,
      gender: st.gender,
      email: st.email,
      username: st.username,
      password: '',
      classId: st.classId || '',
      status: st.status,
    });
    setStudentModalOpen(true);
  }

  async function saveStudent(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingStudent) {
        await apiFetch(`/api/bk/students/${editingStudent.id}`, {
          method: 'PUT',
          body: JSON.stringify(studentForm),
        });
        setFeedback({ type: 'ok', text: `Data siswa "${studentForm.fullName}" berhasil diperbarui.` });
      } else {
        await apiFetch('/api/bk/students', {
          method: 'POST',
          body: JSON.stringify(studentForm),
        });
        setFeedback({ type: 'ok', text: `Akun siswa "${studentForm.fullName}" berhasil dibuat di ${user.schoolName}.` });
      }
      setStudentModalOpen(false);
      await loadStudents();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan data siswa.' });
    }
  }

  async function saveClass(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/api/bk/classes', {
        method: 'POST',
        body: JSON.stringify(classForm),
      });
      setClassModalOpen(false);
      setClassForm({ name: '', gradeLevel: '10', academicYear: '2026/2027' });
      await loadStudents();
      setFeedback({ type: 'ok', text: 'Kelas baru berhasil ditambahkan.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menambah kelas.' });
    }
  }

  async function handleResetStudentPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    try {
      await apiFetch(`/api/bk/students/${resetTarget.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: resetPassValue }),
      });
      setFeedback({ type: 'ok', text: `Password untuk "${resetTarget.fullName}" telah diperbarui.` });
      setResetTarget(null);
      setResetPassValue('');
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal mereset password.' });
    }
  }

  async function confirmDeleteStudent() {
    if (!deleteStudentTarget) return;
    try {
      await apiFetch(`/api/bk/students/${deleteStudentTarget.id}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', text: `Akun Peserta Didik "${deleteStudentTarget.fullName}" berhasil dihapus.` });
      setDeleteStudentTarget(null);
      await loadStudents();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus peserta didik.' });
    }
  }

  function openConsultationModal(c: ConsultationRequest) {
    setActiveConsult(c);
    setConsultResponseForm({
      status: c.status,
      scheduledAt: c.scheduledAt || '',
      responseText: '',
      scheduleNote: '',
    });
  }

  async function submitConsultResponse(e: React.FormEvent) {
    e.preventDefault();
    if (!activeConsult) return;
    try {
      await apiFetch(`/api/bk/consultations/${activeConsult.id}`, {
        method: 'PATCH',
        body: JSON.stringify(consultResponseForm),
      });
      setActiveConsult(null);
      await loadConsultations();
      setFeedback({ type: 'ok', text: 'Status dan respons konsultasi berhasil disimpan.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal memperbarui konsultasi.' });
    }
  }

  async function handleChangeOwnPassword(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(pwdForm),
      });
      setFeedback({ type: 'ok', text: res.message });
      setPwdForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal mengganti password.' });
    }
  }

  function exportSchoolReportCsv() {
    if (!report) return;
    downloadCsv(
      `laporan-bk-${(user.schoolName || 'sekolah').toLowerCase().replace(/\s+/g, '-')}.csv`,
      ['Metrik', 'Nilai'],
      [
        ['Sekolah', report.schoolName],
        ['Periode', report.period],
        ['Total Cek Diri', report.summary.assessments],
        ['Total Catatan Penggunaan', report.summary.usageRecords],
        ['Total Durasi Tercatat (Menit)', report.summary.totalMinutes],
        ['Total Target Siswa', report.summary.targets],
        ['Target Selesai', report.summary.completedTargets],
        ['Total Permintaan Konsultasi', report.summary.consultations],
        ['Konsultasi Selesai', report.summary.doneConsultations],
      ]
    );
  }

  return (
    <DashboardShell
      roleTitle="GURU BK"
      subtitle={user.schoolName || 'Sekolah Mitra'}
      userName={user.fullName}
      navItems={BK_NAV}
      activeTab={activeTab}
      onSelectTab={onSelectTab}
      onLogout={onLogout}
      mobileBottomIds={['ringkasan', 'peserta-didik', 'cek-diri', 'konsultasi']}
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

      {/* 1. RINGKASAN GURU BK */}
      {activeTab === 'ringkasan' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">
              Selamat datang, {user.fullName}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Ruang Layanan Bimbingan &amp; Konseling · {user.schoolName}
            </p>
          </div>

          {overview && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Peserta Didik Terdaftar" value={overview.stats.studentCount} subtext="Sekolah Anda" accent />
                <StatCard label="Aktivitas Cek Diri" value={overview.stats.assessmentCount} subtext="Pengisian siswa" />
                <StatCard
                  label="Permintaan Konsultasi"
                  value={overview.stats.consultationCount}
                  subtext={`${overview.stats.waitingConsultations} menunggu respons`}
                />
                <StatCard label="Jurnal Dibagikan" value={overview.stats.sharedJournalCount} subtext="Sukarela oleh siswa" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-slate-900 mb-1">Statistik Penggunaan Fitur Sekolah</h2>
                  <p className="text-xs text-slate-500 mb-5">Aktivitas DIGITAL BALANCE di {overview.schoolName}</p>
                  <SimpleBarChart
                    data={overview.featureUsage.map((f) => ({ label: f.label, value: f.count }))}
                    unit="entri"
                  />
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">Permintaan Konsultasi Terbaru</h2>
                    <button
                      type="button"
                      onClick={() => onSelectTab('konsultasi')}
                      className="text-xs font-semibold text-violet-700 hover:underline"
                    >
                      Kelola Semua
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {overview.latestConsultations.map((c) => (
                      <div key={c.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">{c.topic}</div>
                          <div className="text-xs text-slate-500">
                            {c.studentName} · {c.className} · {formatLocalDate(c.createdAt)}
                          </div>
                        </div>
                        <StatusLabel status={c.status} />
                      </div>
                    ))}
                    {!overview.latestConsultations.length && (
                      <div className="px-6 py-10 text-center text-sm text-slate-500">
                        Belum ada permintaan konsultasi dari peserta didik.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 2. DATA PESERTA DIDIK */}
      {activeTab === 'peserta-didik' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display">Data Peserta Didik</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Menampilkan peserta didik khusus di {user.schoolName}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setClassModalOpen(true)}
                className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Kelas</span>
              </button>
              <button
                type="button"
                onClick={() => openAddStudent()}
                className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Peserta Didik</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Cari nama siswa, username, NIS/NISN..."
                className="w-full text-sm bg-transparent focus:outline-none"
              />
            </div>
            <select
              value={studentClassFilter}
              onChange={(e) => setStudentClassFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="">Semua Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.studentCount ?? 0} siswa)
                </option>
              ))}
            </select>
          </div>

          {(() => {
            const visibleClasses = studentClassFilter
              ? classes.filter((c) => c.id === studentClassFilter)
              : classes;
            const unassignedStudents = !studentClassFilter ? students.filter((st) => !st.classId) : [];
            const classGroups: Array<{
              key: string;
              classId: string;
              title: string;
              subtitle: string;
              items: StudentRecord[];
            }> = visibleClasses
              .map((c) => ({
                key: c.id,
                classId: c.id,
                title: `Kelas ${c.name}`,
                subtitle: `Tingkat ${c.gradeLevel} · ${c.academicYear}`,
                items: students.filter((st) => st.classId === c.id),
              }))
              .filter((g) => !studentSearch.trim() || g.items.length > 0);

            if (unassignedStudents.length > 0) {
              classGroups.push({
                key: '__unassigned__',
                classId: '',
                title: 'Belum Ditempatkan di Kelas',
                subtitle: 'Siswa tanpa penetapan kelas',
                items: unassignedStudents,
              });
            }

            if (!classGroups.length) {
              return (
                <div className="bg-white border border-slate-200 rounded-xl px-5 py-10 text-center text-sm text-slate-500">
                  Belum ada peserta didik di sekolah ini atau sesuai filter.
                </div>
              );
            }

            return (
              <div className="space-y-5">
                {classGroups.map((group) => (
                  <div key={group.key} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">{group.title}</h2>
                        <p className="text-xs text-slate-500">
                          {group.subtitle} ·{' '}
                          <span className="font-mono font-semibold text-slate-700">{group.items.length}</span> peserta didik
                        </p>
                      </div>
                      {group.classId && (
                        <button
                          type="button"
                          onClick={() => openAddStudent(group.classId)}
                          className="text-xs font-semibold text-violet-700 hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah Siswa ke {group.title}</span>
                        </button>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-white text-xs text-slate-500 border-b border-slate-100">
                          <tr>
                            <th className="text-left px-5 py-2.5 font-medium">Nama Lengkap</th>
                            <th className="text-left px-4 py-2.5 font-medium">NIS / NISN</th>
                            <th className="text-left px-4 py-2.5 font-medium">Username</th>
                            <th className="text-left px-4 py-2.5 font-medium">Status</th>
                            <th className="text-right px-5 py-2.5 font-medium">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.items.map((st) => (
                            <tr key={st.id} className="hover:bg-slate-50">
                              <td className="px-5 py-3">
                                <div className="font-medium text-slate-900">{st.fullName}</div>
                                <div className="text-xs text-slate-500">{st.email}</div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-slate-700">{st.nisNisn}</td>
                              <td className="px-4 py-3 font-mono text-xs text-slate-700">{st.username}</td>
                              <td className="px-4 py-3">
                                <StatusLabel status={st.status} />
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditStudent(st)}
                                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                                    title="Edit Siswa"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setResetTarget(st)}
                                    className="p-1.5 text-slate-600 hover:text-violet-700 hover:bg-violet-50 rounded-md"
                                    title="Reset Password Siswa"
                                  >
                                    <KeyRound className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteStudentTarget(st)}
                                    className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                                    title="Hapus Peserta Didik"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {!group.items.length && (
                            <tr>
                              <td colSpan={5} className="px-5 py-5 text-center text-xs text-slate-500">
                                Belum ada peserta didik terdaftar di {group.title}.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* 3. CEK DIRI AGREGAT */}
      {activeTab === 'cek-diri' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">Ringkasan Cek Diri Siswa</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Data agregat 4 indikator untuk memetakan kebutuhan layanan bimbingan di {user.schoolName}.
            </p>
          </div>

          <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-950 flex items-start gap-3">
            <Info className="w-4 h-4 text-violet-700 shrink-0 mt-0.5" />
            <span>
              Hasil Cek Diri bersifat refleksi kebiasaan digital secara umum dan <strong>bukan merupakan diagnosis psikologis</strong> terhadap individu peserta didik.
            </span>
          </div>

          {assessments && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard label="Total Pengisian" value={assessments.summary.totalCount} subtext="Cek Diri tersimpan" accent />
                <StatCard label="Rata Intensitas" value={`${assessments.summary.avgIntensity} / 16`} />
                <StatCard label="Rata Dorongan" value={`${assessments.summary.avgUrge} / 16`} />
                <StatCard label="Sosial & Emosi" value={`${assessments.summary.avgSocialEmotion} / 16`} />
                <StatCard label="Kontrol & Dampak" value={`${assessments.summary.avgControlImpact} / 16`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-slate-900 mb-4">Sebaran Kategori Refleksi</h2>
                  <SimpleBarChart
                    data={assessments.categories.map((c) => ({ label: c.category, value: c.count }))}
                    unit="pengisian"
                    emptyText="Belum ada siswa yang mengisi Cek Diri."
                  />
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200">
                    <h2 className="text-base font-semibold text-slate-900">Rekapitulasi Per Kelas</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-5 py-3 font-medium">Kelas</th>
                          <th className="text-right px-4 py-3 font-medium">Jumlah Pengisian</th>
                          <th className="text-right px-5 py-3 font-medium">Rata-rata Skor (Maks 64)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {assessments.classOverview.map((c) => (
                          <tr key={c.className}>
                            <td className="px-5 py-3 font-medium text-slate-900">{c.className}</td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums">{c.assessmentCount}</td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums">{c.avgScore}</td>
                          </tr>
                        ))}
                        {!assessments.classOverview.length && (
                          <tr>
                            <td colSpan={3} className="px-5 py-8 text-center text-sm text-slate-500">
                              Belum ada data Cek Diri per kelas.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. PERMINTAAN KONSULTASI */}
      {activeTab === 'konsultasi' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display">Permintaan Konsultasi</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Kelola permintaan pendampingan dari peserta didik {user.schoolName}. Informasi bersifat rahasia.
              </p>
            </div>
            <div className="inline-flex p-1 bg-slate-200/70 rounded-lg gap-1 self-start">
              {[
                { id: '', label: 'Semua' },
                { id: 'MENUNGGU', label: 'Menunggu' },
                { id: 'DIPROSES', label: 'Diproses' },
                { id: 'SELESAI', label: 'Selesai' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setConsultStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                    consultStatusFilter === tab.id ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {consultations.map((c) => (
              <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold text-slate-900">{c.topic}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {c.studentName} · Kelas {c.className} · Diajukan {formatLocalDate(c.createdAt)} · Guru BK tujuan: {c.bkTeacherName}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusLabel status={c.status} />
                    <button
                      type="button"
                      onClick={() => openConsultationModal(c)}
                      className="px-3.5 py-1.5 bg-violet-700 hover:bg-violet-800 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Tanggapi &amp; Jadwalkan</span>
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg text-sm text-slate-800">
                  {c.message}
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                  <span>Preferensi siswa: {c.preferredSchedule || 'Fleksibel'}</span>
                  {c.scheduledAt && <span className="font-semibold text-violet-700">Jadwal ditetapkan: {c.scheduledAt}</span>}
                </div>

                {c.responses && c.responses.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="text-xs font-semibold text-slate-700">Riwayat Respons Guru BK:</div>
                    {c.responses.map((r) => (
                      <div key={r.id} className="p-3 bg-violet-50/70 border border-violet-200/70 rounded-lg text-xs space-y-1">
                        <div className="font-semibold text-violet-900">
                          {r.responderName} · <span className="font-mono font-normal">{formatLocalDateTime(r.createdAt, false)}</span>
                        </div>
                        <p className="text-slate-800">{r.responseText}</p>
                        {r.scheduleNote && <p className="text-violet-700 font-medium">Catatan jadwal: {r.scheduleNote}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {!consultations.length && (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                Belum ada permintaan konsultasi pada filter ini.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. CATATAN DAN REFLEKSI (SUKARELA DIBAGIKAN) */}
      {activeTab === 'catatan-refleksi' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">Catatan &amp; Refleksi Siswa</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Hanya menampilkan jurnal refleksi yang secara sadar dan sukarela dibagikan oleh peserta didik untuk keperluan pendampingan.
            </p>
          </div>

          <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-slate-600 shrink-0" />
            <span>Jurnal pribadi yang tidak dibagikan oleh peserta didik tetap terkunci dan tidak ditampilkan di halaman ini.</span>
          </div>

          <div className="space-y-4">
            {sharedJournals.map((j) => (
              <div key={j.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{j.studentName}</div>
                    <div className="text-xs text-slate-500">Kelas {j.className} · Tanggal refleksi {j.journalDate}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-slate-600">Perasaan setelah menggunakan medsos:</div>
                    <p className="text-slate-800 mt-0.5">{j.feelingAfterUse}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-600">Dampak pada aktivitas:</div>
                    <p className="text-slate-800 mt-0.5">{j.activityImpact}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-600">Kemampuan kontrol waktu:</div>
                    <p className="text-slate-800 mt-0.5">{j.timeControl}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-600">Kebiasaan yang ingin diperbaiki:</div>
                    <p className="text-slate-800 mt-0.5">{j.habitToImprove}</p>
                  </div>
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-slate-600">Perubahan positif yang sudah dilakukan:</div>
                  <p className="text-slate-800 mt-0.5">{j.positiveChange}</p>
                </div>
                {j.freeNote && (
                  <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700">
                    Catatan tambahan: {j.freeNote}
                  </div>
                )}
              </div>
            ))}
            {!sharedJournals.length && (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                Belum ada peserta didik yang membagikan jurnal refleksinya kepada Anda.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. LAPORAN SEKOLAH */}
      {activeTab === 'laporan' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display">Laporan Aktivitas Sekolah</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Rekapitulasi kegiatan DIGITAL BALANCE di {user.schoolName}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 no-print">
              <div className="inline-flex p-1 bg-slate-200/70 rounded-lg gap-1">
                {[
                  { id: '7d', label: '7 Hari' },
                  { id: '30d', label: '30 Hari' },
                  { id: 'all', label: 'Semua' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setReportPeriod(p.id as typeof reportPeriod)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md ${
                      reportPeriod === p.id ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={exportSchoolReportCsv}
                className="px-3.5 py-2 bg-violet-700 hover:bg-violet-800 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh CSV</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak</span>
              </button>
            </div>
          </div>

          {report && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Pengisian Cek Diri" value={report.summary.assessments} accent />
                <StatCard label="Catatan Penggunaan" value={report.summary.usageRecords} subtext={`${report.summary.totalMinutes} menit tercatat`} />
                <StatCard label="Target Siswa (Selesai)" value={`${report.summary.targets} (${report.summary.completedTargets})`} />
                <StatCard label="Konsultasi (Selesai)" value={`${report.summary.consultations} (${report.summary.doneConsultations})`} />
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="text-base font-semibold text-slate-900 mb-4">Aplikasi Media Sosial Terbanyak Dicatat Siswa</h2>
                <SimpleBarChart
                  data={report.topApps.map((a) => ({ label: `${a.appName} (${a.entries} catatan)`, value: a.totalMinutes }))}
                  unit="menit"
                  emptyText="Belum ada catatan penggunaan pada periode ini."
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* 7. PROFIL GURU BK */}
      {activeTab === 'profil' && (
        <div className="space-y-6 max-w-2xl">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">Profil Guru BK</h1>
            <p className="text-sm text-slate-500 mt-0.5">Identitas akun dan pengaturan keamanan.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">Nama Lengkap</div>
                <div className="font-semibold text-slate-900 mt-0.5">{user.fullName}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">NIP</div>
                <div className="font-mono text-slate-900 mt-0.5">{user.nip || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Email</div>
                <div className="text-slate-900 mt-0.5">{user.email}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Username</div>
                <div className="font-mono text-slate-900 mt-0.5">{user.username}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs text-slate-500">Sekolah Tempat Bertugas</div>
                <div className="font-semibold text-violet-700 mt-0.5">{user.schoolName}</div>
              </div>
            </div>
          </div>

          <form onSubmit={handleChangeOwnPassword} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Ubah Password</h2>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password Saat Ini</label>
              <input
                required
                type="password"
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password Baru (min. 6 karakter)</label>
              <input
                required
                minLength={6}
                type="password"
                value={pwdForm.newPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium rounded-lg">
              Simpan Password Baru
            </button>
          </form>
        </div>
      )}

      {/* MODALS */}
      <Modal
        open={studentModalOpen}
        onClose={() => setStudentModalOpen(false)}
        title={editingStudent ? 'Edit Peserta Didik' : 'Tambah Peserta Didik'}
      >
        <form onSubmit={saveStudent} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Kelas</label>
              <select
                value={studentForm.classId}
                onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="">-- Pilih Kelas --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status Akun</label>
              <select
                value={studentForm.status}
                onChange={(e) => setStudentForm({ ...studentForm, status: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          {!editingStudent && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password Awal</label>
              <input
                required
                minLength={6}
                type="password"
                value={studentForm.password}
                onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setStudentModalOpen(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">
              Batal
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-violet-700 text-white rounded-lg">
              Simpan
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={classModalOpen} onClose={() => setClassModalOpen(false)} title="Tambah Kelas Sekolah" maxWidth="max-w-sm">
        <form onSubmit={saveClass} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nama Kelas</label>
            <input
              required
              type="text"
              value={classForm.name}
              onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
              placeholder="Contoh: XI IPA 3"
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
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={`Reset Password: ${resetTarget?.fullName ?? ''}`}
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleResetStudentPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Password Baru</label>
            <input
              required
              minLength={6}
              type="password"
              value={resetPassValue}
              onChange={(e) => setResetPassValue(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setResetTarget(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">
              Batal
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-violet-700 text-white rounded-lg">
              Simpan
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(activeConsult)}
        onClose={() => setActiveConsult(null)}
        title={`Respons Konsultasi: ${activeConsult?.studentName ?? ''}`}
      >
        <form onSubmit={submitConsultResponse} className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
            <strong>Topik:</strong> {activeConsult?.topic}
            <p className="mt-1">{activeConsult?.message}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status Permintaan</label>
              <select
                value={consultResponseForm.status}
                onChange={(e) => setConsultResponseForm({ ...consultResponseForm, status: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="MENUNGGU">Menunggu</option>
                <option value="DIPROSES">Diproses</option>
                <option value="SELESAI">Selesai</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Jadwal Sesi Konsultasi</label>
              <input
                type="text"
                value={consultResponseForm.scheduledAt}
                onChange={(e) => setConsultResponseForm({ ...consultResponseForm, scheduledAt: e.target.value })}
                placeholder="Contoh: Kamis, 10:00 WIB (Ruang BK)"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Pesan Respons Guru BK</label>
            <textarea
              rows={3}
              value={consultResponseForm.responseText}
              onChange={(e) => setConsultResponseForm({ ...consultResponseForm, responseText: e.target.value })}
              placeholder="Tuliskan tanggapan yang hangat dan suportif..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setActiveConsult(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">
              Batal
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-violet-700 text-white rounded-lg">
              Simpan &amp; Kirim
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteStudentTarget)}
        onClose={() => setDeleteStudentTarget(null)}
        onConfirm={confirmDeleteStudent}
        title="Konfirmasi Hapus Peserta Didik"
        message={`Menghapus akun "${deleteStudentTarget?.fullName}" (${deleteStudentTarget?.nisNisn}) akan menghapus akun beserta seluruh data aktivitas dan konsultasinya secara permanen. Lanjutkan?`}
      />
    </DashboardShell>
  );
}
