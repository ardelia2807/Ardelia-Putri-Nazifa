import React, { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { apiFetch, setStoredToken } from '../lib/api.ts';
import type { AuthUser } from '../shared/types.ts';
import { Modal } from '../components/UiPrimitives.tsx';

interface PublicSchoolOption {
  id: string;
  name: string;
  level: string;
}

interface PublicClassOption {
  id: string;
  schoolId: string;
  name: string;
  gradeLevel: string;
}

export function LoginPage({ onLoginSuccess }: { onLoginSuccess: (user: AuthUser) => void }) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Register State
  const [registerRole, setRegisterRole] = useState<'PESERTA_DIDIK' | 'GURU_BK'>('PESERTA_DIDIK');
  const [schools, setSchools] = useState<PublicSchoolOption[]>([]);
  const [classes, setClasses] = useState<PublicClassOption[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [regForm, setRegForm] = useState({
    schoolId: '',
    classId: '',
    fullName: '',
    nisNisn: '',
    gender: 'Laki-laki',
    nip: '',
    title: 'Guru Bimbingan & Konseling',
    email: '',
    username: '',
    password: '',
  });
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regNotice, setRegNotice] = useState<string | null>(null);

  // Forgot Password State
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotId, setForgotId] = useState('');
  const [forgotReason, setForgotReason] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotResult, setForgotResult] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  useEffect(() => {
    if (authMode !== 'register' || schools.length > 0) return;
    setSchoolsLoading(true);
    apiFetch<{ schools: PublicSchoolOption[]; classes: PublicClassOption[] }>('/api/auth/public-schools')
      .then((res) => {
        setSchools(res.schools);
        setClasses(res.classes);
        if (res.schools.length > 0) {
          setRegForm((prev) => ({
            ...prev,
            schoolId: prev.schoolId || res.schools[0].id,
          }));
        }
      })
      .catch((err) => {
        setRegError(err instanceof Error ? err.message : 'Gagal memuat daftar sekolah.');
      })
      .finally(() => setSchoolsLoading(false));
  }, [authMode, schools.length]);

  const schoolClasses = useMemo(
    () => classes.filter((c) => c.schoolId === regForm.schoolId),
    [classes, regForm.schoolId]
  );

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

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegError(null);
    setRegNotice(null);

    if (!regForm.schoolId || !regForm.fullName.trim() || !regForm.email.trim() || !regForm.username.trim() || !regForm.password) {
      setRegError('Mohon lengkapi sekolah, nama lengkap, email, username, dan password.');
      return;
    }
    if (registerRole === 'PESERTA_DIDIK' && !regForm.nisNisn.trim()) {
      setRegError('NIS / NISN wajib diisi untuk pendaftaran Peserta Didik.');
      return;
    }
    if (regForm.password.length < 6) {
      setRegError('Password minimal terdiri dari 6 karakter.');
      return;
    }

    setRegLoading(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        requiresApproval: boolean;
        token?: string;
        user?: AuthUser;
        message: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          role: registerRole,
          ...regForm,
        }),
      });

      if (!res.requiresApproval && res.token && res.user) {
        setStoredToken(res.token);
        onLoginSuccess(res.user);
        return;
      }

      setRegNotice(res.message);
      setRegForm((prev) => ({
        ...prev,
        fullName: '',
        nisNisn: '',
        nip: '',
        email: '',
        username: '',
        password: '',
      }));
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Gagal memproses pendaftaran.');
    } finally {
      setRegLoading(false);
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

      {/* Right Login / Register Column */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-md space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg gap-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                  authMode === 'login' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Masuk</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setRegError(null);
                  setRegNotice(null);
                }}
                className={`py-2 px-3 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                  authMode === 'register' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Daftar Akun</span>
              </button>
            </div>

            {authMode === 'login' ? (
              <>
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
                      placeholder="Masukkan username atau email"
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

                <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed flex flex-col gap-1.5">
                  <span>
                    Belum punya akun?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      className="text-violet-700 font-semibold hover:underline"
                    >
                      Daftar sebagai Peserta Didik atau Guru BK
                    </button>
                  </span>
                  <span>
                    Kredensial Admin Central bersifat privat. Pendaftaran Guru BK memerlukan aktivasi oleh Admin Central.
                  </span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 font-display">Daftar Akun Baru</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Pilih peran pendaftaran untuk Peserta Didik atau Guru BK sesuai sekolah Anda.
                  </p>
                </div>

                {/* Role Selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRegisterRole('PESERTA_DIDIK');
                      setRegError(null);
                      setRegNotice(null);
                    }}
                    className={`px-3 py-2.5 rounded-lg border text-xs font-semibold text-center transition-colors ${
                      registerRole === 'PESERTA_DIDIK'
                        ? 'border-violet-700 bg-violet-50 text-violet-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Peserta Didik
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRegisterRole('GURU_BK');
                      setRegError(null);
                      setRegNotice(null);
                    }}
                    className={`px-3 py-2.5 rounded-lg border text-xs font-semibold text-center transition-colors ${
                      registerRole === 'GURU_BK'
                        ? 'border-violet-700 bg-violet-50 text-violet-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Guru BK
                  </button>
                </div>

                {registerRole === 'GURU_BK' && (
                  <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-900 leading-relaxed">
                    Untuk menjaga otoritas akses sekolah, akun Guru BK yang mendaftar akan berstatus{' '}
                    <span className="font-semibold">Menunggu Persetujuan</span> hingga diaktifkan oleh Admin Central.
                  </div>
                )}

                {regError && (
                  <div
                    role="alert"
                    className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                    <span>{regError}</span>
                  </div>
                )}

                {regNotice && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>{regNotice}</span>
                  </div>
                )}

                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Sekolah</label>
                    <select
                      required
                      disabled={schoolsLoading}
                      value={regForm.schoolId}
                      onChange={(e) => setRegForm({ ...regForm, schoolId: e.target.value, classId: '' })}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white"
                    >
                      <option value="">{schoolsLoading ? 'Memuat sekolah...' : '-- Pilih Sekolah --'}</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.level})
                        </option>
                      ))}
                    </select>
                  </div>

                  {registerRole === 'PESERTA_DIDIK' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Kelas</label>
                        <select
                          value={regForm.classId}
                          onChange={(e) => setRegForm({ ...regForm, classId: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white"
                        >
                          <option value="">-- Pilih Kelas --</option>
                          {schoolClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">NIS / NISN</label>
                        <input
                          required
                          type="text"
                          value={regForm.nisNisn}
                          onChange={(e) => setRegForm({ ...regForm, nisNisn: e.target.value })}
                          placeholder="Nomor induk siswa"
                          className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">NIP (Opsional)</label>
                        <input
                          type="text"
                          value={regForm.nip}
                          onChange={(e) => setRegForm({ ...regForm, nip: e.target.value })}
                          placeholder="Nomor Induk Pegawai"
                          className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Jabatan</label>
                        <input
                          type="text"
                          value={regForm.title}
                          onChange={(e) => setRegForm({ ...regForm, title: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap</label>
                      <input
                        required
                        type="text"
                        value={regForm.fullName}
                        onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                        placeholder="Nama lengkap sesuai data"
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white"
                      />
                    </div>
                    {registerRole === 'PESERTA_DIDIK' ? (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Jenis Kelamin</label>
                        <select
                          value={regForm.gender}
                          onChange={(e) => setRegForm({ ...regForm, gender: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white"
                        >
                          <option value="Laki-laki">Laki-laki</option>
                          <option value="Perempuan">Perempuan</option>
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                        <input
                          required
                          type="email"
                          value={regForm.email}
                          onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                          placeholder="email@sekolah.sch.id"
                          className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white"
                        />
                      </div>
                    )}
                  </div>

                  {registerRole === 'PESERTA_DIDIK' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                      <input
                        required
                        type="email"
                        value={regForm.email}
                        onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                        placeholder="email@sekolah.sch.id"
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Username</label>
                      <input
                        required
                        type="text"
                        value={regForm.username}
                        onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                        placeholder="Buat username unik"
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Password (min. 6)</label>
                      <div className="relative">
                        <input
                          required
                          type={showRegPassword ? 'text' : 'password'}
                          minLength={6}
                          value={regForm.password}
                          onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                          placeholder="Buat password"
                          className="w-full pl-3 pr-9 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword((p) => !p)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800"
                          aria-label={showRegPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        >
                          {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={regLoading || schools.length === 0}
                    className="w-full py-2.5 px-4 bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                  >
                    {regLoading
                      ? 'Memproses pendaftaran...'
                      : registerRole === 'PESERTA_DIDIK'
                      ? 'Daftar sebagai Peserta Didik'
                      : 'Ajukan Pendaftaran Guru BK'}
                  </button>
                </form>

                <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                  Sudah punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className="text-violet-700 font-semibold hover:underline"
                  >
                    Masuk di sini
                  </button>
                </div>
              </>
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
              placeholder="Masukkan username atau email akun"
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
