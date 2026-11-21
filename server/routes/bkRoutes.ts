import { Router } from 'express';
import { db, genId } from '../db.ts';
import { hashPassword, requireAuth, requireRole, logAudit, type AuthedRequest } from '../auth.ts';

export const bkRoutes = Router();

bkRoutes.use(requireAuth, requireRole('GURU_BK'));

function getSchoolId(req: AuthedRequest): string {
  if (!req.authUser?.schoolId) {
    throw new Error('Akun Guru BK tidak terhubung dengan sekolah.');
  }
  return req.authUser.schoolId;
}

bkRoutes.get('/overview', (req: AuthedRequest, res) => {
  const schoolId = getSchoolId(req);

  const studentCount = (db.prepare('SELECT COUNT(*) as c FROM students WHERE school_id = ?').get(schoolId) as { c: number }).c;
  const assessmentCount = (db.prepare('SELECT COUNT(*) as c FROM self_assessments WHERE school_id = ?').get(schoolId) as { c: number }).c;
  const consultationCount = (db.prepare('SELECT COUNT(*) as c FROM consultation_requests WHERE school_id = ?').get(schoolId) as { c: number }).c;
  const waitingConsultations = (
    db.prepare("SELECT COUNT(*) as c FROM consultation_requests WHERE school_id = ? AND status = 'MENUNGGU'").get(schoolId) as { c: number }
  ).c;
  const usageCount = (db.prepare('SELECT COUNT(*) as c FROM usage_records WHERE school_id = ?').get(schoolId) as { c: number }).c;
  const targetCount = (db.prepare('SELECT COUNT(*) as c FROM targets WHERE school_id = ?').get(schoolId) as { c: number }).c;
  const sharedJournalCount = (
    db.prepare('SELECT COUNT(*) as c FROM reflection_journals WHERE school_id = ? AND shared_with_bk = 1').get(schoolId) as { c: number }
  ).c;

  const latestConsultations = db
    .prepare(
      `SELECT cr.id, cr.topic, cr.status, cr.created_at as createdAt, cr.preferred_schedule as preferredSchedule,
              u.full_name as studentName, COALESCE(c.name, '-') as className
       FROM consultation_requests cr
       JOIN students st ON cr.student_id = st.id
       JOIN users u ON st.user_id = u.id
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE cr.school_id = ?
       ORDER BY cr.created_at DESC
       LIMIT 5`
    )
    .all(schoolId);

  res.json({
    schoolName: req.authUser!.schoolName,
    teacherName: req.authUser!.fullName,
    stats: {
      studentCount,
      assessmentCount,
      consultationCount,
      waitingConsultations,
      usageCount,
      targetCount,
      sharedJournalCount,
    },
    featureUsage: [
      { label: 'Cek Diri', count: assessmentCount },
      { label: 'Catatan Penggunaan', count: usageCount },
      { label: 'Target Siswa', count: targetCount },
      { label: 'Jurnal Dibagikan', count: sharedJournalCount },
      { label: 'Konsultasi', count: consultationCount },
    ],
    latestConsultations,
  });
});

bkRoutes.get('/classes', (req: AuthedRequest, res) => {
  const schoolId = getSchoolId(req);
  const classes = db
    .prepare(
      `SELECT c.id, c.school_id as schoolId, c.name, c.grade_level as gradeLevel, c.academic_year as academicYear,
              (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id) as studentCount
       FROM classes c
       WHERE c.school_id = ?
       ORDER BY c.grade_level, c.name`
    )
    .all(schoolId);
  res.json({ classes });
});

bkRoutes.post('/classes', (req: AuthedRequest, res) => {
  const schoolId = getSchoolId(req);
  const { name, gradeLevel, academicYear } = req.body as Record<string, string>;
  if (!name?.trim() || !gradeLevel?.trim()) {
    return res.status(400).json({ error: 'Nama kelas dan tingkat wajib diisi.' });
  }
  const dup = db.prepare('SELECT id FROM classes WHERE school_id = ? AND LOWER(name) = LOWER(?)').get(schoolId, name.trim());
  if (dup) return res.status(409).json({ error: 'Kelas tersebut sudah terdaftar di sekolah ini.' });

  const id = genId('cls');
  db.prepare('INSERT INTO classes (id, school_id, name, grade_level, academic_year) VALUES (?, ?, ?, ?, ?)').run(
    id,
    schoolId,
    name.trim(),
    gradeLevel.trim(),
    academicYear?.trim() || '2026/2027'
  );
  res.status(201).json({ id });
});

