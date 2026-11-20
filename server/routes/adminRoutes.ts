import { Router } from 'express';
import { db, genId } from '../db.ts';
import {
  hashPassword,
  verifyPassword,
  loadAuthUserById,
  requireAuth,
  requireRole,
  logAudit,
  type AuthedRequest,
} from '../auth.ts';

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireRole('ADMIN_CENTRAL'));

adminRoutes.put('/account', (req: AuthedRequest, res) => {
  const { fullName, username, email, currentPassword, newPassword } = req.body as {
    fullName?: string;
    username?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  if (!fullName?.trim() || !username?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'Nama lengkap, username, dan email wajib diisi.' });
  }
  if (!currentPassword) {
    return res.status(400).json({ error: 'Masukkan password saat ini untuk mengonfirmasi perubahan akun Admin.' });
  }
  if (newPassword && newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'Password baru minimal terdiri dari 6 karakter.' });
  }

  const adminRow = db
    .prepare('SELECT id, password_hash FROM users WHERE id = ?')
    .get(req.authUser!.id) as { id: string; password_hash: string } | undefined;

  if (!adminRow || !verifyPassword(currentPassword, adminRow.password_hash)) {
    return res.status(400).json({ error: 'Password saat ini tidak sesuai.' });
  }

  const dup = db
    .prepare('SELECT id FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND id != ?')
    .get(username.trim(), email.trim(), req.authUser!.id);
  if (dup) {
    return res.status(409).json({ error: 'Username atau email sudah digunakan oleh akun lain.' });
  }

  if (newPassword?.trim()) {
    db.prepare(
      `UPDATE users SET full_name = ?, username = ?, email = ?, password_hash = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(fullName.trim(), username.trim(), email.trim(), hashPassword(newPassword.trim()), req.authUser!.id);
  } else {
    db.prepare(
      `UPDATE users SET full_name = ?, username = ?, email = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(fullName.trim(), username.trim(), email.trim(), req.authUser!.id);
  }

  const updatedUser = loadAuthUserById(req.authUser!.id);
  logAudit({
    userId: req.authUser!.id,
    username: username.trim(),
    userRole: 'ADMIN_CENTRAL',
    action: 'UPDATE_ADMIN_ACCOUNT',
    entityType: 'USER',
    entityId: req.authUser!.id,
    details: `Admin Central memperbarui kredensial akun (${username.trim()}).`,
  });

  res.json({ ok: true, user: updatedUser });
});

