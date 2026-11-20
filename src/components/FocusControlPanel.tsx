import React, { useCallback, useEffect, useState } from 'react';
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Target,
  MessageCircleHeart,
  CheckSquare,
  Square,
  Compass,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { FocusSession } from '../shared/types.ts';

interface StrategyGuide {
  id: string;
  situation: string;
  summary: string;
  steps: string[];
  suggestedTarget: {
    title: string;
    habitToImprove: string;
    dailyLimitMinutes: number;
  };
}

const STRATEGY_GUIDES: StrategyGuide[] = [
  {
    id: 'malam',
    situation: 'Susah berhenti scrolling saat malam hari',
    summary:
      'Paparan konten pendek menjelang tidur menunda rasa kantuk dan membuat kualitas istirahat berkurang. Memberi jarak fisik dengan ponsel adalah langkah paling efektif.',
    steps: [
      'Aktifkan jadwal Mode Tidur / Jangan Ganggu otomatis mulai pukul 21.30.',
      'Letakkan ponsel di meja belajar (bukan di samping bantal) 30 menit sebelum tidur.',
      'Ganti 15 menit terakhir sebelum tidur dengan membaca buku atau menyiapkan perlengkapan sekolah esok hari.',
    ],
    suggestedTarget: {
      title: 'Bebas Layar 30 Menit Sebelum Tidur',
      habitToImprove: 'Menghentikan kebiasaan scrolling larut malam agar tidur lebih berkualitas.',
      dailyLimitMinutes: 90,
    },
  },
  {
    id: 'belajar',
    situation: 'Sering tergoda membuka ponsel saat sedang belajar',
    summary:
      'Setiap notifikasi yang masuk memecah konsentrasi belajar hingga beberapa menit ke depan. Mengatur blok fokus singkat membuat tugas selesai jauh lebih cepat.',
    steps: [
      'Gunakan Timer Fokus di sebelah kiri selama 25 menit dan letakkan ponsel dalam mode senyap.',
      'Tutup tab atau aplikasi media sosial yang tidak berkaitan dengan materi belajar.',
      'Ambil jeda 5 menit setelah satu sesi fokus selesai sebelum memeriksa pesan penting.',
    ],
    suggestedTarget: {
      title: 'Blok Belajar Fokus Tanpa Notifikasi',
      habitToImprove: 'Menahan dorongan mengecek media sosial saat sesi belajar berlangsung.',
      dailyLimitMinutes: 60,
    },
  },
  {
    id: 'emosi',
    situation: 'Merasa cemas atau membandingkan diri di media sosial',
    summary:
      'Linimasa media sosial umumnya hanya menampilkan potongan sorotan terbaik orang lain. Mengatur ulang konten yang kamu ikuti membantu menjaga ketenangan diri.',
    steps: [
      'Bisukan (mute) atau berhenti mengikuti akun yang memicu rasa cemas atau membandingkan diri.',
      'Luangkan waktu berbicara tatap muka atau melakukan hobi nyata bersama teman atau keluarga.',
      'Tuliskan perasaanmu di Jurnal Refleksi atau ajukan diskusi pribadi bersama Guru BK sekolah.',
    ],
    suggestedTarget: {
      title: 'Kurasi Linimasa Sehat & Refleksi Mingguan',
      habitToImprove: 'Mengurangi paparan konten pemicu kecemasan sosial di media sosial.',
      dailyLimitMinutes: 60,
    },
  },
  {
    id: 'waktu',
    situation: 'Waktu luang habis untuk hiburan tanpa terasa',
    summary:
      'Umpan tak terbatas (infinite scroll) membuat kita kehilangan rasa waktu. Menentukan niat sebelum membuka aplikasi mengembalikan kendali penuh padamu.',
    steps: [
      'Sebelum membuka aplikasi hiburan, tentukan tujuan spesifik dan batas waktunya (misal 15 menit).',
      'Catat durasi harianmu di menu Catatan Penggunaan agar pola pemakaian terlihat jelas.',
      'Siapkan daftar aktivitas pengganti seperti olahraga ringan, menggambar, atau istirahat.',
    ],
    suggestedTarget: {
      title: 'Batasi Hiburan Digital Terjadwal',
      habitToImprove: 'Menghindari scrolling pasif tanpa tujuan di waktu luang.',
      dailyLimitMinutes: 75,
    },
  },
];

const DAILY_HABITS = [
  'Menyalakan Mode Jangan Ganggu saat belajar atau mengerjakan tugas',
  'Memberi jeda 10 detik sebelum membuka aplikasi media sosial',
  'Berhenti menatap layar minimal 30 menit sebelum waktu tidur',
  'Meluangkan waktu berinteraksi tatap muka tanpa memegang ponsel',
];

const DURATION_PRESETS = [5, 15, 25, 45];