bkRoutes.get('/students', (req: AuthedRequest, res) => {
  const schoolId = getSchoolId(req);
  const classId = ((req.query.classId as string) ?? '').trim();
  const q = ((req.query.q as string) ?? '').trim();
  const like = `%${q}%`;

  const students = db
    .prepare(
      `SELECT st.id, st.user_id as userId, st.school_id as schoolId, st.class_id as classId,
              COALESCE(c.name, '-') as className, u.full_name as fullName, u.username, u.email,
              st.nis_nisn as nisNisn, st.gender, u.status, st.created_at as createdAt
       FROM students st
       JOIN users u ON st.user_id = u.id
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE st.school_id = ?
         AND (? = '' OR st.class_id = ?)
         AND (? = '' OR u.full_name LIKE ? OR u.username LIKE ? OR st.nis_nisn LIKE ?)
       ORDER BY c.name ASC, u.full_name ASC`
    )
    .all(schoolId, classId, classId, q, like, like, like);

  res.json({ students });
});

bkRoutes.post('/students', (req: AuthedRequest, res) => {
  const schoolId = getSchoolId(req);
  const { fullName, nisNisn, gender, email, username, password, classId, status } = req.body as Record<string, string>;

  if (!fullName?.trim() || !nisNisn?.trim() || !email?.trim() || !username?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'Nama lengkap, NIS/NISN, email, username, dan password awal wajib diisi.' });
  }
  if (password.trim().length < 6) {
    return res.status(400).json({ error: 'Password awal minimal 6 karakter.' });
  }

  if (classId?.trim()) {
    const cls = db.prepare('SELECT id FROM classes WHERE id = ? AND school_id = ?').get(classId.trim(), schoolId);
    if (!cls) return res.status(403).json({ error: 'Kelas tidak ditemukan di sekolah Anda.' });
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
  ).run(userId, username.trim(), email.trim(), hashPassword(password.trim()), fullName.trim(), schoolId, finalStatus);

  db.prepare(
    `INSERT INTO students (id, user_id, school_id, class_id, nis_nisn, gender)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(studentId, userId, schoolId, classId?.trim() || null, nisNisn.trim(), gender?.trim() || 'Laki-laki');

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId,
    action: 'BK_CREATE_STUDENT',
    entityType: 'STUDENT',
    entityId: studentId,
    details: `Guru BK menambahkan akun Peserta Didik "${fullName.trim()}" (${nisNisn.trim()}).`,
  });

  res.status(201).json({ id: studentId, userId });
});

bkRoutes.put('/students/:id', (req: AuthedRequest, res) => {
  const schoolId = getSchoolId(req);
  const existing = db.prepare('SELECT id, user_id, school_id FROM students WHERE id = ?').get(req.params.id) as
    | { id: string; user_id: string; school_id: string }
    | undefined;

  if (!existing) return res.status(404).json({ error: 'Peserta didik tidak ditemukan.' });
  if (existing.school_id !== schoolId) {
    return res.status(403).json({ error: 'Akses ditolak: Peserta didik berasal dari sekolah lain.' });
  }

  const { fullName, nisNisn, gender, email, username, classId, status } = req.body as Record<string, string>;
  if (!fullName?.trim() || !nisNisn?.trim() || !email?.trim() || !username?.trim()) {
    return res.status(400).json({ error: 'Identitas dasar peserta didik wajib diisi.' });
  }

  const dup = db
    .prepare('SELECT id FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND id != ?')
    .get(username.trim(), email.trim(), existing.user_id);
  if (dup) return res.status(409).json({ error: 'Username atau email sudah digunakan akun lain.' });

  const finalStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  db.prepare(
    `UPDATE users SET full_name = ?, email = ?, username = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(fullName.trim(), email.trim(), username.trim(), finalStatus, existing.user_id);

  db.prepare(`UPDATE students SET class_id = ?, nis_nisn = ?, gender = ? WHERE id = ?`).run(
    classId?.trim() || null,
    nisNisn.trim(),
    gender?.trim() || 'Laki-laki',
    existing.id
  );

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId,
    action: 'BK_UPDATE_STUDENT',
    entityType: 'STUDENT',
    entityId: existing.id,
    details: `Guru BK memperbarui data Peserta Didik "${fullName.trim()}".`,
  });

  res.json({ ok: true });
});