adminRoutes.get('/overview', (_req, res) => {
  const totalSchools = (db.prepare('SELECT COUNT(*) as c FROM schools').get() as { c: number }).c;
  const activeSchools = (db.prepare("SELECT COUNT(*) as c FROM schools WHERE status = 'ACTIVE'").get() as { c: number }).c;
  const totalBkTeachers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'GURU_BK'").get() as { c: number }).c;
  const totalStudents = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'PESERTA_DIDIK'").get() as { c: number }).c;
  const activeAccounts = (db.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'ACTIVE'").get() as { c: number }).c;
  const totalConsultations = (db.prepare('SELECT COUNT(*) as c FROM consultation_requests').get() as { c: number }).c;
  const totalAssessments = (db.prepare('SELECT COUNT(*) as c FROM self_assessments').get() as { c: number }).c;
  const totalUsageRecords = (db.prepare('SELECT COUNT(*) as c FROM usage_records').get() as { c: number }).c;
  const totalTargets = (db.prepare('SELECT COUNT(*) as c FROM targets').get() as { c: number }).c;
  const totalJournals = (db.prepare('SELECT COUNT(*) as c FROM reflection_journals').get() as { c: number }).c;

  const schoolDistribution = db
    .prepare(
      `SELECT s.id, s.name, s.level, s.status,
              (SELECT COUNT(*) FROM bk_teachers bt WHERE bt.school_id = s.id) as bkCount,
              (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id) as studentCount,
              (SELECT COUNT(*) FROM self_assessments sa WHERE sa.school_id = s.id) as assessmentCount,
              (SELECT COUNT(*) FROM consultation_requests cr WHERE cr.school_id = s.id) as consultationCount
       FROM schools s
       ORDER BY studentCount DESC, s.name ASC`
    )
    .all();

  const recentAuditLogs = db
    .prepare(
      `SELECT id, username, user_role as userRole, action, entity_type as entityType, details, created_at as createdAt
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT 8`
    )
    .all();

  const activityTrend = db
    .prepare(
      `SELECT substr(created_at, 1, 10) as day, COUNT(*) as count
       FROM audit_logs
       GROUP BY substr(created_at, 1, 10)
       ORDER BY day DESC
       LIMIT 7`
    )
    .all()
    .reverse();

  res.json({
    stats: {
      totalSchools,
      activeSchools,
      totalBkTeachers,
      totalStudents,
      activeAccounts,
      totalConsultations,
      totalAssessments,
      totalUsageRecords,
      totalTargets,
      totalJournals,
    },
    featureUsage: [
      { label: 'Cek Diri', count: totalAssessments },
      { label: 'Catatan Penggunaan', count: totalUsageRecords },
      { label: 'Target Saya', count: totalTargets },
      { label: 'Jurnal Refleksi', count: totalJournals },
      { label: 'Konsultasi BK', count: totalConsultations },
    ],
    schoolDistribution,
    activityTrend,
    recentAuditLogs,
  });
});

// --- SCHOOLS ---
adminRoutes.get('/schools', (req, res) => {
  const q = ((req.query.q as string) ?? '').trim();
  const like = `%${q}%`;
  const rows = db
    .prepare(
      `SELECT s.id, s.name, s.npsn, s.level, s.address, s.email, s.phone, s.status,
              s.created_at as createdAt, s.updated_at as updatedAt,
              (SELECT COUNT(*) FROM bk_teachers bt WHERE bt.school_id = s.id) as bkCount,
              (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id) as studentCount,
              (SELECT COUNT(*) FROM self_assessments sa WHERE sa.school_id = s.id) as assessmentCount,
              (SELECT COUNT(*) FROM consultation_requests cr WHERE cr.school_id = s.id) as consultationCount
       FROM schools s
       WHERE (? = '' OR s.name LIKE ? OR s.npsn LIKE ?)
       ORDER BY s.created_at DESC`
    )
    .all(q, like, like);
  res.json({ schools: rows });
});

adminRoutes.post('/schools', (req: AuthedRequest, res) => {
  const { name, npsn, level, address, email, phone, status } = req.body as Record<string, string>;
  if (!name?.trim() || !npsn?.trim() || !level?.trim() || !address?.trim() || !email?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Semua data identitas sekolah wajib diisi.' });
  }

  const existing = db.prepare('SELECT id FROM schools WHERE npsn = ?').get(npsn.trim());
  if (existing) {
    return res.status(409).json({ error: `NPSN ${npsn.trim()} sudah terdaftar pada sekolah lain.` });
  }

  const schoolId = genId('sch');
  const finalStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  db.prepare(
    `INSERT INTO schools (id, name, npsn, level, address, email, phone, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(schoolId, name.trim(), npsn.trim(), level.trim(), address.trim(), email.trim(), phone.trim(), finalStatus);

  // Create default starter classes based on jenjang so BK/Admin can assign students immediately
  const defaultClasses =
    level.trim().toUpperCase() === 'SMP'
      ? [
          { name: 'VII-A', grade: '7' },
          { name: 'VIII-A', grade: '8' },
          { name: 'IX-A', grade: '9' },
        ]
      : [
          { name: 'X-1', grade: '10' },
          { name: 'XI-1', grade: '11' },
          { name: 'XII-1', grade: '12' },
        ];
  const insertCls = db.prepare(`INSERT INTO classes (id, school_id, name, grade_level) VALUES (?, ?, ?, ?)`);
  for (const c of defaultClasses) {
    insertCls.run(genId('cls'), schoolId, c.name, c.grade);
  }

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId,
    action: 'CREATE_SCHOOL',
    entityType: 'SCHOOL',
    entityId: schoolId,
    details: `Menambahkan sekolah baru "${name.trim()}" (NPSN: ${npsn.trim()}).`,
  });

  res.status(201).json({ id: schoolId });
});

adminRoutes.get('/schools/:id', (req, res) => {
  const school = db
    .prepare(
      `SELECT id, name, npsn, level, address, email, phone, status,
              created_at as createdAt, updated_at as updatedAt
       FROM schools WHERE id = ?`
    )
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!school) {
    return res.status(404).json({ error: 'Sekolah tidak ditemukan.' });
  }

  const classes = db
    .prepare(
      `SELECT c.id, c.school_id as schoolId, c.name, c.grade_level as gradeLevel, c.academic_year as academicYear,
              (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id) as studentCount
       FROM classes c WHERE c.school_id = ? ORDER BY c.grade_level, c.name`
    )
    .all(req.params.id);

  const bkTeachers = db
    .prepare(
      `SELECT bt.id, bt.user_id as userId, bt.school_id as schoolId, u.full_name as fullName,
              u.username, u.email, bt.nip, bt.title, bt.bio, u.status, bt.created_at as createdAt
       FROM bk_teachers bt
       JOIN users u ON bt.user_id = u.id
       WHERE bt.school_id = ?
       ORDER BY u.full_name ASC`
    )
    .all(req.params.id);

  // Basic student identity only — NO private journals or consultation content
  const students = db
    .prepare(
      `SELECT st.id, st.user_id as userId, st.school_id as schoolId, st.class_id as classId,
              c.name as className, u.full_name as fullName, u.username, u.email,
              st.nis_nisn as nisNisn, st.gender, u.status, st.created_at as createdAt
       FROM students st
       JOIN users u ON st.user_id = u.id
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE st.school_id = ?
       ORDER BY u.full_name ASC`
    )
    .all(req.params.id);

  const stats = {
    bkCount: bkTeachers.length,
    studentCount: students.length,
    assessmentCount: (db.prepare('SELECT COUNT(*) as c FROM self_assessments WHERE school_id = ?').get(req.params.id) as { c: number }).c,
    usageRecordCount: (db.prepare('SELECT COUNT(*) as c FROM usage_records WHERE school_id = ?').get(req.params.id) as { c: number }).c,
    targetCount: (db.prepare('SELECT COUNT(*) as c FROM targets WHERE school_id = ?').get(req.params.id) as { c: number }).c,
    consultationTotal: (db.prepare('SELECT COUNT(*) as c FROM consultation_requests WHERE school_id = ?').get(req.params.id) as { c: number }).c,
    consultationDone: (db.prepare("SELECT COUNT(*) as c FROM consultation_requests WHERE school_id = ? AND status = 'SELESAI'").get(req.params.id) as { c: number }).c,
  };

  res.json({ school, classes, bkTeachers, students, stats });
});

adminRoutes.put('/schools/:id', (req: AuthedRequest, res) => {
  const { name, npsn, level, address, email, phone, status } = req.body as Record<string, string>;
  const existing = db.prepare('SELECT id, name FROM schools WHERE id = ?').get(req.params.id) as { id: string; name: string } | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Sekolah tidak ditemukan.' });
  }
  if (!name?.trim() || !npsn?.trim() || !level?.trim() || !address?.trim() || !email?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Semua kolom data sekolah wajib diisi.' });
  }

  const dup = db.prepare('SELECT id FROM schools WHERE npsn = ? AND id != ?').get(npsn.trim(), req.params.id);
  if (dup) {
    return res.status(409).json({ error: `NPSN ${npsn.trim()} sudah digunakan sekolah lain.` });
  }

  const finalStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  db.prepare(
    `UPDATE schools
     SET name = ?, npsn = ?, level = ?, address = ?, email = ?, phone = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(name.trim(), npsn.trim(), level.trim(), address.trim(), email.trim(), phone.trim(), finalStatus, req.params.id);

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId: req.params.id,
    action: 'UPDATE_SCHOOL',
    entityType: 'SCHOOL',
    entityId: req.params.id,
    details: `Memperbarui data sekolah "${name.trim()}".`,
  });

  res.json({ ok: true });
});

