import React, { useCallback, useEffect, useState } from 'react';
import {
  Home,
  ClipboardCheck,
  Clock,
  Target,
  BookHeart,
  Library,
  MessageCircleHeart,
  UserCircle2,
  Bot,
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  Lock,
  Share2,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import type {
  AuthUser,
  AssessmentQuestion,
  SelfAssessment,
  UsageRecord,
  TargetItem,
  ReflectionJournal,
  EducationalMaterial,
  ConsultationRequest,
  AnswerLabel,
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

const STUDENT_NAV: NavItem[] = [
  { id: 'beranda', label: 'Beranda', icon: Home },
  { id: 'cek-diri', label: 'Cek Diri', icon: ClipboardCheck },
  { id: 'catatan', label: 'Catatan Penggunaan', icon: Clock },
  { id: 'target', label: 'Target Saya', icon: Target },
  { id: 'jurnal', label: 'Jurnal Refleksi', icon: BookHeart },
  { id: 'edukasi', label: 'Pustaka Edukasi', icon: Library },
  { id: 'konsultasi', label: 'Hubungi Guru BK', icon: MessageCircleHeart },
  { id: 'teman-ai', label: 'Teman Refleksi AI', icon: Bot },
  { id: 'profil', label: 'Profil Saya', icon: UserCircle2 },
];

const EDUCATION_CATEGORIES = [
  'Mengenal Media Sosial',
  'Pentingnya Kontrol Diri',
  'Dampak Penggunaan Media Sosial',
  'Manajemen Waktu',
  'Kesehatan Sosial dan Emosional',
  'Membangun Kebiasaan Digital yang Sehat',
];

const ANSWER_CHOICES: Array<{ value: AnswerLabel; label: string }> = [
  { value: 'SS', label: 'SS · Sangat Setuju' },
  { value: 'S', label: 'S · Setuju' },
  { value: 'TS', label: 'TS · Tidak Setuju' },
  { value: 'STS', label: 'STS · Sangat Tidak Setuju' },
];

interface StudentHomeData {
  summary: {
    assessmentCount: number;
    usageTotalMinutes7d: number;
    usageCount: number;
    journalCount: number;
    openConsultations: number;
  };
  latestAssessment: { id: string; totalScore: number; maxScore: number; category: string; createdAt: string } | null;
  latestJournal: { id: string; journalDate: string } | null;
  activeTargets: TargetItem[];
  recentUsage: Array<{ id: string; recordDate: string; appName: string; durationMinutes: number; purpose: string }>;
}

interface SchoolBkTeacherItem {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  title: string;
  bio: string;
}

export function StudentDashboard({
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
  const [homeData, setHomeData] = useState<StudentHomeData | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [assessments, setAssessments] = useState<SelfAssessment[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerLabel>>({});
  const [quizStep, setQuizStep] = useState(0);
  const [quizMode, setQuizMode] = useState<'step' | 'list'>('step');
  const [latestResult, setLatestResult] = useState<SelfAssessment | null>(null);

  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [dailySummary, setDailySummary] = useState<Array<{ day: string; totalMinutes: number }>>([]);
  const [appSummary, setAppSummary] = useState<Array<{ appName: string; totalMinutes: number }>>([]);

  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [journals, setJournals] = useState<ReflectionJournal[]>([]);
  const [journalDateFilter, setJournalDateFilter] = useState('');

  const [materials, setMaterials] = useState<EducationalMaterial[]>([]);
  const [eduCategoryFilter, setEduCategoryFilter] = useState('');
  const [eduSearch, setEduSearch] = useState('');
  const [activeMaterial, setActiveMaterial] = useState<EducationalMaterial | null>(null);
  const [showImageStudio, setShowImageStudio] = useState(false);

  const [bkTeachers, setBkTeachers] = useState<SchoolBkTeacherItem[]>([]);
  const [consultations, setConsultations] = useState<ConsultationRequest[]>([]);

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Modals & Forms
  const todayStr = new Date().toISOString().slice(0, 10);

  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [editingUsage, setEditingUsage] = useState<UsageRecord | null>(null);
  const [usageForm, setUsageForm] = useState({
    recordDate: todayStr,
    appName: 'Instagram',
    durationMinutes: 45,
    purpose: 'Hiburan & Relaksasi',
    activityDescription: '',
    notes: '',
  });
  const [deleteUsageTarget, setDeleteUsageTarget] = useState<UsageRecord | null>(null);

  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetItem | null>(null);
  const [targetForm, setTargetForm] = useState({
    title: '',
    periodType: 'HARIAN' as 'HARIAN' | 'MINGGUAN',
    habitToImprove: '',
    dailyLimitMinutes: 60,
    startDate: todayStr,
    targetDate: todayStr,
    progressPercent: 0,
    status: 'BERJALAN' as 'BERJALAN' | 'SELESAI',
  });
  const [deleteTargetItem, setDeleteTargetItem] = useState<TargetItem | null>(null);

  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [editingJournal, setEditingJournal] = useState<ReflectionJournal | null>(null);
  const [journalForm, setJournalForm] = useState({
    journalDate: todayStr,
    feelingAfterUse: '',
    activityImpact: '',
    timeControl: '',
    habitToImprove: '',
    positiveChange: '',
    freeNote: '',
    sharedWithBk: false,
    sharedBkTeacherId: '',
  });
  const [deleteJournalTarget, setDeleteJournalTarget] = useState<ReflectionJournal | null>(null);

  const [consultForm, setConsultForm] = useState({
    bkTeacherId: '',
    topic: 'Kontrol Waktu Media Sosial',
    message: '',
    preferredSchedule: '',
  });

  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '' });

  const loadHome = useCallback(async () => {
    const data = await apiFetch<StudentHomeData>('/api/student/home');
    setHomeData(data);
  }, []);

  const loadAssessments = useCallback(async () => {
    const [qRes, aRes] = await Promise.all([
      apiFetch<{ questions: AssessmentQuestion[] }>('/api/student/assessments/questions'),
      apiFetch<{ assessments: SelfAssessment[] }>('/api/student/assessments'),
    ]);
    setQuestions(qRes.questions);
    setAssessments(aRes.assessments);
  }, []);

  const loadUsage = useCallback(async () => {
    const data = await apiFetch<{
      records: UsageRecord[];
      dailySummary: Array<{ day: string; totalMinutes: number }>;
      appSummary: Array<{ appName: string; totalMinutes: number }>;
    }>('/api/student/usage-records');
    setUsageRecords(data.records);
    setDailySummary(data.dailySummary);
    setAppSummary(data.appSummary);
  }, []);

  const loadTargets = useCallback(async () => {
    const data = await apiFetch<{ targets: TargetItem[] }>('/api/student/targets');
    setTargets(data.targets);
  }, []);

  const loadJournals = useCallback(async () => {
    const [jRes, bkRes] = await Promise.all([
      apiFetch<{ journals: ReflectionJournal[] }>('/api/student/journals'),
      apiFetch<{ bkTeachers: SchoolBkTeacherItem[] }>('/api/student/bk-teachers'),
    ]);
    setJournals(jRes.journals);
    setBkTeachers(bkRes.bkTeachers);
  }, []);

  const loadMaterials = useCallback(async () => {
    const params = new URLSearchParams();
    if (eduCategoryFilter) params.set('category', eduCategoryFilter);
    if (eduSearch) params.set('q', eduSearch);
    const data = await apiFetch<{ materials: EducationalMaterial[] }>(`/api/materials?${params.toString()}`);
    setMaterials(data.materials);
  }, [eduCategoryFilter, eduSearch]);

  const loadConsultations = useCallback(async () => {
    const [bkRes, cRes] = await Promise.all([
      apiFetch<{ bkTeachers: SchoolBkTeacherItem[] }>('/api/student/bk-teachers'),
      apiFetch<{ consultations: ConsultationRequest[] }>('/api/student/consultations'),
    ]);
    setBkTeachers(bkRes.bkTeachers);
    setConsultations(cRes.consultations);
    if (bkRes.bkTeachers.length > 0 && !consultForm.bkTeacherId) {
      setConsultForm((p) => ({ ...p, bkTeacherId: bkRes.bkTeachers[0].id }));
    }
  }, [consultForm.bkTeacherId]);

  useEffect(() => {
    setFeedback(null);
    const run = async () => {
      try {
        if (activeTab === 'beranda') await loadHome();
        else if (activeTab === 'cek-diri') await loadAssessments();
        else if (activeTab === 'catatan') await loadUsage();
        else if (activeTab === 'target') await loadTargets();
        else if (activeTab === 'jurnal') await loadJournals();
        else if (activeTab === 'edukasi') await loadMaterials();
        else if (activeTab === 'konsultasi') await loadConsultations();
      } catch (err) {
        setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal memuat data.' });
      }
    };
    run();
  }, [activeTab, loadHome, loadAssessments, loadUsage, loadTargets, loadJournals, loadMaterials, loadConsultations]);

  // --- CEK DIRI SUBMIT ---
  async function handleSubmitAssessment() {
    if (Object.keys(answers).length < questions.length) {
      setFeedback({ type: 'err', text: 'Harap jawab semua 16 pernyataan sebelum melihat hasil Cek Diri.' });
      return;
    }
    try {
      const res = await apiFetch<{ assessment: SelfAssessment }>('/api/student/assessments', {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      setLatestResult(res.assessment);
      setAnswers({});
      setQuizStep(0);
      await loadAssessments();
      setFeedback({ type: 'ok', text: 'Hasil Cek Diri berhasil dihitung dan disimpan.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan Cek Diri.' });
    }
  }

  // --- USAGE CRUD ---
  function openAddUsage() {
    setEditingUsage(null);
    setUsageForm({
      recordDate: todayStr,
      appName: 'Instagram',
      durationMinutes: 45,
      purpose: 'Hiburan & Relaksasi',
      activityDescription: '',
      notes: '',
    });
    setUsageModalOpen(true);
  }

  function openEditUsage(u: UsageRecord) {
    setEditingUsage(u);
    setUsageForm({
      recordDate: u.recordDate,
      appName: u.appName,
      durationMinutes: u.durationMinutes,
      purpose: u.purpose,
      activityDescription: u.activityDescription,
      notes: u.notes,
    });
    setUsageModalOpen(true);
  }

  async function saveUsage(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingUsage) {
        await apiFetch(`/api/student/usage-records/${editingUsage.id}`, {
          method: 'PUT',
          body: JSON.stringify(usageForm),
        });
        setFeedback({ type: 'ok', text: 'Catatan penggunaan berhasil diperbarui.' });
      } else {
        await apiFetch('/api/student/usage-records', {
          method: 'POST',
          body: JSON.stringify(usageForm),
        });
        setFeedback({ type: 'ok', text: 'Catatan penggunaan baru berhasil disimpan.' });
      }
      setUsageModalOpen(false);
      await loadUsage();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan catatan.' });
    }
  }

  async function confirmDeleteUsage() {
    if (!deleteUsageTarget) return;
    try {
      await apiFetch(`/api/student/usage-records/${deleteUsageTarget.id}`, { method: 'DELETE' });
      setDeleteUsageTarget(null);
      await loadUsage();
      setFeedback({ type: 'ok', text: 'Catatan penggunaan dihapus.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus catatan.' });
    }
  }

  // --- TARGETS CRUD ---
  function openAddTarget() {
    setEditingTarget(null);
    setTargetForm({
      title: '',
      periodType: 'HARIAN',
      habitToImprove: '',
      dailyLimitMinutes: 60,
      startDate: todayStr,
      targetDate: todayStr,
      progressPercent: 0,
      status: 'BERJALAN',
    });
    setTargetModalOpen(true);
  }

  function openEditTarget(t: TargetItem) {
    setEditingTarget(t);
    setTargetForm({
      title: t.title,
      periodType: t.periodType,
      habitToImprove: t.habitToImprove,
      dailyLimitMinutes: t.dailyLimitMinutes,
      startDate: t.startDate,
      targetDate: t.targetDate,
      progressPercent: t.progressPercent,
      status: t.status,
    });
    setTargetModalOpen(true);
  }

  async function saveTarget(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingTarget) {
        await apiFetch(`/api/student/targets/${editingTarget.id}`, {
          method: 'PUT',
          body: JSON.stringify(targetForm),
        });
        setFeedback({ type: 'ok', text: 'Target berhasil diperbarui.' });
      } else {
        await apiFetch('/api/student/targets', {
          method: 'POST',
          body: JSON.stringify(targetForm),
        });
        setFeedback({ type: 'ok', text: 'Target baru berhasil dibuat. Langkah kecil setiap hari sangat berarti!' });
      }
      setTargetModalOpen(false);
      await loadTargets();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan target.' });
    }
  }

  async function markTargetDone(t: TargetItem) {
    try {
      await apiFetch(`/api/student/targets/${t.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...t, progressPercent: 100, status: 'SELESAI' }),
      });
      await loadTargets();
      setFeedback({ type: 'ok', text: `Hebat! Target "${t.title}" telah ditandai selesai.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal memperbarui target.' });
    }
  }

  async function confirmDeleteTarget() {
    if (!deleteTargetItem) return;
    try {
      await apiFetch(`/api/student/targets/${deleteTargetItem.id}`, { method: 'DELETE' });
      setDeleteTargetItem(null);
      await loadTargets();
      setFeedback({ type: 'ok', text: 'Target dihapus.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus target.' });
    }
  }

  // --- JOURNALS CRUD ---
  function openAddJournal() {
    setEditingJournal(null);
    setJournalForm({
      journalDate: todayStr,
      feelingAfterUse: '',
      activityImpact: '',
      timeControl: '',
      habitToImprove: '',
      positiveChange: '',
      freeNote: '',
      sharedWithBk: false,
      sharedBkTeacherId: bkTeachers[0]?.id || '',
    });
    setJournalModalOpen(true);
  }

  function openEditJournal(j: ReflectionJournal) {
    setEditingJournal(j);
    setJournalForm({
      journalDate: j.journalDate,
      feelingAfterUse: j.feelingAfterUse,
      activityImpact: j.activityImpact,
      timeControl: j.timeControl,
      habitToImprove: j.habitToImprove,
      positiveChange: j.positiveChange,
      freeNote: j.freeNote,
      sharedWithBk: j.sharedWithBk,
      sharedBkTeacherId: j.sharedBkTeacherId || bkTeachers[0]?.id || '',
    });
    setJournalModalOpen(true);
  }

  async function saveJournal(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingJournal) {
        await apiFetch(`/api/student/journals/${editingJournal.id}`, {
          method: 'PUT',
          body: JSON.stringify(journalForm),
        });
        setFeedback({ type: 'ok', text: 'Jurnal refleksi berhasil diperbarui.' });
      } else {
        await apiFetch('/api/student/journals', {
          method: 'POST',
          body: JSON.stringify(journalForm),
        });
        setFeedback({ type: 'ok', text: 'Jurnal refleksi berhasil disimpan.' });
      }
      setJournalModalOpen(false);
      await loadJournals();
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan jurnal.' });
    }
  }

  async function confirmDeleteJournal() {
    if (!deleteJournalTarget) return;
    try {
      await apiFetch(`/api/student/journals/${deleteJournalTarget.id}`, { method: 'DELETE' });
      setDeleteJournalTarget(null);
      await loadJournals();
      setFeedback({ type: 'ok', text: 'Jurnal refleksi dihapus.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus jurnal.' });
    }
  }

  // --- CONSULTATION SUBMIT ---
  async function handleSendConsult(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/api/student/consultations', {
        method: 'POST',
        body: JSON.stringify(consultForm),
      });
      setConsultForm((p) => ({ ...p, message: '', preferredSchedule: '' }));
      await loadConsultations();
      setFeedback({ type: 'ok', text: 'Permintaan konsultasi berhasil dikirim ke Guru BK sekolah Anda.' });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Gagal mengirim permintaan konsultasi.' });
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

  const answeredCount = Object.keys(answers).length;
  const currentQuestion = questions[quizStep];
  const filteredJournals = journalDateFilter
    ? journals.filter((j) => j.journalDate === journalDateFilter)
    : journals;

  return (
    <DashboardShell
      roleTitle="PESERTA DIDIK"
      subtitle={`${user.schoolName || ''} · ${user.className || 'Kelas'}`}
      userName={user.fullName}
      navItems={STUDENT_NAV}
      activeTab={activeTab}
      onSelectTab={onSelectTab}
      onLogout={onLogout}
      mobileBottomIds={['beranda', 'cek-diri', 'target', 'jurnal']}
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

      {/* 1. BERANDA */}
      {activeTab === 'beranda' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display">
                Halo, {user.fullName}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {user.schoolName} · Kelas {user.className || '-'} · Yuk pantau kebiasaan digitalmu hari ini.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSelectTab('cek-diri')}
                className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium rounded-lg"
              >
                Mulai Cek Diri
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('teman-ai')}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg inline-flex items-center gap-1.5"
              >
                <Bot className="w-4 h-4 text-violet-700" />
                <span>Teman Refleksi AI</span>
              </button>
            </div>
          </div>

          {homeData && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Cek Diri Tersimpan"
                  value={homeData.summary.assessmentCount}
                  subtext={homeData.latestAssessment ? homeData.latestAssessment.category : 'Belum mengisi'}
                  accent
                />
                <StatCard
                  label="Durasi 7 Hari Terakhir"
                  value={`${homeData.summary.usageTotalMinutes7d} mnt`}
                  subtext={`${homeData.summary.usageCount} total catatan`}
                />
                <StatCard
                  label="Jurnal Refleksi"
                  value={homeData.summary.journalCount}
                  subtext={homeData.latestJournal ? `Terakhir ${homeData.latestJournal.journalDate}` : 'Belum ada jurnal'}
                />
                <StatCard
                  label="Konsultasi Aktif"
                  value={homeData.summary.openConsultations}
                  subtext="Menunggu / Diproses"
                />
              </div>

              {/* Reflection Reminder */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-violet-950">Pengingat Refleksi Harian</div>
                  <p className="text-xs text-violet-900 mt-0.5">
                    Luangkan 3 menit malam ini untuk menuliskan perasaanmu setelah menggunakan media sosial di Jurnal Refleksi pribadi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectTab('jurnal')}
                  className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold rounded-lg shrink-0 self-start sm:self-auto"
                >
                  Tulis Jurnal Sekarang
                </button>
              </div>

              {/* Quick Access */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'cek-diri', title: 'Cek Diri', desc: 'Kenali pola kebiasaanmu' },
                  { id: 'catatan', title: 'Catatan Penggunaan', desc: 'Catat durasi aplikasi' },
                  { id: 'target', title: 'Target Saya', desc: 'Atur batas layar sehat' },
                  { id: 'jurnal', title: 'Jurnal Refleksi', desc: 'Catatan pribadi harian' },
                ].map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => onSelectTab(q.id)}
                    className="bg-white border border-slate-200 hover:border-violet-400 rounded-xl p-4 text-left transition-colors"
                  >
                    <div className="text-sm font-semibold text-slate-900">{q.title}</div>
                    <div className="text-xs text-slate-500 mt-1">{q.desc}</div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">Target yang Sedang Berjalan</h2>
                    <button type="button" onClick={() => onSelectTab('target')} className="text-xs font-semibold text-violet-700 hover:underline">
                      Kelola Target
                    </button>
                  </div>
                  {homeData.activeTargets.map((t) => (
                    <div key={t.id} className="space-y-1.5 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-900">{t.title}</span>
                        <span className="font-mono tabular-nums text-xs font-semibold text-violet-700">
                          {t.progressPercent}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-600 rounded-full" style={{ width: `${t.progressPercent}%` }} />
                      </div>
                      <div className="text-xs text-slate-500">
                        {t.periodType} · Batas {t.dailyLimitMinutes} menit/hari · Target {t.targetDate}
                      </div>
                    </div>
                  ))}
                  {!homeData.activeTargets.length && (
                    <p className="text-sm text-slate-500 py-4">
                      Belum ada target dibuat. Buat target kecil pertamamu di menu Target Saya.
                    </p>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">Aktivitas Penggunaan Terbaru</h2>
                    <button type="button" onClick={() => onSelectTab('catatan')} className="text-xs font-semibold text-violet-700 hover:underline">
                      Lihat Semua
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {homeData.recentUsage.map((u) => (
                      <div key={u.id} className="py-2.5 flex items-center justify-between text-sm">
                        <div>
                          <div className="font-medium text-slate-900">{u.appName}</div>
                          <div className="text-xs text-slate-500">{u.recordDate} · {u.purpose}</div>
                        </div>
                        <span className="font-mono tabular-nums text-xs font-semibold text-slate-800">
                          {u.durationMinutes} mnt
                        </span>
                      </div>
                    ))}
                    {!homeData.recentUsage.length && (
                      <p className="text-sm text-slate-500 py-4">
                        Belum ada catatan penggunaan media sosial yang ditambahkan.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 2. CEK DIRI */}
      {activeTab === 'cek-diri' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display">Cek Diri Kebiasaan Digital</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Kenali kebiasaan media sosialmu melalui 4 indikator refleksi diri.
              </p>
            </div>
            <div className="inline-flex p-1 bg-slate-200/70 rounded-lg gap-1 self-start">
              <button
                type="button"
                onClick={() => setQuizMode('step')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                  quizMode === 'step' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                Per Pertanyaan
              </button>
              <button
                type="button"
                onClick={() => setQuizMode('list')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                  quizMode === 'list' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                Daftar Lengkap
              </button>
            </div>
          </div>

          <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl text-xs sm:text-sm text-violet-950 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-violet-700 shrink-0 mt-0.5" />
            <div>
              <strong>Petunjuk Pengisian:</strong> Pilih jawaban yang paling menggambarkan kondisimu dalam 2 minggu terakhir: <strong>SS</strong> (Sangat Setuju), <strong>S</strong> (Setuju), <strong>TS</strong> (Tidak Setuju), atau <strong>STS</strong> (Sangat Tidak Setuju). Hasil ini <strong>bukan diagnosis psikologis</strong>, melainkan cermin refleksi diri.
            </div>
          </div>

          {/* Latest Result Banner */}
          {latestResult && (
            <div className="bg-white border border-violet-300 rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-violet-700">Hasil Refleksi Terbaru</div>
                  <h2 className="text-xl font-bold text-slate-900 font-display">{latestResult.category}</h2>
                </div>
                <div className="text-right font-mono tabular-nums text-lg font-bold text-violet-700">
                  Skor {latestResult.totalScore} / {latestResult.maxScore}
                </div>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{latestResult.summaryText}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[11px] text-slate-500">Intensitas</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900">{latestResult.intensityScore} / 16</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[11px] text-slate-500">Dorongan</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900">{latestResult.urgeScore} / 16</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[11px] text-slate-500">Sosial &amp; Emosi</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900">{latestResult.socialEmotionScore} / 16</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[11px] text-slate-500">Kontrol &amp; Dampak</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900">{latestResult.controlImpactScore} / 16</div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                <strong>Saran Kegiatan Refleksi:</strong> {latestResult.reflectionSuggestion}
              </div>
            </div>
          )}

          {/* Questionnaire Card */}
          {questions.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Progres Pengisian</span>
                  <span className="font-mono tabular-nums font-semibold text-violet-700">
                    {answeredCount} / {questions.length} terjawab
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-600 transition-all duration-200"
                    style={{ width: `${Math.round((answeredCount / questions.length) * 100)}%` }}
                  />
                </div>
              </div>

              {quizMode === 'step' && currentQuestion && (
                <div className="space-y-5 py-2">
                  <div>
                    <div className="text-xs font-semibold text-violet-700">
                      Pertanyaan {quizStep + 1} dari {questions.length} · {currentQuestion.indicatorLabel}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mt-2 leading-snug">
                      {currentQuestion.statement}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ANSWER_CHOICES.map((ch) => {
                      const selected = answers[currentQuestion.key] === ch.value;
                      return (
                        <button
                          key={ch.value}
                          type="button"
                          onClick={() => {
                            setAnswers((prev) => ({ ...prev, [currentQuestion.key]: ch.value }));
                          }}
                          className={`px-4 py-3 text-left text-sm font-medium rounded-xl border transition-colors ${
                            selected
                              ? 'bg-violet-700 border-violet-700 text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-violet-400'
                          }`}
                        >
                          {ch.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={quizStep === 0}
                      onClick={() => setQuizStep((s) => Math.max(0, s - 1))}
                      className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Sebelumnya</span>
                    </button>

                    {quizStep < questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setQuizStep((s) => Math.min(questions.length - 1, s + 1))}
                        className="px-4 py-2 text-sm font-medium bg-violet-700 hover:bg-violet-800 text-white rounded-lg inline-flex items-center gap-1.5"
                      >
                        <span>Selanjutnya</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSubmitAssessment}
                        className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                      >
                        Lihat &amp; Simpan Hasil
                      </button>
                    )}
                  </div>
                </div>
              )}

              {quizMode === 'list' && (
                <div className="space-y-5">
                  {questions.map((q, idx) => (
                    <div key={q.key} className="pb-4 border-b border-slate-100 space-y-2.5">
                      <div className="text-xs font-semibold text-violet-700">
                        {idx + 1}. {q.indicatorLabel}
                      </div>
                      <p className="text-sm font-medium text-slate-900">{q.statement}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {ANSWER_CHOICES.map((ch) => {
                          const selected = answers[q.key] === ch.value;
                          return (
                            <button
                              key={ch.value}
                              type="button"
                              onClick={() => setAnswers((p) => ({ ...p, [q.key]: ch.value }))}
                              className={`px-3 py-2 text-xs font-semibold rounded-lg border ${
                                selected
                                  ? 'bg-violet-700 border-violet-700 text-white'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-violet-400'
                              }`}
                            >
                              {ch.value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSubmitAssessment}
                      className="px-5 py-2.5 text-sm font-semibold bg-violet-700 hover:bg-violet-800 text-white rounded-lg"
                    >
                      Lihat &amp; Simpan Hasil ({answeredCount}/{questions.length})
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Riwayat Cek Diri */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Riwayat Hasil Cek Diri</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {assessments.map((a) => (
                <div key={a.id} className="p-5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{a.category}</div>
                      <div className="text-xs text-slate-500 font-mono">{a.createdAt.slice(0, 16)}</div>
                    </div>
                    <div className="text-sm font-bold font-mono tabular-nums text-violet-700">
                      {a.totalScore} / {a.maxScore}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">{a.summaryText}</p>
                </div>
              ))}
              {!assessments.length && (
                <div className="px-6 py-8 text-center text-sm text-slate-500">
                  Belum ada riwayat Cek Diri. Jawab kuesioner di atas untuk melihat hasil pertamamu.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. CATATAN PENGGUNAAN */}
      {activeTab === 'catatan' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display">Catatan Penggunaan Media Sosial</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Catat durasi dan tujuan penggunaan aplikasimu agar lebih sadar terhadap pola waktu harian.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddUsage}
              className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 self-start"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Catatan</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Grafik Durasi Harian (7 Hari Terakhir)</h2>
              <SimpleBarChart
                data={dailySummary.map((d) => ({ label: d.day, value: d.totalMinutes }))}
                unit="menit"
                emptyText="Belum ada catatan penggunaan."
              />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-4">Ringkasan Per Aplikasi</h2>
              <SimpleBarChart
                data={appSummary.map((a) => ({ label: a.appName, value: a.totalMinutes }))}
                unit="menit"
                emptyText="Belum ada aplikasi tercatat."
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Tanggal</th>
                    <th className="text-left px-4 py-3 font-medium">Aplikasi</th>
                    <th className="text-right px-4 py-3 font-medium">Durasi</th>
                    <th className="text-left px-4 py-3 font-medium">Tujuan &amp; Aktivitas</th>
                    <th className="text-right px-5 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usageRecords.map((u) => (
                    <tr key={u.id}>
                      <td className="px-5 py-3 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {u.recordDate}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{u.appName}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-violet-700">
                        {u.durationMinutes} mnt
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-900">{u.purpose}</div>
                        <div className="text-xs text-slate-500">{u.activityDescription}</div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditUsage(u)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteUsageTarget(u)}
                            className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!usageRecords.length && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                        Belum ada catatan penggunaan. Klik Tambah Catatan untuk memulai.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. TARGET SAYA */}
      {activeTab === 'target' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display">Target Saya</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Tetapkan target harian atau mingguan yang realistis untuk membangun kendali diri.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddTarget}
              className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 self-start"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Target</span>
            </button>
          </div>

          <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-950">
            Perubahan kebiasaan membutuhkan proses bertahap. Hargai setiap langkah kecil yang kamu capai hari ini tanpa menyalahkan diri sendiri.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {targets.map((t) => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-violet-700">{t.periodType}</div>
                    <h3 className="text-base font-semibold text-slate-900 mt-0.5">{t.title}</h3>
                  </div>
                  <StatusLabel status={t.status} />
                </div>

                <p className="text-sm text-slate-600">{t.habitToImprove}</p>

                <div className="text-xs text-slate-500 font-mono tabular-nums">
                  Batas: {t.dailyLimitMinutes} menit/hari · {t.startDate} s.d. {t.targetDate}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Progres Pencapaian</span>
                    <span className="font-mono tabular-nums font-bold text-violet-700">{t.progressPercent}%</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-600 rounded-full" style={{ width: `${t.progressPercent}%` }} />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  {t.status !== 'SELESAI' ? (
                    <button
                      type="button"
                      onClick={() => markTargetDone(t)}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Tandai Selesai</span>
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-emerald-700">Target tercapai</span>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditTarget(t)}
                      className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                      title="Edit Target"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTargetItem(t)}
                      className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                      title="Hapus Target"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!targets.length && (
              <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                Belum ada target yang dibuat. Klik Buat Target untuk menetapkan target pertamamu.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. JURNAL REFLEKSI */}
      {activeTab === 'jurnal' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display">Jurnal Refleksi Pribadi</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Ruang aman untuk menuliskan refleksi harianmu. Jurnal bersifat pribadi dan tidak otomatis terlihat Guru BK maupun Admin.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddJournal}
              className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 self-start"
            >
              <Plus className="w-4 h-4" />
              <span>Tulis Jurnal</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Lock className="w-4 h-4 text-violet-700 shrink-0" />
              <span>Hanya kamu yang dapat membaca jurnalmu, kecuali kamu memilih membagikannya ke Guru BK sekolah.</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={journalDateFilter}
                onChange={(e) => setJournalDateFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
              {journalDateFilter && (
                <button
                  type="button"
                  onClick={() => setJournalDateFilter('')}
                  className="text-xs font-semibold text-violet-700 hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {filteredJournals.map((j) => (
              <div key={j.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular-nums text-sm font-bold text-slate-900">{j.journalDate}</span>
                    {j.sharedWithBk ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700">
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Dibagikan ke {j.sharedBkTeacherName || 'Guru BK'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Pribadi</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditJournal(j)}
                      className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                      title="Edit Jurnal"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteJournalTarget(j)}
                      className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                      title="Hapus Jurnal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Perasaan setelah menggunakan media sosial</div>
                    <p className="text-slate-800 mt-0.5">{j.feelingAfterUse}</p>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Pengaruh pada aktivitas harian</div>
                    <p className="text-slate-800 mt-0.5">{j.activityImpact}</p>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Kontrol waktu hari ini</div>
                    <p className="text-slate-800 mt-0.5">{j.timeControl}</p>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Kebiasaan yang ingin diperbaiki</div>
                    <p className="text-slate-800 mt-0.5">{j.habitToImprove}</p>
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-xs font-semibold text-slate-500">Perubahan positif yang sudah dilakukan</div>
                  <p className="text-slate-800 mt-0.5">{j.positiveChange}</p>
                </div>
                {j.freeNote && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                    {j.freeNote}
                  </div>
                )}
              </div>
            ))}
            {!filteredJournals.length && (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                Belum ada catatan jurnal refleksi. Klik Tulis Jurnal untuk mulai merefleksikan harimu.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. PUSTAKA EDUKASI */}
      {activeTab === 'edukasi' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-display">Pustaka Edukasi</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Baca materi ringan seputar literasi media sosial, kontrol diri, dan kesehatan emosional.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowImageStudio((s) => !s)}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg self-start"
            >
              {showImageStudio ? 'Tutup Studio Ilustrasi' : 'Buat Ilustrasi Papan Motivasi'}
            </button>
          </div>

          {showImageStudio && <ImageStudioPanel />}

          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={eduSearch}
                onChange={(e) => setEduSearch(e.target.value)}
                placeholder="Cari judul atau topik materi..."
                className="w-full text-sm bg-transparent focus:outline-none"
              />
            </div>
            <select
              value={eduCategoryFilter}
              onChange={(e) => setEduCategoryFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="">Semua Kategori (6 Materi)</option>
              {EDUCATION_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {materials.map((m) => (
              <div key={m.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                <div className="h-44 bg-slate-100 overflow-hidden">
                  <img
                    src={m.imageUrl}
                    alt={m.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-violet-700">{m.category}</div>
                    <h3 className="text-base font-bold text-slate-900 mt-1 leading-snug">{m.title}</h3>
                    <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">{m.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveMaterial(m)}
                    className="w-full py-2 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg"
                  >
                    Baca Materi Lengkap
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. HUBUNGI GURU BK */}
      {activeTab === 'konsultasi' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">Hubungi Guru BK</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Ajukan permintaan konsultasi pribadi kepada Guru BK di {user.schoolName}. Percakapan terjaga kerahasiaannya.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="text-base font-semibold text-slate-900">Guru BK Sekolah Anda</h2>
                {bkTeachers.map((bk) => (
                  <div key={bk.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="font-semibold text-slate-900 text-sm">{bk.fullName}</div>
                    <div className="text-violet-700 font-medium">{bk.title}</div>
                    <div className="text-slate-600">{bk.email}</div>
                    {bk.bio && <p className="text-slate-500 pt-1">{bk.bio}</p>}
                  </div>
                ))}
                {!bkTeachers.length && (
                  <p className="text-xs text-slate-500">Belum ada Guru BK aktif terdaftar di sekolah Anda.</p>
                )}
              </div>

              <form onSubmit={handleSendConsult} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h2 className="text-base font-semibold text-slate-900">Ajukan Permintaan Konsultasi</h2>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Pilih Guru BK</label>
                  <select
                    required
                    value={consultForm.bkTeacherId}
                    onChange={(e) => setConsultForm({ ...consultForm, bkTeacherId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    <option value="">-- Pilih Guru BK --</option>
                    {bkTeachers.map((bk) => (
                      <option key={bk.id} value={bk.id}>
                        {bk.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Topik Konsultasi</label>
                  <select
                    value={consultForm.topic}
                    onChange={(e) => setConsultForm({ ...consultForm, topic: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    <option value="Kontrol Waktu Media Sosial">Kontrol Waktu Media Sosial</option>
                    <option value="Fokus Belajar & Manajemen Waktu">Fokus Belajar &amp; Manajemen Waktu</option>
                    <option value="Tekanan Sosial / Emosi di Dunia Maya">Tekanan Sosial / Emosi di Dunia Maya</option>
                    <option value="Pendampingan Hasil Cek Diri">Pendampingan Hasil Cek Diri</option>
                    <option value="Lainnya (Masalah Pribadi)">Lainnya (Masalah Pribadi)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Waktu Pilihan (Opsional)</label>
                  <input
                    type="text"
                    value={consultForm.preferredSchedule}
                    onChange={(e) => setConsultForm({ ...consultForm, preferredSchedule: e.target.value })}
                    placeholder="Contoh: Istirahat kedua atau pulang sekolah"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Pesan untuk Guru BK</label>
                  <textarea
                    required
                    rows={3}
                    value={consultForm.message}
                    onChange={(e) => setConsultForm({ ...consultForm, message: e.target.value })}
                    placeholder="Ceritakan hal yang ingin kamu diskusikan..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!bkTeachers.length}
                  className="w-full py-2.5 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                >
                  Kirim Permintaan Konsultasi
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-base font-semibold text-slate-900">Riwayat Permintaan &amp; Respons Guru BK</h2>
              {consultations.map((c) => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">{c.topic}</div>
                      <div className="text-xs text-slate-500">
                        Kepada {c.bkTeacherName} · {c.createdAt.slice(0, 10)}
                      </div>
                    </div>
                    <StatusLabel status={c.status} />
                  </div>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">{c.message}</p>
                  {c.scheduledAt && (
                    <div className="text-xs font-semibold text-violet-700">
                      Jadwal Konsultasi dari Guru BK: {c.scheduledAt}
                    </div>
                  )}
                  {c.responses && c.responses.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      {c.responses.map((r) => (
                        <div key={r.id} className="p-3 bg-violet-50 border border-violet-200 rounded-lg text-xs space-y-1">
                          <div className="font-semibold text-violet-900">{r.responderName}</div>
                          <p className="text-slate-800">{r.responseText}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {!consultations.length && (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                  Belum ada permintaan konsultasi yang kamu kirimkan.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. TEMAN REFLEKSI AI */}
      {activeTab === 'teman-ai' && (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">Teman Refleksi AI</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Diskusikan cara mengatur waktu layar, mencari strategi belajar fokus, atau merangkai refleksi harianmu.
            </p>
          </div>
          <GeminiChatPanel
            userRoleLabel="Peserta Didik"
            defaultPrompts={[
              'Bagaimana cara mengurangi kebiasaan scrolling sebelum tidur?',
              'Bantu aku membuat jadwal belajar 2 jam tanpa terganggu notifikasi ponsel',
              'Apa pertanyaan refleksi diri yang bagus untuk akhir pekan ini?',
            ]}
          />
        </div>
      )}

      {/* 9. PROFIL SAYA */}
      {activeTab === 'profil' && (
        <div className="space-y-6 max-w-2xl">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">Profil Saya</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Identitas resmi peserta didik dikelola oleh sekolah untuk menjaga keakuratan data.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">Nama Lengkap</div>
                <div className="font-semibold text-slate-900 mt-0.5">{user.fullName}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">NIS / NISN</div>
                <div className="font-mono text-slate-900 mt-0.5">{user.nisNisn || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Kelas</div>
                <div className="font-semibold text-slate-900 mt-0.5">{user.className || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Sekolah</div>
                <div className="font-semibold text-violet-700 mt-0.5">{user.schoolName}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Username</div>
                <div className="font-mono text-slate-900 mt-0.5">{user.username}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Email</div>
                <div className="text-slate-900 mt-0.5">{user.email}</div>
              </div>
            </div>
          </div>

          <form onSubmit={handleChangeOwnPassword} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Ubah Password Akun</h2>
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
              Perbarui Password
            </button>
          </form>
        </div>
      )}

      {/* MODALS */}
      <Modal
        open={usageModalOpen}
        onClose={() => setUsageModalOpen(false)}
        title={editingUsage ? 'Edit Catatan Penggunaan' : 'Tambah Catatan Penggunaan'}
      >
        <form onSubmit={saveUsage} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal</label>
              <input
                required
                type="date"
                value={usageForm.recordDate}
                onChange={(e) => setUsageForm({ ...usageForm, recordDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Durasi (Menit)</label>
              <input
                required
                min={1}
                type="number"
                value={usageForm.durationMinutes}
                onChange={(e) => setUsageForm({ ...usageForm, durationMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Aplikasi Media Sosial</label>
              <input
                required
                type="text"
                value={usageForm.appName}
                onChange={(e) => setUsageForm({ ...usageForm, appName: e.target.value })}
                placeholder="TikTok, Instagram, YouTube..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tujuan Penggunaan</label>
              <input
                required
                type="text"
                value={usageForm.purpose}
                onChange={(e) => setUsageForm({ ...usageForm, purpose: e.target.value })}
                placeholder="Belajar, Hiburan, Komunikasi..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Aktivitas yang Dilakukan</label>
            <input
              required
              type="text"
              value={usageForm.activityDescription}
              onChange={(e) => setUsageForm({ ...usageForm, activityDescription: e.target.value })}
              placeholder="Contoh: Menonton video pendek atau berdiskusi tugas kelas"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
            <textarea
              rows={2}
              value={usageForm.notes}
              onChange={(e) => setUsageForm({ ...usageForm, notes: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setUsageModalOpen(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">
              Batal
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-violet-700 text-white rounded-lg">
              Simpan Catatan
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={targetModalOpen}
        onClose={() => setTargetModalOpen(false)}
        title={editingTarget ? 'Edit Target Saya' : 'Buat Target Baru'}
      >
        <form onSubmit={saveTarget} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Judul Target</label>
            <input
              required
              type="text"
              value={targetForm.title}
              onChange={(e) => setTargetForm({ ...targetForm, title: e.target.value })}
              placeholder="Contoh: Bebas medsos sebelum jam 21.30"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Periode</label>
              <select
                value={targetForm.periodType}
                onChange={(e) => setTargetForm({ ...targetForm, periodType: e.target.value as 'HARIAN' | 'MINGGUAN' })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="HARIAN">Harian</option>
                <option value="MINGGUAN">Mingguan</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Batas Waktu (Menit/Hari)</label>
              <input
                required
                min={5}
                type="number"
                value={targetForm.dailyLimitMinutes}
                onChange={(e) => setTargetForm({ ...targetForm, dailyLimitMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Kebiasaan yang Ingin Diperbaiki</label>
            <input
              required
              type="text"
              value={targetForm.habitToImprove}
              onChange={(e) => setTargetForm({ ...targetForm, habitToImprove: e.target.value })}
              placeholder="Contoh: Mengurangi membuka video pendek di sela jam belajar"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Mulai</label>
              <input
                required
                type="date"
                value={targetForm.startDate}
                onChange={(e) => setTargetForm({ ...targetForm, startDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Target</label>
              <input
                required
                type="date"
                value={targetForm.targetDate}
                onChange={(e) => setTargetForm({ ...targetForm, targetDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
              <span>Progres Saat Ini</span>
              <span className="font-mono">{targetForm.progressPercent}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={targetForm.progressPercent}
              onChange={(e) => setTargetForm({ ...targetForm, progressPercent: Number(e.target.value) })}
              className="w-full accent-violet-700"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setTargetModalOpen(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">
              Batal
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-violet-700 text-white rounded-lg">
              Simpan Target
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={journalModalOpen}
        onClose={() => setJournalModalOpen(false)}
        title={editingJournal ? 'Edit Jurnal Refleksi' : 'Tulis Jurnal Refleksi'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={saveJournal} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal Refleksi</label>
            <input
              required
              type="date"
              value={journalForm.journalDate}
              onChange={(e) => setJournalForm({ ...journalForm, journalDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              1. Bagaimana perasaan saya setelah menggunakan media sosial hari ini?
            </label>
            <input
              required
              type="text"
              value={journalForm.feelingAfterUse}
              onChange={(e) => setJournalForm({ ...journalForm, feelingAfterUse: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              2. Apakah penggunaan media sosial memengaruhi aktivitas saya?
            </label>
            <input
              required
              type="text"
              value={journalForm.activityImpact}
              onChange={(e) => setJournalForm({ ...journalForm, activityImpact: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              3. Apakah saya sudah mampu mengontrol waktu penggunaan media sosial?
            </label>
            <input
              required
              type="text"
              value={journalForm.timeControl}
              onChange={(e) => setJournalForm({ ...journalForm, timeControl: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              4. Apa kebiasaan yang ingin saya perbaiki?
            </label>
            <input
              required
              type="text"
              value={journalForm.habitToImprove}
              onChange={(e) => setJournalForm({ ...journalForm, habitToImprove: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              5. Perubahan positif apa yang sudah saya lakukan?
            </label>
            <input
              required
              type="text"
              value={journalForm.positiveChange}
              onChange={(e) => setJournalForm({ ...journalForm, positiveChange: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Catatan Bebas (Opsional)</label>
            <textarea
              rows={2}
              value={journalForm.freeNote}
              onChange={(e) => setJournalForm({ ...journalForm, freeNote: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
            <label className="flex items-start gap-2.5 text-xs text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={journalForm.sharedWithBk}
                onChange={(e) => setJournalForm({ ...journalForm, sharedWithBk: e.target.checked })}
                className="mt-0.5 accent-violet-700"
              />
              <span>
                <strong>Bagikan jurnal ini secara sukarela ke Guru BK sekolah</strong> untuk keperluan pendampingan (biarkan tidak dicentang jika ingin tetap pribadi).
              </span>
            </label>
            {journalForm.sharedWithBk && (
              <select
                value={journalForm.sharedBkTeacherId}
                onChange={(e) => setJournalForm({ ...journalForm, sharedBkTeacherId: e.target.value })}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Semua Guru BK di sekolah saya</option>
                {bkTeachers.map((bk) => (
                  <option key={bk.id} value={bk.id}>
                    Khusus {bk.fullName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setJournalModalOpen(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">
              Batal
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-violet-700 text-white rounded-lg">
              Simpan Jurnal
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(activeMaterial)}
        onClose={() => setActiveMaterial(null)}
        title={activeMaterial?.title ?? ''}
        maxWidth="max-w-2xl"
      >
        {activeMaterial && (
          <div className="space-y-4 text-sm text-slate-700">
            <img
              src={activeMaterial.imageUrl}
              alt={activeMaterial.title}
              className="w-full h-52 object-cover rounded-xl border border-slate-200"
              referrerPolicy="no-referrer"
            />
            <div className="text-xs font-semibold text-violet-700">{activeMaterial.category}</div>
            <p className="leading-relaxed">{activeMaterial.summary}</p>
            <div>
              <h4 className="font-semibold text-slate-900 mb-1.5">Tujuan Pembelajaran</h4>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                {activeMaterial.learningObjectives.map((obj) => (
                  <li key={obj}>{obj}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-1.5">Poin Penting</h4>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                {activeMaterial.keyPoints.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
            </div>
            <div className="p-3.5 bg-violet-50 border border-violet-200 rounded-lg text-violet-950">
              <strong>Kesimpulan:</strong> {activeMaterial.conclusion}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(deleteUsageTarget)}
        onClose={() => setDeleteUsageTarget(null)}
        onConfirm={confirmDeleteUsage}
        title="Hapus Catatan Penggunaan"
        message={`Hapus catatan penggunaan "${deleteUsageTarget?.appName}" tanggal ${deleteUsageTarget?.recordDate}?`}
      />

      <ConfirmModal
        open={Boolean(deleteTargetItem)}
        onClose={() => setDeleteTargetItem(null)}
        onConfirm={confirmDeleteTarget}
        title="Hapus Target"
        message={`Hapus target "${deleteTargetItem?.title}"?`}
      />

      <ConfirmModal
        open={Boolean(deleteJournalTarget)}
        onClose={() => setDeleteJournalTarget(null)}
        onConfirm={confirmDeleteJournal}
        title="Hapus Jurnal Refleksi"
        message={`Hapus jurnal refleksi tanggal ${deleteJournalTarget?.journalDate}?`}
      />
    </DashboardShell>
  );
}
