import { Router } from 'express';
import { db, genId } from '../db.ts';
import {
  hashPassword,
  verifyPassword,
  signAuthToken,
  loadAuthUserById,
  requireAuth,
  logAudit,
  SESSION_COOKIE_NAME,
  type AuthedRequest,
} from '../auth.ts';

export const authRoutes = Router();

authRoutes.post('/login', (req, res) => {
  const { identifier, password } = req.body as { identifier?: string; password?: string };
  const cleanId = (identifier ?? '').trim();

  if (!cleanId || !password) {
    return res.status(400).json({ error: 'Username/email dan password wajib diisi.' });
  }

  const userRow = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.password_hash, u.full_name, u.role, u.school_id, u.status,
              s.status as school_status
       FROM users u
       LEFT JOIN schools s ON u.school_id = s.id
       WHERE LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?)`
    )
    .get(cleanId, cleanId) as
    | {
        id: string;
        username: string;
        email: string;
        password_hash: string;
        full_name: string;
        role: string;
        school_id: string | null;
        status: string;
        school_status: string | null;
      }
    | undefined;

  if (!userRow || !verifyPassword(password, userRow.password_hash)) {
    logAudit({
      userId: userRow?.id ?? null,
      username: cleanId,
      userRole: userRow?.role ?? 'UNKNOWN',
      schoolId: userRow?.school_id ?? null,
      action: 'LOGIN_FAILED',
      entityType: 'AUTH',
      details: `Percobaan masuk gagal untuk pengidentifikasi "${cleanId}".`,
    });
    return res.status(401).json({ error: 'Username/email atau password tidak sesuai.' });
  }

  if (userRow.status !== 'ACTIVE') {
    return res.status(403).json({
      error:
        userRow.role === 'GURU_BK'
          ? 'Akun Guru BK Anda belum aktif atau masih menunggu persetujuan Admin Central.'
          : 'Akun Anda sedang dinonaktifkan. Hubungi Admin atau Guru BK sekolah.',
    });
  }

  if (userRow.school_id && userRow.school_status !== 'ACTIVE') {
    return res.status(403).json({ error: 'Sekolah Anda sedang berstatus nonaktif dalam sistem.' });
  }

  const authUser = loadAuthUserById(userRow.id);
  if (!authUser) {
    return res.status(500).json({ error: 'Gagal memuat profil pengguna.' });
  }

  const token = signAuthToken(authUser.id, authUser.role);
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  logAudit({
    userId: authUser.id,
    username: authUser.username,
    userRole: authUser.role,
    schoolId: authUser.schoolId,
    action: 'LOGIN',
    entityType: 'AUTH',
    entityId: authUser.id,
    details: `${authUser.fullName} (${authUser.role}) berhasil masuk ke sistem.`,
  });

  res.json({ token, user: authUser });
});

authRoutes.post('/logout', (req: AuthedRequest, res) => {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : null;
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

  // Best-effort audit log if user token is present
  if (bearer || cookieToken) {
    try {
      // Delegate to requireAuth-like decode only if present via header/cookie
      const authHeaderUser = req.body?.username as string | undefined;
      if (authHeaderUser) {
        logAudit({
          userId: req.body?.userId ?? null,
          username: authHeaderUser,
          userRole: req.body?.role ?? 'UNKNOWN',
          schoolId: req.body?.schoolId ?? null,
          action: 'LOGOUT',
          entityType: 'AUTH',
          details: `Pengguna ${authHeaderUser} keluar dari sistem.`,
        });
      }
    } catch {
      // ignore
    }
  }

  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

authRoutes.get('/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.authUser });
});

authRoutes.post('/change-password', requireAuth, (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Password saat ini dan password baru wajib diisi.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password baru minimal terdiri dari 6 karakter.' });
  }

  const userRow = db
    .prepare('SELECT id, password_hash FROM users WHERE id = ?')
    .get(req.authUser!.id) as { id: string; password_hash: string } | undefined;

  if (!userRow || !verifyPassword(currentPassword, userRow.password_hash)) {
    return res.status(400).json({ error: 'Password saat ini tidak sesuai.' });
  }

  const newHash = hashPassword(newPassword);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
    newHash,
    req.authUser!.id
  );

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId: req.authUser!.schoolId,
    action: 'CHANGE_PASSWORD',
    entityType: 'USER',
    entityId: req.authUser!.id,
    details: `${req.authUser!.fullName} memperbarui password akunnya.`,
  });

  res.json({ ok: true, message: 'Password berhasil diperbarui.' });
});

authRoutes.post('/forgot-password', (req, res) => {
  const { identifier, reason } = req.body as { identifier?: string; reason?: string };
  const cleanId = (identifier ?? '').trim();
  if (!cleanId) {
    return res.status(400).json({ error: 'Masukkan username atau email akun Anda.' });
  }

  const userRow = db
    .prepare(
      `SELECT id, username, role, school_id, full_name
       FROM users
       WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)`
    )
    .get(cleanId, cleanId) as
    | { id: string; username: string; role: string; school_id: string | null; full_name: string }
    | undefined;

  logAudit({
    userId: userRow?.id ?? null,
    username: userRow?.username ?? cleanId,
    userRole: userRow?.role ?? 'GUEST',
    schoolId: userRow?.school_id ?? null,
    action: 'PASSWORD_RESET_REQUEST',
    entityType: 'AUTH',
    entityId: userRow?.id ?? null,
    details: userRow
      ? `Permintaan pemulihan password diajukan untuk ${userRow.full_name} (${userRow.role}). Catatan: ${reason || '-'}`
      : `Permintaan pemulihan password untuk pengidentifikasi tidak terdaftar: ${cleanId}.`,
  });

  res.json({
    ok: true,
    message:
      'Permintaan reset password telah dicatat pada Audit Log sistem. Untuk keamanan akun sekolah, silakan hubungi Guru BK (bagi Peserta Didik) atau Admin Central (bagi Guru BK) untuk penerbitan password sementara.',
  });
});

authRoutes.get('/public-schools', (_req, res) => {
  const schools = db
    .prepare(
      `SELECT id, name, level
       FROM schools
       WHERE status = 'ACTIVE'
       ORDER BY name ASC`
    )
    .all() as Array<{ id: string; name: string; level: string }>;

  const classes = db
    .prepare(
      `SELECT c.id, c.school_id as schoolId, c.name, c.grade_level as gradeLevel
       FROM classes c
       JOIN schools s ON c.school_id = s.id
       WHERE s.status = 'ACTIVE'
       ORDER BY c.grade_level ASC, c.name ASC`
    )
    .all() as Array<{ id: string; schoolId: string; name: string; gradeLevel: string }>;

  res.json({ schools, classes });
});

authRoutes.post('/register', (req, res) => {
  const {
    role,
    schoolId,
    classId,
    fullName,
    nisNisn,
    gender,
    nip,
    title,
    email,
    username,
    password,
  } = req.body as Record<string, string>;

  if (role !== 'PESERTA_DIDIK' && role !== 'GURU_BK') {
    return res.status(400).json({ error: 'Pendaftaran hanya tersedia untuk Peserta Didik atau Guru BK.' });
  }

  if (!schoolId?.trim() || !fullName?.trim() || !email?.trim() || !username?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'Sekolah, nama lengkap, email, username, dan password wajib diisi.' });
  }
  if (password.trim().length < 6) {
    return res.status(400).json({ error: 'Password minimal terdiri dari 6 karakter.' });
  }

  const school = db
    .prepare("SELECT id, name, status FROM schools WHERE id = ? AND status = 'ACTIVE'")
    .get(schoolId.trim()) as { id: string; name: string; status: string } | undefined;
  if (!school) {
    return res.status(404).json({ error: 'Sekolah tidak ditemukan atau sedang nonaktif.' });
  }

  const dupUser = db
    .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)')
    .get(username.trim(), email.trim());
  if (dupUser) {
    return res.status(409).json({ error: 'Username atau email sudah terdaftar. Gunakan yang lain.' });
  }

  if (role === 'PESERTA_DIDIK') {
    if (!nisNisn?.trim()) {
      return res.status(400).json({ error: 'NIS / NISN wajib diisi untuk pendaftaran Peserta Didik.' });
    }
    if (classId?.trim()) {
      const cls = db
        .prepare('SELECT id FROM classes WHERE id = ? AND school_id = ?')
        .get(classId.trim(), school.id);
      if (!cls) {
        return res.status(400).json({ error: 'Kelas yang dipilih tidak sesuai dengan sekolah.' });
      }
    }

    const userId = genId('usr');
    const studentId = genId('std');
    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, school_id, status)
       VALUES (?, ?, ?, ?, ?, 'PESERTA_DIDIK', ?, 'ACTIVE')`
    ).run(userId, username.trim(), email.trim(), hashPassword(password.trim()), fullName.trim(), school.id);

    db.prepare(
      `INSERT INTO students (id, user_id, school_id, class_id, nis_nisn, gender)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      studentId,
      userId,
      school.id,
      classId?.trim() || null,
      nisNisn.trim(),
      gender?.trim() === 'Perempuan' ? 'Perempuan' : 'Laki-laki'
    );

    const authUser = loadAuthUserById(userId);
    if (!authUser) {
      return res.status(500).json({ error: 'Gagal memuat akun yang baru dibuat.' });
    }

    const token = signAuthToken(authUser.id, authUser.role);
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    logAudit({
      userId,
      username: authUser.username,
      userRole: 'PESERTA_DIDIK',
      schoolId: school.id,
      action: 'REGISTER_STUDENT',
      entityType: 'STUDENT',
      entityId: studentId,
      details: `Peserta Didik "${fullName.trim()}" (${nisNisn.trim()}) mendaftar di ${school.name}.`,
    });

    return res.status(201).json({
      ok: true,
      requiresApproval: false,
      token,
      user: authUser,
      message: 'Pendaftaran Peserta Didik berhasil! Anda langsung masuk ke dashboard.',
    });
  }

  // GURU_BK registration requires Admin Central activation so Guru BK access stays strictly controlled by Admin
  const userId = genId('usr');
  const bkId = genId('bkt');
  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, full_name, role, school_id, status)
     VALUES (?, ?, ?, ?, ?, 'GURU_BK', ?, 'INACTIVE')`
  ).run(userId, username.trim(), email.trim(), hashPassword(password.trim()), fullName.trim(), school.id);

  db.prepare(
    `INSERT INTO bk_teachers (id, user_id, school_id, nip, title, bio)
     VALUES (?, ?, ?, ?, ?, '')`
  ).run(bkId, userId, school.id, (nip ?? '').trim(), title?.trim() || 'Guru Bimbingan & Konseling');

  logAudit({
    userId,
    username: username.trim(),
    userRole: 'GURU_BK',
    schoolId: school.id,
    action: 'REGISTER_BK_PENDING',
    entityType: 'BK_TEACHER',
    entityId: bkId,
    details: `Pendaftaran Guru BK "${fullName.trim()}" di ${school.name} menunggu aktivasi Admin Central.`,
  });

  return res.status(201).json({
    ok: true,
    requiresApproval: true,
    message:
      'Pendaftaran akun Guru BK berhasil dikirim! Untuk menjaga keamanan, akun Guru BK berstatus Menunggu Persetujuan dan harus diaktifkan terlebih dahulu oleh Admin Central sebelum bisa digunakan untuk masuk.',
  });
});