adminRoutes.patch('/schools/:id/status', (req: AuthedRequest, res) => {
  const { status } = req.body as { status?: string };
  const finalStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  const school = db.prepare('SELECT id, name FROM schools WHERE id = ?').get(req.params.id) as { id: string; name: string } | undefined;
  if (!school) return res.status(404).json({ error: 'Sekolah tidak ditemukan.' });

  db.prepare("UPDATE schools SET status = ?, updated_at = datetime('now') WHERE id = ?").run(finalStatus, req.params.id);

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId: req.params.id,
    action: 'TOGGLE_SCHOOL_STATUS',
    entityType: 'SCHOOL',
    entityId: req.params.id,
    details: `Mengubah status sekolah "${school.name}" menjadi ${finalStatus}.`,
  });

  res.json({ ok: true, status: finalStatus });
});

adminRoutes.delete('/schools/:id', (req: AuthedRequest, res) => {
  const school = db.prepare('SELECT id, name, npsn FROM schools WHERE id = ?').get(req.params.id) as
    | { id: string; name: string; npsn: string }
    | undefined;
  if (!school) return res.status(404).json({ error: 'Sekolah tidak ditemukan.' });

  db.prepare('DELETE FROM schools WHERE id = ?').run(req.params.id);

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    action: 'DELETE_SCHOOL',
    entityType: 'SCHOOL',
    entityId: req.params.id,
    details: `Menghapus sekolah "${school.name}" (NPSN: ${school.npsn}).`,
  });

  res.json({ ok: true });
});