export function FocusControlPanel({
  onGoToConsult,
  onGoToTargets,
}: {
  onGoToConsult: () => void;
  onGoToTargets: () => void;
}) {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);

  // Focus Timer State
  const [presetMinutes, setPresetMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [focusTitle, setFocusTitle] = useState('Belajar Fokus Bebas Distraksi');
  const [reflectionNote, setReflectionNote] = useState('');
  const [savingSession, setSavingSession] = useState(false);

  // Strategy & Habit State
  const [selectedGuideId, setSelectedGuideId] = useState<string>(STRATEGY_GUIDES[0].id);
  const [habitDone, setHabitDone] = useState<Record<number, boolean>>({});
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await apiFetch<{
        sessions: FocusSession[];
        sessionCount: number;
        totalMinutes: number;
      }>('/api/student/focus-sessions');
      setSessions(data.sessions);
      setSessionCount(data.sessionCount);
      setTotalMinutes(data.totalMinutes);
    } catch {
      // ignore initial error if offline
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  function selectPreset(mins: number) {
    setRunning(false);
    setPresetMinutes(mins);
    setSecondsLeft(mins * 60);
  }

  function resetTimer() {
    setRunning(false);
    setSecondsLeft(presetMinutes * 60);
  }

  async function saveCompletedSession() {
    if (!focusTitle.trim()) {
      setNotice({ type: 'err', text: 'Tuliskan kegiatan fokusmu terlebih dahulu.' });
      return;
    }
    const elapsedSeconds = presetMinutes * 60 - secondsLeft;
    const recordedMinutes = secondsLeft === 0 ? presetMinutes : Math.max(1, Math.round(elapsedSeconds / 60) || presetMinutes);

    setSavingSession(true);
    setNotice(null);
    try {
      await apiFetch('/api/student/focus-sessions', {
        method: 'POST',
        body: JSON.stringify({
          title: focusTitle.trim(),
          durationMinutes: recordedMinutes,
          sessionDate: new Date().toISOString().slice(0, 10),
          reflectionNote: reflectionNote.trim(),
        }),
      });
      setRunning(false);
      setSecondsLeft(presetMinutes * 60);
      setReflectionNote('');
      await loadSessions();
      setNotice({
        type: 'ok',
        text: `Sesi fokus "${focusTitle.trim()}" (${recordedMinutes} menit) berhasil disimpan ke riwayatmu.`,
      });
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan sesi fokus.' });
    } finally {
      setSavingSession(false);
    }
  }

  async function deleteSession(id: string) {
    try {
      await apiFetch(`/api/student/focus-sessions/${id}`, { method: 'DELETE' });
      await loadSessions();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menghapus catatan fokus.' });
    }
  }

  async function addTargetFromGuide(guide: StrategyGuide) {
    setNotice(null);
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    try {
      await apiFetch('/api/student/targets', {
        method: 'POST',
        body: JSON.stringify({
          title: guide.suggestedTarget.title,
          periodType: 'HARIAN',
          habitToImprove: guide.suggestedTarget.habitToImprove,
          dailyLimitMinutes: guide.suggestedTarget.dailyLimitMinutes,
          startDate: today.toISOString().slice(0, 10),
          targetDate: nextWeek.toISOString().slice(0, 10),
          progressPercent: 0,
        }),
      });
      setNotice({
        type: 'ok',
        text: `Target "${guide.suggestedTarget.title}" berhasil ditambahkan ke menu Target Saya.`,
      });
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Gagal membuat target.' });
    }
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const totalSec = presetMinutes * 60;
  const pctDone = totalSec > 0 ? Math.round(((totalSec - secondsLeft) / totalSec) * 100) : 0;

  const activeGuide = STRATEGY_GUIDES.find((g) => g.id === selectedGuideId) || STRATEGY_GUIDES[0];
  const checkedHabitCount = Object.values(habitDone).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {notice && (
        <div
          className={`px-4 py-3 rounded-xl border text-sm flex items-center justify-between gap-4 ${
            notice.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-semibold underline shrink-0">
            Tutup
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Focus Timer */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Timer className="w-4 h-4 text-violet-700" />
                <span>Timer Fokus Bebas Distraksi</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Latih kontrol diri dengan menyisihkan ponsel selama sesi belajar atau istirahat.
              </p>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500">Total Fokus</div>
              <div className="text-sm font-bold font-mono tabular-nums text-violet-700">
                {totalMinutes} mnt ({sessionCount}x)
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Aktivitas Fokus</label>
            <input
              type="text"
              value={focusTitle}
              onChange={(e) => setFocusTitle(e.target.value)}
              placeholder="Contoh: Mengerjakan tugas matematika tanpa HP"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white"
            />
          </div>

          <div>
            <div className="text-xs font-medium text-slate-700 mb-1.5">Pilih Durasi Sesi</div>
            <div className="grid grid-cols-4 gap-2">
              {DURATION_PRESETS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => selectPreset(mins)}
                  className={`py-2 px-2 rounded-lg border text-xs font-semibold font-mono transition-colors ${
                    presetMinutes === mins
                      ? 'bg-violet-700 text-white border-violet-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-violet-400'
                  }`}
                >
                  {mins} mnt
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center space-y-3">
            <div className="text-5xl font-bold font-mono tabular-nums text-slate-900 tracking-tight">
              {mm}:{ss}
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-600 transition-all duration-300"
                style={{ width: `${pctDone}%` }}
              />
            </div>
            <div className="text-xs text-slate-500">
              {secondsLeft === 0
                ? 'Waktu sesi selesai! Simpan catatan fokusmu di bawah.'
                : running
                ? 'Sesi fokus sedang berjalan — jauhkan ponsel dari jangkauan.'
                : 'Tekan Mulai Fokus saat kamu siap meletakkan ponsel.'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              disabled={secondsLeft === 0}
              className="flex-1 py-2.5 px-4 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{running ? 'Jeda' : secondsLeft < totalSec ? 'Lanjutkan' : 'Mulai Fokus'}</span>
            </button>
            <button
              type="button"
              onClick={resetTimer}
              className="py-2.5 px-3.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <input
              type="text"
              value={reflectionNote}
              onChange={(e) => setReflectionNote(e.target.value)}
              placeholder="Catatan singkat setelah fokus (opsional)"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
            />
            <button
              type="button"
              onClick={saveCompletedSession}
              disabled={savingSession}
              className="w-full py-2 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{savingSession ? 'Menyimpan...' : 'Selesai & Simpan Sesi Fokus'}</span>
            </button>
          </div>
        </div>

        {/* Right: Instant Situation Strategy Guide & Daily Habit Checklist */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Compass className="w-4 h-4 text-violet-700" />
                <span>Panduan Situasi &amp; Strategi Kontrol Diri</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih kondisi yang paling sesuai dengan situasi digitalmu saat ini untuk melihat langkah praktisnya.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STRATEGY_GUIDES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGuideId(g.id)}
                  className={`p-3 rounded-lg border text-left text-xs font-medium transition-colors ${
                    selectedGuideId === g.id
                      ? 'border-violet-700 bg-violet-50 text-violet-900 font-semibold'
                      : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-violet-300'
                  }`}
                >
                  {g.situation}
                </button>
              ))}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">{activeGuide.summary}</p>
              <div>
                <div className="text-xs font-semibold text-violet-700 mb-2">3 Langkah Praktis Hari Ini</div>
                <ul className="space-y-2 text-sm text-slate-800">
                  {activeGuide.steps.map((step, i) => (
                    <li key={step} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-violet-100 text-violet-800 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 font-mono">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => addTargetFromGuide(activeGuide)}
                  className="px-3.5 py-2 bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>Jadikan Target Saya</span>
                </button>
                <button
                  type="button"
                  onClick={onGoToTargets}
                  className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg"
                >
                  Lihat Target Saya
                </button>
                <button
                  type="button"
                  onClick={onGoToConsult}
                  className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-violet-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                >
                  <MessageCircleHeart className="w-3.5 h-3.5" />
                  <span>Diskusi dengan Guru BK</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Checklist Kebiasaan Sehat Hari Ini</h2>
              <span className="text-xs font-mono tabular-nums font-semibold text-violet-700">
                {checkedHabitCount} / {DAILY_HABITS.length} Selesai
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {DAILY_HABITS.map((habit, idx) => {
                const checked = Boolean(habitDone[idx]);
                return (
                  <button
                    key={habit}
                    type="button"
                    onClick={() => setHabitDone((p) => ({ ...p, [idx]: !p[idx] }))}
                    className="w-full py-2.5 flex items-center gap-3 text-left text-sm hover:bg-slate-50 px-2 rounded-lg"
                  >
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-violet-700 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className={checked ? 'line-through text-slate-400' : 'text-slate-800'}>{habit}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Saved Focus Sessions History */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Riwayat Sesi Fokus Tersimpan</h2>
            <p className="text-xs text-slate-500">Daftar latihan fokus tanpa distraksi yang telah kamu selesaikan.</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {sessions.map((s) => (
            <div key={s.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">{s.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  <span className="font-mono tabular-nums">{s.sessionDate}</span>
                  {s.reflectionNote ? ` · ${s.reflectionNote}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold font-mono tabular-nums text-violet-700">
                  {s.durationMinutes} mnt
                </span>
                <button
                  type="button"
                  onClick={() => deleteSession(s.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                  title="Hapus sesi"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {!sessions.length && (
            <div className="px-6 py-8 text-center text-sm text-slate-500">
              Belum ada sesi fokus yang tersimpan. Gunakan Timer Fokus di atas untuk memulai sesi pertamamu.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
