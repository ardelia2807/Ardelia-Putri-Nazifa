import React, { useEffect, useState } from 'react';
import { apiFetch, setStoredToken } from './lib/api.ts';
import type { AuthUser, UserRole } from './shared/types.ts';
import { LoginPage } from './pages/LoginPage.tsx';
import { AdminDashboard } from './pages/admin/AdminDashboard.tsx';
import { BkDashboard } from './pages/bk/BkDashboard.tsx';
import { StudentDashboard } from './pages/student/StudentDashboard.tsx';

const ROLE_DEFAULT_TAB: Record<UserRole, string> = {
  ADMIN_CENTRAL: 'ringkasan',
  GURU_BK: 'ringkasan',
  PESERTA_DIDIK: 'beranda',
};

const ROLE_HASH_PREFIX: Record<UserRole, string> = {
  ADMIN_CENTRAL: 'admin',
  GURU_BK: 'bk',
  PESERTA_DIDIK: 'siswa',
};

const VALID_TABS: Record<UserRole, string[]> = {
  ADMIN_CENTRAL: ['ringkasan', 'sekolah', 'pengguna', 'data-siswa', 'audit-log', 'laporan', 'panduan'],
  GURU_BK: ['ringkasan', 'peserta-didik', 'cek-diri', 'konsultasi', 'catatan-refleksi', 'laporan', 'profil'],
  PESERTA_DIDIK: ['beranda', 'cek-diri', 'catatan', 'target', 'jurnal', 'edukasi', 'konsultasi', 'misi-digital', 'profil'],
};

function parseHash(): { prefix: string; tab: string } {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [prefix = '', tab = ''] = raw.split('/');
  return { prefix, tab };
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('ringkasan');
  const [accessNotice, setAccessNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{ user: AuthUser }>('/api/auth/me')
      .then((res) => {
        if (!active) return;
        setUser(res.user);
        const expectedPrefix = ROLE_HASH_PREFIX[res.user.role];
        const { prefix, tab } = parseHash();
        if (prefix === expectedPrefix && VALID_TABS[res.user.role].includes(tab)) {
          setActiveTab(tab);
        } else {
          const def = ROLE_DEFAULT_TAB[res.user.role];
          setActiveTab(def);
          window.location.hash = `#/${expectedPrefix}/${def}`;
        }
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Strict RBAC URL Hash Guard: block switching to another role's dashboard via URL bar
  useEffect(() => {
    if (!user) return;
    const onHashChange = () => {
      const expectedPrefix = ROLE_HASH_PREFIX[user.role];
      const { prefix, tab } = parseHash();
      if (!prefix) return;

      if (prefix !== expectedPrefix) {
        setAccessNotice(
          'Akses dibatasi: Anda tidak dapat membuka dashboard role lain melalui URL. Anda telah dikembalikan ke dashboard akun Anda.'
        );
        const def = ROLE_DEFAULT_TAB[user.role];
        setActiveTab(def);
        window.location.hash = `#/${expectedPrefix}/${def}`;
        return;
      }

      if (VALID_TABS[user.role].includes(tab)) {
        setActiveTab(tab);
      } else {
        const def = ROLE_DEFAULT_TAB[user.role];
        setActiveTab(def);
        window.location.hash = `#/${expectedPrefix}/${def}`;
      }
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [user]);

  function handleLoginSuccess(loggedInUser: AuthUser) {
    setUser(loggedInUser);
    setAccessNotice(null);
    const prefix = ROLE_HASH_PREFIX[loggedInUser.role];
    const def = ROLE_DEFAULT_TAB[loggedInUser.role];
    setActiveTab(def);
    window.location.hash = `#/${prefix}/${def}`;
  }

  function handleSelectTab(tab: string) {
    if (!user) return;
    const prefix = ROLE_HASH_PREFIX[user.role];
    if (!VALID_TABS[user.role].includes(tab)) return;
    setActiveTab(tab);
    window.location.hash = `#/${prefix}/${tab}`;
  }

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify(
          user
            ? {
                userId: user.id,
                username: user.username,
                role: user.role,
                schoolId: user.schoolId,
              }
            : {}
        ),
      });
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
    setAccessNotice(null);
    window.location.hash = '#/login';
  }

  if (booting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-600">Memuat DIGITAL BALANCE...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (user.role === 'ADMIN_CENTRAL') {
    return (
      <AdminDashboard
        user={user}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onLogout={handleLogout}
        onUserUpdated={setUser}
        accessNotice={accessNotice}
        onDismissNotice={() => setAccessNotice(null)}
      />
    );
  }

  if (user.role === 'GURU_BK') {
    return (
      <BkDashboard
        user={user}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onLogout={handleLogout}
        accessNotice={accessNotice}
        onDismissNotice={() => setAccessNotice(null)}
      />
    );
  }

  return (
    <StudentDashboard
      user={user}
      activeTab={activeTab}
      onSelectTab={handleSelectTab}
      onLogout={handleLogout}
      accessNotice={accessNotice}
      onDismissNotice={() => setAccessNotice(null)}
    />
  );
}