adminRoutes.post('/schools/:id/classes', (req: AuthedRequest, res) => {
  const { name, gradeLevel, academicYear } = req.body as Record<string, string>;
  if (!name?.trim() || !gradeLevel?.trim()) {
    return res.status(400).json({ error: 'Nama kelas dan tingkat wajib diisi.' });
  }
  const school = db.prepare('SELECT id FROM schools WHERE id = ?').get(req.params.id);
  if (!school) return res.status(404).json({ error: 'Sekolah tidak ditemukan.' });

  const dup = db.prepare('SELECT id FROM classes WHERE school_id = ? AND LOWER(name) = LOWER(?)').get(req.params.id, name.trim());
  if (dup) return res.status(409).json({ error: 'Nama kelas sudah ada di sekolah ini.' });

  const id = genId('cls');
  db.prepare('INSERT INTO classes (id, school_id, name, grade_level, academic_year) VALUES (?, ?, ?, ?, ?)').run(
    id,
    req.params.id,
    name.trim(),
    gradeLevel.trim(),
    academicYear?.trim() || '2026/2027'
  );

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId: req.params.id,
    action: 'CREATE_CLASS',
    entityType: 'CLASS',
    entityId: id,
    details: `Menambahkan kelas "${name.trim()}" pada sekolah ID ${req.params.id}.`,
  });

  res.status(201).json({ id });
});

adminRoutes.delete('/classes/:id', (req: AuthedRequest, res) => {
  const cls = db.prepare('SELECT id, name, school_id FROM classes WHERE id = ?').get(req.params.id) as
    | { id: string; name: string; school_id: string }
    | undefined;
  if (!cls) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });
  db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id);
  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId: cls.school_id,
    action: 'DELETE_CLASS',
    entityType: 'CLASS',
    entityId: cls.id,
    details: `Menghapus kelas "${cls.name}".`,
  });
  res.json({ ok: true });
});