bkRoutes.post('/students/:id/reset-password', (req: AuthedRequest, res) => {
  const schoolId = getSchoolId(req);
  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
  }

  const existing = db
    .prepare('SELECT st.id, st.user_id, st.school_id, u.username FROM students st JOIN users u ON st.user_id = u.id WHERE st.id = ?')
    .get(req.params.id) as { id: string; user_id: string; school_id: string; username: string } | undefined;
  if (!existing) return res.status(404).json({ error: 'Peserta didik tidak ditemukan.' });
  if (existing.school_id !== schoolId) {
    return res.status(403).json({ error: 'Akses ditolak: Peserta didik berasal dari sekolah lain.' });
  }

  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
    hashPassword(newPassword.trim()),
    existing.user_id
  );

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId,
    action: 'BK_RESET_STUDENT_PASSWORD',
    entityType: 'USER',
    entityId: existing.user_id,
    details: `Guru BK mereset password akun siswa "${existing.username}".`,
  });

  res.json({ ok: true });
});

bkRoutes.delete('/students/:id', (req: AuthedRequest, res) => {
  const schoolId = getSchoolId(req);
  const existing = db
    .prepare(
      `SELECT st.id, st.user_id, st.school_id, u.full_name, u.username
       FROM students st
       JOIN users u ON st.user_id = u.id
       WHERE st.id = ?`
    )
    .get(req.params.id) as
    | { id: string; user_id: string; school_id: string; full_name: string; username: string }
    | undefined;

  if (!existing) {
    return res.status(404).json({ error: 'Peserta didik tidak ditemukan.' });
  }
  if (existing.school_id !== schoolId) {
    return res.status(403).json({ error: 'Akses ditolak: Peserta didik berasal dari sekolah lain.' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(existing.user_id);

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId,
    action: 'BK_DELETE_STUDENT',
    entityType: 'STUDENT',
    entityId: existing.id,
    details: `Guru BK menghapus akun Peserta Didik "${existing.full_name}" (${existing.username}).`,
  });

  res.json({ ok: true });
});

bkRoutes.get('/assessments', (req: AuthedRequest, res) => {
  const schoolId = getSchoolId(req);

  const avgRow = db
    .prepare(
      `SELECT COUNT(*) as totalCount,
              ROUND(AVG(intensity_score), 1) as avgIntensity,
              ROUND(AVG(urge_score), 1) as avgUrge,
              ROUND(AVG(social_emotion_score), 1) as avgSocialEmotion,
              ROUND(AVG(control_impact_score), 1) as avgControlImpact
       FROM self_assessments
       WHERE school_id = ?`
    )
    .get(schoolId) as {
    totalCount: number;
    avgIntensity: number | null;
    avgUrge: number | null;
    avgSocialEmotion: number | null;
    avgControlImpact: number | null;
  };

  const categories = db
    .prepare(
      `SELECT category, COUNT(*) as count
       FROM self_assessments
       WHERE school_id = ?
       GROUP BY category
       ORDER BY count DESC`
    )
    .all(schoolId);

  const classOverview = db
    .prepare(
      `SELECT COALESCE(c.name, 'Belum Ditempatkan') as className,
              COUNT(sa.id) as assessmentCount,
              ROUND(AVG(sa.total_score), 1) as avgScore
       FROM self_assessments sa
       JOIN students st ON sa.student_id = st.id
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE sa.school_id = ?
       GROUP BY c.name
       ORDER BY className ASC`
    )
    .all(schoolId);

  res.json({
    summary: {
      totalCount: avgRow.totalCount ?? 0,
      avgIntensity: avgRow.avgIntensity ?? 0,
      avgUrge: avgRow.avgUrge ?? 0,
      avgSocialEmotion: avgRow.avgSocialEmotion ?? 0,
      avgControlImpact: avgRow.avgControlImpact ?? 0,
      maxIndicatorScore: 16,
    },
    categories,
    classOverview,
  });
});

bkRoutes.get('/consultations', (req: AuthedRequest, res) => {
  const schoolId = getSchoolId(req);
  const statusFilter = ((req.query.status as string) ?? '').trim();

  const requests = db
    .prepare(
      `SELECT cr.id, cr.student_id as studentId, u.full_name as studentName, COALESCE(c.name, '-') as className,
              cr.school_id as schoolId, cr.bk_teacher_id as bkTeacherId, bku.full_name as bkTeacherName,
              cr.topic, cr.message, cr.preferred_schedule as preferredSchedule, cr.scheduled_at as scheduledAt,
              cr.status, cr.created_at as createdAt, cr.updated_at as updatedAt
       FROM consultation_requests cr
       JOIN students st ON cr.student_id = st.id
       JOIN users u ON st.user_id = u.id
       LEFT JOIN classes c ON st.class_id = c.id
       JOIN bk_teachers bt ON cr.bk_teacher_id = bt.id
       JOIN users bku ON bt.user_id = bku.id
       WHERE cr.school_id = ?
         AND (? = '' OR cr.status = ?)
       ORDER BY cr.created_at DESC`
    )
    .all(schoolId, statusFilter, statusFilter) as Array<Record<string, unknown>>;

  const respStmt = db.prepare(
    `SELECT r.id, r.request_id as requestId, r.responder_user_id as responderUserId,
            u.full_name as responderName, r.response_text as responseText, r.schedule_note as scheduleNote,
            r.created_at as createdAt
     FROM consultation_responses r
     JOIN users u ON r.responder_user_id = u.id
     WHERE r.request_id = ?
     ORDER BY r.created_at ASC`
  );

  for (const r of requests) {
    r.responses = respStmt.all(r.id as string);
  }

  res.json({ consultations: requests });
});

bkRoutes.patch('/consultations/:id', (req: AuthedRequest, res) => {
  const schoolId = getSchoolId(req);
  const { status, scheduledAt, responseText, scheduleNote } = req.body as {
    status?: string;
    scheduledAt?: string;
    responseText?: string;
    scheduleNote?: string;
  };

  const existing = db
    .prepare('SELECT id, school_id, status FROM consultation_requests WHERE id = ?')
    .get(req.params.id) as { id: string; school_id: string; status: string } | undefined;

  if (!existing) return res.status(404).json({ error: 'Permintaan konsultasi tidak ditemukan.' });
  if (existing.school_id !== schoolId) {
    return res.status(403).json({ error: 'Akses ditolak: Permintaan konsultasi berasal dari sekolah lain.' });
  }

  const allowedStatus = ['MENUNGGU', 'DIPROSES', 'SELESAI'];
  const nextStatus = status && allowedStatus.includes(status) ? status : existing.status;

  db.prepare(
    `UPDATE consultation_requests
     SET status = ?, scheduled_at = COALESCE(?, scheduled_at), updated_at = datetime('now')
     WHERE id = ?`
  ).run(nextStatus, scheduledAt !== undefined ? scheduledAt.trim() : null, existing.id);

  if (responseText?.trim()) {
    db.prepare(
      `INSERT INTO consultation_responses (id, request_id, responder_user_id, response_text, schedule_note)
       VALUES (?, ?, ?, ?, ?)`
    ).run(genId('crs'), existing.id, req.authUser!.id, responseText.trim(), (scheduleNote ?? '').trim());
  }

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId,
    action: 'RESPOND_CONSULTATION',
    entityType: 'CONSULTATION',
    entityId: existing.id,
    details: `Guru BK memperbarui konsultasi ID ${existing.id} (status: ${nextStatus}).`,
  });

  res.json({ ok: true });
});

