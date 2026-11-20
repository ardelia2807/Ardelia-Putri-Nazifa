import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react';
import { apiFetch, setStoredToken } from '../lib/api.ts';
import type { AuthUser } from '../shared/types.ts';
import { Modal } from '../components/UiPrimitives.tsx';

const SEEDED_TEST_ACCOUNTS = [
  {
    role: 'ADMIN CENTRAL',
    name: 'Koordinator Admin Central',
    username: 'admin.central',
    pass: 'Admin123!',
    school: 'Pengelola Multi-Sekolah',
  },
  {
    role: 'GURU BK',
    name: 'Dra. Sari Wijaya, M.Pd.',
    username: 'bk.sari',
    pass: 'GuruBK123!',
    school: 'SMA Negeri 1 Harapan',
  },
  {
    role: 'GURU BK (Sekolah 2)',
    name: 'Budi Santoso, S.Pd., Kons.',
    username: 'bk.budi',
    pass: 'GuruBK123!',
    school: 'SMP Negeri 2 Cendekia',
  },
  {
    role: 'PESERTA DIDIK',
    name: 'Dina Amalia Putri (X IPA 1)',
    username: 'siswa.dina',
    pass: 'Siswa123!',
    school: 'SMA Negeri 1 Harapan',
  },
  {
    role: 'PESERTA DIDIK (Sekolah 2)',
    name: 'Rafi Ahmad Fauzan (VIII-A)',
    username: 'siswa.rafi',
    pass: 'Siswa123!',
    school: 'SMP Negeri 2 Cendekia',
  },
];

export function LoginPage({ onLoginSuccess }: { onLoginSuccess: (user: AuthUser) => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTestAccounts, setShowTestAccounts] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotId, setForgotId] = useState('');
  const [forgotReason, setForgotReason] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotResult, setForgotResult] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError('Mohon masukkan username atau email serta password Anda.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      setStoredToken(data.token);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk ke sistem.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setForgotError(null);
    setForgotResult(null);

    if (!forgotId.trim()) {
      setForgotError('Masukkan username atau email akun Anda.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier: forgotId.trim(), reason: forgotReason.trim() }),
      });
      setForgotResult(res.message);
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Gagal mengirim permintaan.');
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Hero Column */}
      <div className="lg:w-1/2 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-6 sm:p-10 lg:p-14 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-700 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-slate-900 font-display">
                DIGITAL BALANCE
              </div>
              <div className="text-xs font-medium text-violet-700">
                Layanan Bimbingan &amp; Konseling Bidang Pribadi
              </div>
            </div>
          </div>

          <div className="mt-8 lg:mt-12 max-w-xl">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight leading-tight text-balance font-display">
              Kenali kebiasaan digital, latih kontrol diri, dan jaga keseimbangan waktu.
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
              Platform terpadu untuk Admin Central, Guru BK, dan Peserta Didik lintas sekolah dalam mendampingi refleksi aktivitas media sosial secara aman dan terstruktur.
            </p>
          </div>
        </div>

        <div className="mt-8 hidden sm:block">
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            <img
              src="/src/assets/images/login_digital_balance_hero_1795163570176.jpg"
              alt="Ilustrasi ruang belajar yang tenang dan seimbang secara digital"
              className="w-full h-64 lg:h-72 object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>Multi-School</span>
            <span aria-hidden="true">·</span>
            <span>Role-Based Access Control</span>
            <span aria-hidden="true">·</span>
            <span>Privasi Jurnal Terjaga</span>
          </div>
        </div>
      </div>

      {/* Right Login Column */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-md space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 font-display">Masuk ke Akun Anda</h2>
              <p className="mt-1 text-sm text-slate-500">
                Satu pintu masuk untuk Admin Central, Guru BK, dan Peserta Didik.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800 flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-identifier" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Username atau Email
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Contoh: admin.central atau nama@sekolah.sch.id"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotId(identifier);
                      setForgotError(null);
                      setForgotResult(null);
                      setForgotOpen(true);
                    }}
                    className="text-xs font-medium text-violet-700 hover:underline"
                  >
                    Lupa password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password Anda"
                    className="w-full pl-3.5 pr-11 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 rounded-md"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                {loading ? 'Memverifikasi akun...' : 'Masuk'}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
              Akun Guru BK dan Peserta Didik didaftarkan oleh pengelola sekolah melalui sistem pengelolaan pengguna DIGITAL BALANCE.
            </div>
          </div>

          {/* Collapsible Initial Seeded Credentials for Immediate Verification */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTestAccounts((p) => !p)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <span className="inline-flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-violet-700" />
                <span>Daftar Akun Awal &amp; Pengujian Sistem</span>
              </span>
              {showTestAccounts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showTestAccounts && (
              <div className="px-5 pb-4 pt-1 border-t border-slate-100 space-y-2">
                <p className="text-[11px] text-slate-500 mb-2">
                  Klik salah satu akun basis data awal di bawah ini untuk mengisi formulir masuk:
                </p>
                {SEEDED_TEST_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => {
                      setIdentifier(acc.username);
                      setPassword(acc.pass);
                      setError(null);
                    }}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-violet-400 hover:bg-violet-50/40 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-violet-700">{acc.role}</span>
                      <span className="font-mono text-slate-600">{acc.username}</span>
                    </div>
                    <div className="text-xs text-slate-700 mt-0.5">
                      {acc.name} · {acc.school}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal open={forgotOpen} onClose={() => setForgotOpen(false)} title="Bantuan Lupa Password">
        <form onSubmit={handleForgotSubmit} className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Masukkan username atau email Anda. Sistem akan mencatat permintaan pemulihan akun ke Audit Log agar Admin Central atau Guru BK sekolah dapat mereset password Anda dengan aman.
          </p>

          {forgotError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
              {forgotError}
            </div>
          )}

          {forgotResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>{forgotResult}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Username atau Email Akun
            </label>
            <input
              type="text"
              value={forgotId}
              onChange={(e) => setForgotId(e.target.value)}
              placeholder="Contoh: siswa.dina atau bk.sari"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Keterangan Tambahan (Opsional)
            </label>
            <input
              type="text"
              value={forgotReason}
              onChange={(e) => setForgotReason(e.target.value)}
              placeholder="Contoh: Lupa password setelah ganti perangkat"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setForgotOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={forgotLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-violet-700 hover:bg-violet-800 rounded-lg disabled:opacity-60"
            >
              {forgotLoading ? 'Mengirim...' : 'Kirim Permintaan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