// --- BK TEACHERS ---
adminRoutes.get('/bk-teachers', (req, res) => {
  const schoolId = ((req.query.schoolId as string) ?? '').trim();
  const q = ((req.query.q as string) ?? '').trim();
  const like = `%${q}%`;

  const rows = db
    .prepare(
      `SELECT bt.id, bt.user_id as userId, bt.school_id as schoolId, s.name as schoolName,
              u.full_name as fullName, u.username, u.email, bt.nip, bt.title, bt.bio,
              u.status, bt.created_at as createdAt
       FROM bk_teachers bt
       JOIN users u ON bt.user_id = u.id
       JOIN schools s ON bt.school_id = s.id
       WHERE (? = '' OR bt.school_id = ?)
         AND (? = '' OR u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR bt.nip LIKE ?)
       ORDER BY s.name ASC, u.full_name ASC`
    )
    .all(schoolId, schoolId, q, like, like, like, like);

  res.json({ bkTeachers: rows });
});

adminRoutes.post('/bk-teachers', (req: AuthedRequest, res) => {
  const { fullName, nip, email, username, password, schoolId, title, bio, status } = req.body as Record<string, string>;

  if (!fullName?.trim() || !email?.trim() || !username?.trim() || !password?.trim() || !schoolId?.trim()) {
    return res.status(400).json({ error: 'Nama lengkap, email, username, password awal, dan sekolah wajib diisi.' });
  }
  if (password.trim().length < 6) {
    return res.status(400).json({ error: 'Password awal minimal 6 karakter.' });
  }

  const school = db.prepare('SELECT id, name FROM schools WHERE id = ?').get(schoolId.trim()) as
    | { id: string; name: string }
    | undefined;
  if (!school) {
    return res.status(404).json({ error: 'Sekolah tempat bertugas tidak ditemukan.' });
  }

  const dupUser = db
    .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)')
    .get(username.trim(), email.trim());
  if (dupUser) {
    return res.status(409).json({ error: 'Username atau email sudah digunakan pengguna lain.' });
  }

  const userId = genId('usr');
  const bkId = genId('bkt');
  const finalStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, full_name, role, school_id, status)
     VALUES (?, ?, ?, ?, ?, 'GURU_BK', ?, ?)`
  ).run(userId, username.trim(), email.trim(), hashPassword(password.trim()), fullName.trim(), school.id, finalStatus);

  db.prepare(
    `INSERT INTO bk_teachers (id, user_id, school_id, nip, title, bio)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(bkId, userId, school.id, (nip ?? '').trim(), title?.trim() || 'Guru Bimbingan & Konseling', (bio ?? '').trim());

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId: school.id,
    action: 'CREATE_BK_TEACHER',
    entityType: 'BK_TEACHER',
    entityId: bkId,
    details: `Menambahkan Guru BK "${fullName.trim()}" (${username.trim()}) ke ${school.name}.`,
  });

  res.status(201).json({ id: bkId, userId });
});