bkRoutes.get('/shared-journals', (req: AuthedRequest, res) => {
  const schoolId = getSchoolId(req);
  const bkTeacherId = req.authUser!.bkTeacherId;

  // STRICT PRIVACY: ONLY journals explicitly marked shared_with_bk = 1 by the student
  const journals = db
    .prepare(
      `SELECT rj.id, rj.student_id as studentId, u.full_name as studentName, COALESCE(c.name, '-') as className,
              rj.journal_date as journalDate, rj.feeling_after_use as feelingAfterUse,
              rj.activity_impact as activityImpact, rj.time_control as timeControl,
              rj.habit_to_improve as habitToImprove, rj.positive_change as positiveChange,
              rj.free_note as freeNote, rj.created_at as createdAt
       FROM reflection_journals rj
       JOIN students st ON rj.student_id = st.id
       JOIN users u ON st.user_id = u.id
       LEFT JOIN classes c ON st.class_id = c.id
       WHERE rj.school_id = ?
         AND rj.shared_with_bk = 1
         AND (rj.shared_bk_teacher_id IS NULL OR rj.shared_bk_teacher_id = ?)
       ORDER BY rj.journal_date DESC, rj.created_at DESC`
    )
    .all(schoolId, bkTeacherId ?? '');

  res.json({ journals });
});

