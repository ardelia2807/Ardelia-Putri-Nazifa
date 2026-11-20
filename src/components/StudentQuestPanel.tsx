import React, { useCallback, useEffect, useState } from 'react';
import {
  Trophy,
  Gamepad2,
  Flame,
  Award,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Timer,
  Play,
  Pause,
  Sparkles,
  Lock,
  MessageCircleHeart,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { FocusSession } from '../shared/types.ts';

interface MissionSummaryData {
  totalPoints: number;
  levelInfo: {
    level: number;
    title: string;
    nextLevelPoints: number;
    progressPercent: number;
  };
  activeDays: number;
  completedTodayKeys: string[];
  recentCompletions: Array<{
    id: string;
    missionKey: string;
    missionTitle: string;
    points: number;
    completedDate: string;
  }>;
  badges: Array<{
    id: string;
    title: string;
    desc: string;
    unlocked: boolean;
  }>;
}

const DAILY_MISSIONS = [
  {
    key: 'detoks_malam',
    title: 'Detoks Layar 30 Menit Sebelum Tidur',
    desc: 'Letakkan ponsel di luar jangkauan tempat tidur minimal 30 menit sebelum beristirahat malam ini.',
    points: 30,
  },
  {
    key: 'mode_senyap',
    title: 'Mode Senyap Saat Belajar',
    desc: 'Matikan suara notifikasi aplikasi hiburan selama 1 sesi belajar di rumah.',
    points: 25,
  },
  {
    key: 'jurnal_jujur',
    title: 'Refleksi Perasaan Hari Ini',
    desc: 'Luangkan 2 menit untuk mengecek bagaimana perasaanmu setelah memakai media sosial hari ini.',
    points: 25,
  },
  {
    key: 'aksi_nyata',
    title: 'Aktivitas Dunia Nyata 20 Menit',
    desc: 'Lakukan olahraga ringan, hobi non-layar, atau ngobrol tatap muka tanpa memegang ponsel.',
    points: 30,
  },
  {
    key: 'kurasi_feed',
    title: 'Rapikan Beranda Media Sosial',
    desc: 'Bisukan atau berhenti mengikuti minimal 1 akun yang sering membuatmu cemas atau terdistraksi.',
    points: 20,
  },
];

interface ScenarioOption {
  label: string;
  score: number;
  feedback: string;
}

interface ScenarioItem {
  id: string;
  timeTag: string;
  title: string;
  story: string;
  options: ScenarioOption[];
}

const SCENARIOS: ScenarioItem[] = [
  {
    id: 'sc1',
    timeTag: 'Pukul 22.30 · Malam Sebelum Ulangan',
    title: 'Grup Chat Tiba-Tiba Ramai Video Lucu',
    story:
      'Kamu sudah bersiap tidur supaya besok segar saat ulangan, tapi teman-teman mengirim 12 video pendek di grup chat yang bikin penasaran.',
    options: [
      {
        label: 'Bisukan grup sampai besok pagi dan taruh HP di meja belajar.',
        score: 20,
        feedback: 'Mantap! Memasang batas di jam tidur menjaga fokus dan energi besok pagi tetap maksimal.',
      },
      {
        label: 'Tonton 2 video saja sebagai hadiah, lalu pasang timer berhenti dalam 5 menit.',
        score: 12,
        feedback: 'Cukup baik karena kamu memasang batas waktu, asal benar-benar berhenti saat timer berbunyi.',
      },
      {
        label: 'Lanjut nonton semua dan membalas sampai tidak sadar sudah lewat tengah malam.',
        score: 4,
        feedback: 'Waspada jebakan scrolling malam! Kurang tidur bikin konsentrasi ulangan besok menurun.',
      },
    ],
  },
  {
    id: 'sc2',
    timeTag: 'Pukul 16.00 · Belajar di Rumah',
    title: 'Notifikasi Live Streaming Muncul di Layar',
    story:
      'Baru 10 menit mengerjakan tugas, muncul notifikasi kreator favoritmu sedang live streaming sekarang.',
    options: [
      {
        label: 'Aktifkan mode Jangan Ganggu, selesaikan 25 menit fokus dulu, baru cek siaran ulangnya nanti.',
        score: 20,
        feedback: 'Pilihan kontrol diri terbaik! Tugas beres lebih cepat dan kamu tetap bisa menikmati hiburan dengan tenang.',
      },
      {
        label: 'Buka live sebentar di latar belakang sambil tetap mengerjakan tugas.',
        score: 8,
        feedback: 'Multitasking dengan tontonan sering membuat tugas terasa dua kali lebih lama selesai.',
      },
      {
        label: 'Tinggalkan buku tugas dan langsung menonton live sampai selesai.',
        score: 4,
        feedback: 'Dorongan sesaat mengambil alih prioritasmu. Coba latih jeda 10 detik sebelum menekan notifikasi.',
      },
    ],
  },
  {
    id: 'sc3',
    timeTag: 'Akhir Pekan · Scrolling Beranda',
    title: 'Melihat Postingan Teman dan Merasa Minder',
    story:
      'Saat membuka media sosial, kamu melihat teman-teman tampak selalu seru dan berprestasi, sehingga kamu mulai merasa kurang percaya diri.',
    options: [
      {
        label: 'Ingat bahwa unggahan hanya sorotan terbaik, tutup aplikasi sejenak, lalu lakukan hal yang kamu sukai.',
        score: 20,
        feedback: 'Kesadaran emosi yang sehat! Kamu mampu membedakan sorotan media sosial dengan realita.',
      },
      {
        label: 'Terus melihat profil orang lain sambil membandingkan diri dengan pencapaian mereka.',
        score: 4,
        feedback: 'Membandingkan diri terus-menerus menguras energi mental. Coba istirahat sejenak dari linimasa.',
      },
      {
        label: 'Ceritakan perasaanmu di Jurnal Refleksi atau ajak teman dekat/Guru BK mengobrol.',
        score: 18,
        feedback: 'Langkah positif! Berbagi cerita membantu meringankan tekanan emosional.',
      },
    ],
  },
  {
    id: 'sc4',
    timeTag: 'Pukul 19.30 · Cari Referensi Tugas',
    title: 'Niat Cari Bahan Belajar, Eh Nyasar ke FYP',
    story:
      'Kamu membuka aplikasi video pendek untuk mencari contoh eksperimen IPA, tapi tiba-tiba sudah 35 menit menonton konten hiburan acak.',
    options: [
      {
        label: 'Sadar saat itu juga, tutup tab hiburan, dan tulis kata kunci tugas secara spesifik.',
        score: 20,
        feedback: 'Kesadaran cepat adalah kunci! Begitu sadar terdistraksi, langsung kembali ke tujuan awal.',
      },
      {
        label: 'Berjanji "satu video lagi ya", lalu lanjut terus tanpa batas jelas.',
        score: 5,
        feedback: 'Algoritma dirancang agar selalu ada "satu video lagi". Pasang batas tegas di awal.',
      },
      {
        label: 'Gunakan browser khusus belajar agar tidak tercampur rekomendasi hiburan.',
        score: 18,
        feedback: 'Strategi lingkungan yang cerdas untuk meminimalkan godaan algoritma!',
      },
    ],
  },
  {
    id: 'sc5',
    timeTag: 'Komentar Media Sosial',
    title: 'Ada Komentar Menyindir di Unggahanmu',
    story:
      'Seseorang meninggalkan komentar bercanda yang terasa menyakitkan di unggahan fotomu.',
    options: [
      {
        label: 'Ambil jeda tenang, jangan membalas saat emosi; hapus/batasi komentar bila perlu dan cerita ke orang terpercaya.',
        score: 20,
        feedback: 'Dewasa dan bijak! Melindungi ruang digitalmu dari komentar negatif adalah hakmu.',
      },
      {
        label: 'Langsung balas dengan komentar sindiran balik supaya tidak kalah.',
        score: 4,
        feedback: 'Membalas saat emosi hanya memperpanjang konflik online dan membuat suasana hati makin buruk.',
      },
      {
        label: 'Diamkan saja tapi terus kepikiran seharian tanpa bercerita ke siapa pun.',
        score: 10,
        feedback: 'Menjaga jarak itu baik, namun jangan dipendam sendiri—kamu bisa berdiskusi dengan Guru BK.',
      },
    ],
  },
];

export function StudentQuestPanel({
  onGoToConsult,
}: {
  onGoToConsult: () => void;
}) {
  const [subTab, setSubTab] = useState<'simulasi' | 'misi' | 'fokus'>('simulasi');
  const [missionData, setMissionData] = useState<MissionSummaryData | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Simulation Game State
  const [stepIdx, setStepIdx] = useState(0);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [simScore, setSimScore] = useState(0);
  const [simFinished, setSimFinished] = useState(false);

  // Compact Focus Timer State
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [presetMinutes, setPresetMinutes] = useState(15);
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const [running, setRunning] = useState(false);
  const [focusTitle, setFocusTitle] = useState('Sesi Fokus Tanpa HP');
  const [savingFocus, setSavingFocus] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [mRes, fRes] = await Promise.all([
        apiFetch<MissionSummaryData>('/api/student/missions'),
        apiFetch<{ sessions: FocusSession[] }>('/api/student/focus-sessions'),
      ]);
      setMissionData(mRes);
      setSessions(fRes.sessions);
    } catch {
      // silent fallback
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  async function completeMission(key: string, title: string) {
    setNotice(null);
    try {
      const res = await apiFetch<{ ok: boolean; alreadyCompleted: boolean; points?: number; message?: string }>(
        '/api/student/missions/complete',
        {
          method: 'POST',
          body: JSON.stringify({ missionKey: key, missionTitle: title }),
        }
      );
      if (res.alreadyCompleted) {
        setNotice({ type: 'ok', text: res.message || 'Misi ini sudah diselesaikan hari ini.' });
      } else {
        setNotice({ type: 'ok', text: `Keren! "${title}" selesai (+${res.points} Poin Keseimbangan).` });
      }
      await loadAll();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan misi.' });
    }
  }

  function chooseOption(idx: number) {
    if (selectedOptionIdx !== null) return;
    const opt = SCENARIOS[stepIdx].options[idx];
    setSelectedOptionIdx(idx);
    setSimScore((prev) => prev + opt.score);
  }

  async function nextScenario() {
    if (stepIdx + 1 < SCENARIOS.length) {
      setStepIdx((i) => i + 1);
      setSelectedOptionIdx(null);
      return;
    }
    setSimFinished(true);
    await completeMission('simulasi_keputusan', 'Menyelesaikan Simulasi Pilih Langkahmu');
  }

  function restartSimulation() {
    setStepIdx(0);
    setSelectedOptionIdx(null);
    setSimScore(0);
    setSimFinished(false);
  }

  async function saveFocusSession() {
    if (!focusTitle.trim()) return;
    setSavingFocus(true);
    setNotice(null);
    const elapsedMin = Math.max(1, Math.round((presetMinutes * 60 - secondsLeft) / 60) || presetMinutes);
    try {
      await apiFetch('/api/student/focus-sessions', {
        method: 'POST',
        body: JSON.stringify({
          title: focusTitle.trim(),
          durationMinutes: secondsLeft === 0 ? presetMinutes : elapsedMin,
          sessionDate: new Date().toISOString().slice(0, 10),
          reflectionNote: 'Sesi Mode Fokus',
        }),
      });
      setRunning(false);
      setSecondsLeft(presetMinutes * 60);
      setNotice({ type: 'ok', text: `Sesi fokus berhasil disimpan (+20 Poin Keseimbangan)!` });
      await loadAll();
    } catch (err) {
      setNotice({ type: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan sesi fokus.' });
    } finally {
      setSavingFocus(false);
    }
  }

  const currentScenario = SCENARIOS[stepIdx];
  const maxSimScore = SCENARIOS.length * 20;
  const simResultTitle =
    simScore >= 85
      ? 'Master Kontrol Diri'
      : simScore >= 60
      ? 'Penjelajah Digital Adaptif'
      : 'Butuh Rem Tambahan';
  const simResultDesc =
    simScore >= 85
      ? 'Hebat! Kamu sudah punya naluri kuat untuk memprioritaskan belajar, tidur, dan ketenangan emosi di dunia maya.'
      : simScore >= 60
      ? 'Sudah cukup seimbang! Tinggal perkuat batas waktu saat godaan notifikasi atau scrolling muncul.'
      : 'Tidak apa-apa, ini saat yang tepat untuk mulai melatih jeda sadar sebelum membuka media sosial dan mencoba misi harian.';

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="space-y-6">
      {/* Gamified Level & Points Header */}
      <div className="bg-gradient-to-r from-violet-700 to-violet-600 text-white rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-200">
              <Trophy className="w-4 h-4" />
              <span>Level {missionData?.levelInfo.level ?? 1} · {missionData?.levelInfo.title ?? 'Penjelajah Sadar'}</span>
            </div>
            <h2 className="text-2xl font-bold font-display">
              {missionData?.totalPoints ?? 0} Poin Keseimbangan
            </h2>
            <p className="text-xs text-violet-100">
              Kumpulkan poin dari Simulasi Keputusan, Misi Harian, Cek Diri, Catatan Penggunaan, dan Jurnal Refleksi.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-white/15 rounded-xl px-4 py-3 text-center min-w-[96px]">
              <div className="flex items-center justify-center gap-1 text-xs text-violet-100">
                <Flame className="w-3.5 h-3.5" />
                <span>Hari Aktif</span>
              </div>
              <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                {missionData?.activeDays ?? 0}
              </div>
            </div>
            <div className="bg-white/15 rounded-xl px-4 py-3 text-center min-w-[96px]">
              <div className="flex items-center justify-center gap-1 text-xs text-violet-100">
                <Award className="w-3.5 h-3.5" />
                <span>Lencana</span>
              </div>
              <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                {missionData ? missionData.badges.filter((b) => b.unlocked).length : 0}/{missionData?.badges.length ?? 6}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs text-violet-100">
            <span>Progres Menuju Level Berikutnya</span>
            <span className="font-mono tabular-nums">
              {missionData?.totalPoints ?? 0} / {missionData?.levelInfo.nextLevelPoints ?? 100} Poin
            </span>
          </div>
          <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${missionData?.levelInfo.progressPercent ?? 0}%` }}
            />
          </div>
        </div>
      </div>

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

      {/* Sub-navigation */}
      <div className="inline-flex flex-wrap p-1 bg-slate-200/70 rounded-lg gap-1">
        {[
          { id: 'simulasi', label: 'Simulasi "Pilih Langkahmu!"', icon: Gamepad2 },
          { id: 'misi', label: 'Misi Harian & Lencana', icon: Trophy },
          { id: 'fokus', label: 'Mode Fokus Cepat', icon: Timer },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id as typeof subTab)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 transition-colors ${
                subTab === item.id ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. INTERACTIVE SCENARIO MINI-GAME */}
      {subTab === 'simulasi' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          {!simFinished ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-violet-700">
                  Skenario {stepIdx + 1} dari {SCENARIOS.length} · {currentScenario.timeTag}
                </span>
                <span className="text-xs font-mono tabular-nums font-bold text-slate-700">
                  Skor Sementara: {simScore}
                </span>
              </div>

              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-600 transition-all duration-300"
                  style={{ width: `${Math.round(((stepIdx + (selectedOptionIdx !== null ? 1 : 0)) / SCENARIOS.length) * 100)}%` }}
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900 font-display">{currentScenario.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{currentScenario.story}</p>
              </div>

              <div className="space-y-2.5">
                {currentScenario.options.map((opt, idx) => {
                  const isChosen = selectedOptionIdx === idx;
                  const revealed = selectedOptionIdx !== null;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={revealed}
                      onClick={() => chooseOption(idx)}
                      className={`w-full text-left p-4 rounded-xl border text-sm transition-colors ${
                        isChosen
                          ? opt.score >= 18
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                            : 'border-violet-600 bg-violet-50 text-violet-950'
                          : revealed
                          ? 'border-slate-200 bg-slate-50 text-slate-400'
                          : 'border-slate-200 bg-white hover:border-violet-500 hover:bg-violet-50/40 text-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-medium leading-relaxed">{opt.label}</span>
                        {isChosen && (
                          <span className="text-xs font-mono font-bold text-violet-700 shrink-0">
                            +{opt.score}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedOptionIdx !== null && (
                <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl space-y-3">
                  <div className="text-sm text-violet-950 leading-relaxed">
                    <span className="font-semibold">Dampak Pilihanmu: </span>
                    {currentScenario.options[selectedOptionIdx].feedback}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={nextScenario}
                      className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                    >
                      <span>{stepIdx + 1 < SCENARIOS.length ? 'Lanjut Skenario Berikutnya' : 'Lihat Profil & Klaim +40 Poin'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-4 space-y-5 text-center max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-violet-700 uppercase tracking-wider">Hasil Simulasi Kamu</div>
                <h3 className="text-2xl font-bold text-slate-900 font-display mt-1">{simResultTitle}</h3>
                <div className="text-sm font-mono font-bold text-violet-700 mt-1">
                  Skor Kontrol Diri: {simScore} / {maxSimScore}
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{simResultDesc}</p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={restartSimulation}
                  className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Mainkan Ulang</span>
                </button>
                <button
                  type="button"
                  onClick={onGoToConsult}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-medium rounded-lg inline-flex items-center gap-2"
                >
                  <MessageCircleHeart className="w-4 h-4 text-violet-700" />
                  <span>Cerita ke Guru BK</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. DAILY MISSIONS & BADGES */}
      {subTab === 'misi' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Misi Harian Keseimbangan Digital</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tandai misi positif yang berhasil kamu lakukan hari ini untuk menambah poin levelmu.
              </p>
            </div>
            <div className="space-y-3">
              {DAILY_MISSIONS.map((m) => {
                const done = missionData?.completedTodayKeys.includes(m.key) ?? false;
                return (
                  <div
                    key={m.key}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                      done ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50/60 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{m.title}</span>
                        <span className="text-xs font-mono font-bold text-violet-700">+{m.points}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{m.desc}</p>
                    </div>
                    <button
                      type="button"
                      disabled={done}
                      onClick={() => completeMission(m.key, m.title)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 ${
                        done
                          ? 'bg-emerald-100 text-emerald-800 cursor-default'
                          : 'bg-violet-700 hover:bg-violet-800 text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{done ? 'Selesai Hari Ini' : 'Klaim Misi'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Koleksi Lencana Pencapaian</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Lencana otomatis terbuka saat kamu aktif memakai fitur DIGITAL BALANCE.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(missionData?.badges ?? []).map((b) => (
                <div
                  key={b.id}
                  className={`p-3.5 rounded-xl border space-y-1.5 ${
                    b.unlocked ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-200 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${b.unlocked ? 'text-violet-800' : 'text-slate-600'}`}>
                      {b.title}
                    </span>
                    {b.unlocked ? (
                      <Award className="w-4 h-4 text-violet-700 shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. COMPACT FOCUS TIMER */}
      {subTab === 'fokus' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Tantangan Fokus Tanpa Ponsel</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Selesaikan satu sesi fokus tanpa membuka media sosial untuk memperoleh +20 Poin.
              </p>
            </div>

            <input
              type="text"
              value={focusTitle}
              onChange={(e) => setFocusTitle(e.target.value)}
              placeholder="Aktivitas fokus saat ini..."
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
            />

            <div className="grid grid-cols-4 gap-2">
              {[5, 15, 25, 45].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setRunning(false);
                    setPresetMinutes(m);
                    setSecondsLeft(m * 60);
                  }}
                  className={`py-2 rounded-lg border text-xs font-mono font-semibold ${
                    presetMinutes === m
                      ? 'bg-violet-700 text-white border-violet-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {m} mnt
                </button>
              ))}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl py-6 text-center">
              <div className="text-5xl font-bold font-mono tabular-nums text-slate-900">
                {mm}:{ss}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRunning((r) => !r)}
                disabled={secondsLeft === 0}
                className="flex-1 py-2.5 px-4 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2"
              >
                {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{running ? 'Jeda' : 'Mulai Timer'}</span>
              </button>
              <button
                type="button"
                onClick={saveFocusSession}
                disabled={savingFocus}
                className="py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{savingFocus ? 'Menyimpan...' : 'Selesai (+20 Poin)'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h3 className="text-base font-semibold text-slate-900">Riwayat Sesi Fokus</h3>
            <div className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-slate-900">{s.title}</div>
                    <div className="text-xs text-slate-500 font-mono">{s.sessionDate}</div>
                  </div>
                  <span className="font-mono font-bold text-violet-700">{s.durationMinutes} mnt</span>
                </div>
              ))}
              {!sessions.length && (
                <div className="py-8 text-center text-sm text-slate-500">
                  Belum ada sesi fokus tercatat. Ayo mulai tantangan pertamamu!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