adminRoutes.put('/bk-teachers/:id', (req: AuthedRequest, res) => {
  const { fullName, nip, email, username, schoolId, title, bio, status } = req.body as Record<string, string>;
  const existing = db
    .prepare('SELECT id, user_id, school_id FROM bk_teachers WHERE id = ?')
    .get(req.params.id) as { id: string; user_id: string; school_id: string } | undefined;

  if (!existing) return res.status(404).json({ error: 'Guru BK tidak ditemukan.' });
  if (!fullName?.trim() || !email?.trim() || !username?.trim() || !schoolId?.trim()) {
    return res.status(400).json({ error: 'Nama lengkap, email, username, dan sekolah wajib diisi.' });
  }

  const dupUser = db
    .prepare('SELECT id FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND id != ?')
    .get(username.trim(), email.trim(), existing.user_id);
  if (dupUser) {
    return res.status(409).json({ error: 'Username atau email sudah digunakan akun lain.' });
  }

  const finalStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  db.prepare(
    `UPDATE users SET full_name = ?, email = ?, username = ?, school_id = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(fullName.trim(), email.trim(), username.trim(), schoolId.trim(), finalStatus, existing.user_id);

  db.prepare(`UPDATE bk_teachers SET school_id = ?, nip = ?, title = ?, bio = ? WHERE id = ?`).run(
    schoolId.trim(),
    (nip ?? '').trim(),
    title?.trim() || 'Guru Bimbingan & Konseling',
    (bio ?? '').trim(),
    existing.id
  );

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId: schoolId.trim(),
    action: 'UPDATE_BK_TEACHER',
    entityType: 'BK_TEACHER',
    entityId: existing.id,
    details: `Memperbarui data Guru BK "${fullName.trim()}".`,
  });

  res.json({ ok: true });
});

adminRoutes.delete('/bk-teachers/:id', (req: AuthedRequest, res) => {
  const existing = db
    .prepare(
      `SELECT bt.id, bt.user_id, bt.school_id, u.full_name
       FROM bk_teachers bt JOIN users u ON bt.user_id = u.id WHERE bt.id = ?`
    )
    .get(req.params.id) as { id: string; user_id: string; school_id: string; full_name: string } | undefined;

  if (!existing) return res.status(404).json({ error: 'Guru BK tidak ditemukan.' });

  db.prepare('DELETE FROM users WHERE id = ?').run(existing.user_id);

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId: existing.school_id,
    action: 'DELETE_BK_TEACHER',
    entityType: 'BK_TEACHER',
    entityId: existing.id,
    details: `Menghapus akun Guru BK "${existing.full_name}".`,
  });

  res.json({ ok: true });
});

// --- ALL USERS & STUDENTS ---
adminRoutes.get('/users', (req, res) => {
  const role = ((req.query.role as string) ?? '').trim();
  const schoolId = ((req.query.schoolId as string) ?? '').trim();
  const q = ((req.query.q as string) ?? '').trim();
  const like = `%${q}%`;

  const rows = db
    .prepare(
      `SELECT u.id, u.full_name as fullName, u.username, u.email, u.role, u.school_id as schoolId,
              COALESCE(s.name, 'Pusat Sistem') as schoolName,
              u.status, u.created_at as createdAt,
              bt.id as bkTeacherId, st.id as studentId
       FROM users u
       LEFT JOIN schools s ON u.school_id = s.id
       LEFT JOIN bk_teachers bt ON bt.user_id = u.id
       LEFT JOIN students st ON st.user_id = u.id
       WHERE (? = '' OR u.role = ?)
         AND (? = '' OR u.school_id = ?)
         AND (? = '' OR u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)
       ORDER BY u.created_at DESC`
    )
    .all(role, role, schoolId, schoolId, q, like, like, like);

  res.json({ users: rows });
});

adminRoutes.patch('/users/:id/status', (req: AuthedRequest, res) => {
  const { status } = req.body as { status?: string };
  if (req.params.id === req.authUser!.id) {
    return res.status(400).json({ error: 'Anda tidak dapat menonaktifkan akun Anda sendiri.' });
  }
  const user = db.prepare('SELECT id, username, role, school_id FROM users WHERE id = ?').get(req.params.id) as
    | { id: string; username: string; role: string; school_id: string | null }
    | undefined;
  if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

  const finalStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?").run(finalStatus, user.id);

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId: user.school_id,
    action: 'TOGGLE_USER_STATUS',
    entityType: 'USER',
    entityId: user.id,
    details: `Mengubah status akun "${user.username}" (${user.role}) menjadi ${finalStatus}.`,
  });

  res.json({ ok: true, status: finalStatus });
});

adminRoutes.post('/users/:id/reset-password', (req: AuthedRequest, res) => {
  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
  }
  const user = db.prepare('SELECT id, username, role, school_id FROM users WHERE id = ?').get(req.params.id) as
    | { id: string; username: string; role: string; school_id: string | null }
    | undefined;
  if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
    hashPassword(newPassword.trim()),
    user.id
  );

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId: user.school_id,
    action: 'RESET_PASSWORD',
    entityType: 'USER',
    entityId: user.id,
    details: `Mereset password akun "${user.username}" (${user.role}).`,
  });

  res.json({ ok: true });
});

adminRoutes.get('/students', (req, res) => {
  const schoolId = ((req.query.schoolId as string) ?? '').trim();
  const className = ((req.query.className as string) ?? '').trim();
  const q = ((req.query.q as string) ?? '').trim();
  const like = `%${q}%`;

  // Strictly identity & account status only — NO private reflection journals or consultation content
  const rows = db
    .prepare(
      `SELECT st.id, st.user_id as userId, st.school_id as schoolId, s.name as schoolName,
              st.class_id as classId, COALESCE(c.name, '-') as className,
              u.full_name as fullName, u.username, u.email, st.nis_nisn as nisNisn, st.gender,
              u.status, st.created_at as createdAt
       FROM students st
       JOIN users u ON st.user_id = u.id
       JOIN schools s ON st.school_id = s.id
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE (? = '' OR st.school_id = ?)
         AND (? = '' OR c.name = ?)
         AND (? = '' OR u.full_name LIKE ? OR u.username LIKE ? OR st.nis_nisn LIKE ?)
       ORDER BY s.name ASC, c.name ASC, u.full_name ASC`
    )
    .all(schoolId, schoolId, className, className, q, like, like, like);

  res.json({ students: rows });
});

adminRoutes.post('/students', (req: AuthedRequest, res) => {
  const { fullName, nisNisn, gender, email, username, password, schoolId, classId, status } = req.body as Record<string, string>;
  if (!fullName?.trim() || !nisNisn?.trim() || !email?.trim() || !username?.trim() || !password?.trim() || !schoolId?.trim()) {
    return res.status(400).json({ error: 'Nama lengkap, NIS/NISN, email, username, password awal, dan sekolah wajib diisi.' });
  }
  if (password.trim().length < 6) {
    return res.status(400).json({ error: 'Password awal minimal 6 karakter.' });
  }

  const school = db.prepare('SELECT id, name FROM schools WHERE id = ?').get(schoolId.trim()) as
    | { id: string; name: string }
    | undefined;
  if (!school) return res.status(404).json({ error: 'Sekolah tidak ditemukan.' });

  if (classId?.trim()) {
    const cls = db.prepare('SELECT id FROM classes WHERE id = ? AND school_id = ?').get(classId.trim(), school.id);
    if (!cls) return res.status(400).json({ error: 'Kelas tidak sesuai dengan sekolah yang dipilih.' });
  }

  const dup = db
    .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)')
    .get(username.trim(), email.trim());
  if (dup) return res.status(409).json({ error: 'Username atau email sudah digunakan.' });

  const userId = genId('usr');
  const studentId = genId('std');
  const finalStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, full_name, role, school_id, status)
     VALUES (?, ?, ?, ?, ?, 'PESERTA_DIDIK', ?, ?)`
  ).run(userId, username.trim(), email.trim(), hashPassword(password.trim()), fullName.trim(), school.id, finalStatus);

  db.prepare(
    `INSERT INTO students (id, user_id, school_id, class_id, nis_nisn, gender)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(studentId, userId, school.id, classId?.trim() || null, nisNisn.trim(), gender?.trim() || 'Laki-laki');

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId: school.id,
    action: 'CREATE_STUDENT',
    entityType: 'STUDENT',
    entityId: studentId,
    details: `Menambahkan akun Peserta Didik "${fullName.trim()}" (${nisNisn.trim()}) di ${school.name}.`,
  });

  res.status(201).json({ id: studentId, userId });
});

adminRoutes.put('/students/:id', (req: AuthedRequest, res) => {
  const { fullName, nisNisn, gender, email, username, schoolId, classId, status } = req.body as Record<string, string>;
  const existing = db.prepare('SELECT id, user_id, school_id FROM students WHERE id = ?').get(req.params.id) as
    | { id: string; user_id: string; school_id: string }
    | undefined;
  if (!existing) return res.status(404).json({ error: 'Peserta didik tidak ditemukan.' });

  if (!fullName?.trim() || !nisNisn?.trim() || !email?.trim() || !username?.trim() || !schoolId?.trim()) {
    return res.status(400).json({ error: 'Data identitas peserta didik wajib lengkap.' });
  }

  const dup = db
    .prepare('SELECT id FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND id != ?')
    .get(username.trim(), email.trim(), existing.user_id);
  if (dup) return res.status(409).json({ error: 'Username atau email sudah digunakan akun lain.' });

  const finalStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  db.prepare(
    `UPDATE users SET full_name = ?, email = ?, username = ?, school_id = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(fullName.trim(), email.trim(), username.trim(), schoolId.trim(), finalStatus, existing.user_id);

  db.prepare(`UPDATE students SET school_id = ?, class_id = ?, nis_nisn = ?, gender = ? WHERE id = ?`).run(
    schoolId.trim(),
    classId?.trim() || null,
    nisNisn.trim(),
    gender?.trim() || 'Laki-laki',
    existing.id
  );

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId: schoolId.trim(),
    action: 'UPDATE_STUDENT',
    entityType: 'STUDENT',
    entityId: existing.id,
    details: `Memperbarui data Peserta Didik "${fullName.trim()}".`,
  });

  res.json({ ok: true });
});