bkRoutes.get('/reports', (req: AuthedRequest, res) => {
  const schoolId = getSchoolId(req);
  const period = ((req.query.period as string) ?? 'all').trim();

  let dateClause = '';
  if (period === '7d') {
    dateClause = "AND created_at >= datetime('now', '-7 days')";
  } else if (period === '30d') {
    dateClause = "AND created_at >= datetime('now', '-30 days')";
  }

  const assessments = (
    db.prepare(`SELECT COUNT(*) as c FROM self_assessments WHERE school_id = ? ${dateClause}`).get(schoolId) as { c: number }
  ).c;
  const usageRecords = (
    db.prepare(`SELECT COUNT(*) as c FROM usage_records WHERE school_id = ? ${dateClause}`).get(schoolId) as { c: number }
  ).c;
  const totalMinutes = (
    db
      .prepare(`SELECT COALESCE(SUM(duration_minutes), 0) as s FROM usage_records WHERE school_id = ? ${dateClause}`)
      .get(schoolId) as { s: number }
  ).s;
  const targets = (
    db.prepare(`SELECT COUNT(*) as c FROM targets WHERE school_id = ? ${dateClause}`).get(schoolId) as { c: number }
  ).c;
  const completedTargets = (
    db.prepare(`SELECT COUNT(*) as c FROM targets WHERE school_id = ? AND status = 'SELESAI' ${dateClause}`).get(schoolId) as { c: number }
  ).c;
  const consultations = (
    db.prepare(`SELECT COUNT(*) as c FROM consultation_requests WHERE school_id = ? ${dateClause}`).get(schoolId) as { c: number }
  ).c;
  const doneConsultations = (
    db
      .prepare(`SELECT COUNT(*) as c FROM consultation_requests WHERE school_id = ? AND status = 'SELESAI' ${dateClause}`)
      .get(schoolId) as { c: number }
  ).c;

  const topApps = db
    .prepare(
      `SELECT app_name as appName, COUNT(*) as entries, SUM(duration_minutes) as totalMinutes
       FROM usage_records
       WHERE school_id = ? ${dateClause}
       GROUP BY app_name
       ORDER BY totalMinutes DESC
       LIMIT 6`
    )
    .all(schoolId);

  res.json({
    period,
    schoolName: req.authUser!.schoolName,
    summary: {
      assessments,
      usageRecords,
      totalMinutes,
      targets,
      completedTargets,
      consultations,
      doneConsultations,
    },
    topApps,
  });
});