adminRoutes.delete('/students/:id', (req: AuthedRequest, res) => {
  const existing = db
    .prepare(
      `SELECT st.id, st.user_id, st.school_id, u.full_name
       FROM students st JOIN users u ON st.user_id = u.id WHERE st.id = ?`
    )
    .get(req.params.id) as { id: string; user_id: string; school_id: string; full_name: string } | undefined;
  if (!existing) return res.status(404).json({ error: 'Peserta didik tidak ditemukan.' });

  db.prepare('DELETE FROM users WHERE id = ?').run(existing.user_id);

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId: existing.school_id,
    action: 'DELETE_STUDENT',
    entityType: 'STUDENT',
    entityId: existing.id,
    details: `Menghapus akun Peserta Didik "${existing.full_name}".`,
  });

  res.json({ ok: true });
});

// --- AUDIT LOGS & REPORTS ---
adminRoutes.get('/audit-logs', (req, res) => {
  const role = ((req.query.role as string) ?? '').trim();
  const q = ((req.query.q as string) ?? '').trim();
  const like = `%${q}%`;

  const logs = db
    .prepare(
      `SELECT a.id, a.user_id as userId, a.username, a.user_role as userRole, a.school_id as schoolId,
              a.action, a.entity_type as entityType, a.entity_id as entityId, a.details, a.created_at as createdAt
       FROM audit_logs a
       WHERE (? = '' OR a.user_role = ?)
         AND (? = '' OR a.username LIKE ? OR a.action LIKE ? OR a.details LIKE ?)
       ORDER BY a.created_at DESC
       LIMIT 200`
    )
    .all(role, role, q, like, like, like);

  res.json({ logs });
});

adminRoutes.get('/reports', (_req, res) => {
  const perSchool = db
    .prepare(
      `SELECT s.id, s.name, s.npsn, s.level, s.status,
              (SELECT COUNT(*) FROM bk_teachers bt WHERE bt.school_id = s.id) as bkCount,
              (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id) as studentCount,
              (SELECT COUNT(*) FROM self_assessments sa WHERE sa.school_id = s.id) as assessmentCount,
              (SELECT COUNT(*) FROM usage_records ur WHERE ur.school_id = s.id) as usageCount,
              (SELECT COUNT(*) FROM targets tg WHERE tg.school_id = s.id) as targetCount,
              (SELECT COUNT(*) FROM reflection_journals rj WHERE rj.school_id = s.id) as journalCount,
              (SELECT COUNT(*) FROM consultation_requests cr WHERE cr.school_id = s.id) as consultationTotal,
              (SELECT COUNT(*) FROM consultation_requests cr WHERE cr.school_id = s.id AND cr.status = 'MENUNGGU') as consultationWaiting,
              (SELECT COUNT(*) FROM consultation_requests cr WHERE cr.school_id = s.id AND cr.status = 'DIPROSES') as consultationProcessing,
              (SELECT COUNT(*) FROM consultation_requests cr WHERE cr.school_id = s.id AND cr.status = 'SELESAI') as consultationDone
       FROM schools s
       ORDER BY s.name ASC`
    )
    .all();

  res.json({ perSchool });
});
