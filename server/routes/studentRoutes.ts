import { Router } from 'express';
import { db, genId } from '../db.ts';
import { requireAuth, requireRole, logAudit, type AuthedRequest } from '../auth.ts';
import { ASSESSMENT_QUESTIONS, evaluateAssessment } from '../assessmentQuestions.ts';
import type { AnswerLabel } from '../../src/shared/types.ts';

export const studentRoutes = Router();

studentRoutes.use(requireAuth, requireRole('PESERTA_DIDIK'));

function getStudentCtx(req: AuthedRequest) {
  if (!req.authUser?.studentId || !req.authUser?.schoolId) {
    throw new Error('Profil peserta didik belum terhubung.');
  }
  return {
    studentId: req.authUser.studentId,
    schoolId: req.authUser.schoolId,
    userId: req.authUser.id,
  };
}

studentRoutes.get('/home', (req: AuthedRequest, res) => {
  const { studentId } = getStudentCtx(req);

  const assessmentCount = (
    db.prepare('SELECT COUNT(*) as c FROM self_assessments WHERE student_id = ?').get(studentId) as { c: number }
  ).c;
  const latestAssessment = db
    .prepare(
      `SELECT id, total_score as totalScore, max_score as maxScore, category, created_at as createdAt
       FROM self_assessments WHERE student_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(studentId);

  const usageTotalMinutes = (
    db
      .prepare("SELECT COALESCE(SUM(duration_minutes), 0) as s FROM usage_records WHERE student_id = ? AND record_date >= date('now', '-7 days')")
      .get(studentId) as { s: number }
  ).s;

  const usageCount = (
    db.prepare('SELECT COUNT(*) as c FROM usage_records WHERE student_id = ?').get(studentId) as { c: number }
  ).c;

  const activeTargets = db
    .prepare(
      `SELECT id, title, period_type as periodType, habit_to_improve as habitToImprove,
              daily_limit_minutes as dailyLimitMinutes, start_date as startDate, target_date as targetDate,
              progress_percent as progressPercent, status
       FROM targets WHERE student_id = ? ORDER BY status ASC, target_date ASC LIMIT 4`
    )
    .all(studentId);

  const journalCount = (
    db.prepare('SELECT COUNT(*) as c FROM reflection_journals WHERE student_id = ?').get(studentId) as { c: number }
  ).c;

  const latestJournal = db
    .prepare('SELECT id, journal_date as journalDate FROM reflection_journals WHERE student_id = ? ORDER BY journal_date DESC LIMIT 1')
    .get(studentId);

  const openConsultations = (
    db
      .prepare("SELECT COUNT(*) as c FROM consultation_requests WHERE student_id = ? AND status != 'SELESAI'")
      .get(studentId) as { c: number }
  ).c;

  const recentUsage = db
    .prepare(
      `SELECT id, record_date as recordDate, app_name as appName, duration_minutes as durationMinutes, purpose
       FROM usage_records WHERE student_id = ? ORDER BY record_date DESC, created_at DESC LIMIT 4`
    )
    .all(studentId);

  res.json({
    summary: {
      assessmentCount,
      usageTotalMinutes7d: usageTotalMinutes,
      usageCount,
      journalCount,
      openConsultations,
    },
    latestAssessment: latestAssessment ?? null,
    latestJournal: latestJournal ?? null,
    activeTargets,
    recentUsage,
  });
});

// --- CEK DIRI ---
studentRoutes.get('/assessments/questions', (_req, res) => {
  res.json({ questions: ASSESSMENT_QUESTIONS });
});

studentRoutes.get('/assessments', (req: AuthedRequest, res) => {
  const { studentId } = getStudentCtx(req);
  const rows = db
    .prepare(
      `SELECT id, student_id as studentId, school_id as schoolId, total_score as totalScore, max_score as maxScore,
              category, intensity_score as intensityScore, urge_score as urgeScore,
              social_emotion_score as socialEmotionScore, control_impact_score as controlImpactScore,
              summary_text as summaryText, reflection_suggestion as reflectionSuggestion, created_at as createdAt
       FROM self_assessments
       WHERE student_id = ?
       ORDER BY created_at DESC`
    )
    .all(studentId);

  res.json({ assessments: rows });
});

studentRoutes.post('/assessments', (req: AuthedRequest, res) => {
  const { studentId, schoolId } = getStudentCtx(req);
  const { answers } = req.body as { answers?: Record<string, AnswerLabel> };

  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Jawaban Cek Diri tidak valid.' });
  }

  const validLabels = new Set(['SS', 'S', 'TS', 'STS']);
  for (const q of ASSESSMENT_QUESTIONS) {
    const val = answers[q.key];
    if (!val || !validLabels.has(val)) {
      return res.status(400).json({ error: 'Semua pernyataan Cek Diri wajib dijawab sebelum melihat hasil.' });
    }
  }

  const result = evaluateAssessment(answers);
  const assessmentId = genId('asm');

  db.prepare(
    `INSERT INTO self_assessments (
       id, student_id, school_id, total_score, max_score, category,
       intensity_score, urge_score, social_emotion_score, control_impact_score,
       summary_text, reflection_suggestion
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    assessmentId,
    studentId,
    schoolId,
    result.totalScore,
    result.maxScore,
    result.category,
    result.intensityScore,
    result.urgeScore,
    result.socialEmotionScore,
    result.controlImpactScore,
    result.summaryText,
    result.reflectionSuggestion
  );

  const ansStmt = db.prepare(
    `INSERT INTO self_assessment_answers (id, assessment_id, question_key, indicator, statement_text, answer_label, score_value)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const item of result.detailedAnswers) {
    ansStmt.run(genId('asa'), assessmentId, item.questionKey, item.indicator, item.statementText, item.answerLabel, item.scoreValue);
  }

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId,
    action: 'SUBMIT_SELF_ASSESSMENT',
    entityType: 'SELF_ASSESSMENT',
    entityId: assessmentId,
    details: `Peserta didik menyelesaikan Cek Diri (${result.category}).`,
  });

  res.status(201).json({
    assessment: {
      id: assessmentId,
      studentId,
      schoolId,
      totalScore: result.totalScore,
      maxScore: result.maxScore,
      category: result.category,
      intensityScore: result.intensityScore,
      urgeScore: result.urgeScore,
      socialEmotionScore: result.socialEmotionScore,
      controlImpactScore: result.controlImpactScore,
      summaryText: result.summaryText,
      reflectionSuggestion: result.reflectionSuggestion,
      createdAt: new Date().toISOString(),
    },
  });
});

// --- CATATAN PENGGUNAAN ---
studentRoutes.get('/usage-records', (req: AuthedRequest, res) => {
  const { studentId } = getStudentCtx(req);
  const records = db
    .prepare(
      `SELECT id, student_id as studentId, school_id as schoolId, record_date as recordDate,
              app_name as appName, duration_minutes as durationMinutes, purpose,
              activity_description as activityDescription, notes, created_at as createdAt
       FROM usage_records
       WHERE student_id = ?
       ORDER BY record_date DESC, created_at DESC`
    )
    .all(studentId);

  const dailySummary = db
    .prepare(
      `SELECT record_date as day, SUM(duration_minutes) as totalMinutes, COUNT(*) as entries
       FROM usage_records
       WHERE student_id = ?
       GROUP BY record_date
       ORDER BY record_date DESC
       LIMIT 7`
    )
    .all(studentId)
    .reverse();

  const appSummary = db
    .prepare(
      `SELECT app_name as appName, SUM(duration_minutes) as totalMinutes, COUNT(*) as entries
       FROM usage_records
       WHERE student_id = ?
       GROUP BY app_name
       ORDER BY totalMinutes DESC`
    )
    .all(studentId);

  res.json({ records, dailySummary, appSummary });
});

studentRoutes.post('/usage-records', (req: AuthedRequest, res) => {
  const { studentId, schoolId } = getStudentCtx(req);
  const { recordDate, appName, durationMinutes, purpose, activityDescription, notes } = req.body as {
    recordDate?: string;
    appName?: string;
    durationMinutes?: number;
    purpose?: string;
    activityDescription?: string;
    notes?: string;
  };

  const duration = Number(durationMinutes);
  if (!recordDate?.trim() || !appName?.trim() || !Number.isFinite(duration) || duration <= 0 || !purpose?.trim() || !activityDescription?.trim()) {
    return res.status(400).json({ error: 'Tanggal, nama aplikasi, durasi (>0 menit), tujuan, dan aktivitas wajib diisi.' });
  }

  const id = genId('usg');
  db.prepare(
    `INSERT INTO usage_records (id, student_id, school_id, record_date, app_name, duration_minutes, purpose, activity_description, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, studentId, schoolId, recordDate.trim(), appName.trim(), Math.round(duration), purpose.trim(), activityDescription.trim(), (notes ?? '').trim());

  res.status(201).json({ id });
});

studentRoutes.put('/usage-records/:id', (req: AuthedRequest, res) => {
  const { studentId } = getStudentCtx(req);
  const existing = db.prepare('SELECT id, student_id FROM usage_records WHERE id = ?').get(req.params.id) as
    | { id: string; student_id: string }
    | undefined;
  if (!existing) return res.status(404).json({ error: 'Catatan penggunaan tidak ditemukan.' });
  if (existing.student_id !== studentId) return res.status(403).json({ error: 'Akses ditolak.' });

  const { recordDate, appName, durationMinutes, purpose, activityDescription, notes } = req.body as {
    recordDate?: string;
    appName?: string;
    durationMinutes?: number;
    purpose?: string;
    activityDescription?: string;
    notes?: string;
  };
  const duration = Number(durationMinutes);
  if (!recordDate?.trim() || !appName?.trim() || !Number.isFinite(duration) || duration <= 0 || !purpose?.trim() || !activityDescription?.trim()) {
    return res.status(400).json({ error: 'Semua kolom wajib catatan penggunaan harus diisi dengan benar.' });
  }

  db.prepare(
    `UPDATE usage_records
     SET record_date = ?, app_name = ?, duration_minutes = ?, purpose = ?, activity_description = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(recordDate.trim(), appName.trim(), Math.round(duration), purpose.trim(), activityDescription.trim(), (notes ?? '').trim(), existing.id);

  res.json({ ok: true });
});

studentRoutes.delete('/usage-records/:id', (req: AuthedRequest, res) => {
  const { studentId } = getStudentCtx(req);
  const existing = db.prepare('SELECT id, student_id FROM usage_records WHERE id = ?').get(req.params.id) as
    | { id: string; student_id: string }
    | undefined;
  if (!existing) return res.status(404).json({ error: 'Catatan penggunaan tidak ditemukan.' });
  if (existing.student_id !== studentId) return res.status(403).json({ error: 'Akses ditolak.' });

  db.prepare('DELETE FROM usage_records WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

// --- TARGET SAYA ---
studentRoutes.get('/targets', (req: AuthedRequest, res) => {
  const { studentId } = getStudentCtx(req);
  const targets = db
    .prepare(
      `SELECT id, student_id as studentId, school_id as schoolId, title, period_type as periodType,
              habit_to_improve as habitToImprove, daily_limit_minutes as dailyLimitMinutes,
              start_date as startDate, target_date as targetDate, progress_percent as progressPercent,
              status, created_at as createdAt
       FROM targets
       WHERE student_id = ?
       ORDER BY status ASC, created_at DESC`
    )
    .all(studentId);
  res.json({ targets });
});

studentRoutes.post('/targets', (req: AuthedRequest, res) => {
  const { studentId, schoolId } = getStudentCtx(req);
  const { title, periodType, habitToImprove, dailyLimitMinutes, startDate, targetDate, progressPercent } = req.body as {
    title?: string;
    periodType?: string;
    habitToImprove?: string;
    dailyLimitMinutes?: number;
    startDate?: string;
    targetDate?: string;
    progressPercent?: number;
  };

  const limit = Number(dailyLimitMinutes);
  const pct = Math.max(0, Math.min(100, Number(progressPercent ?? 0)));
  if (!title?.trim() || !habitToImprove?.trim() || !Number.isFinite(limit) || limit <= 0 || !startDate?.trim() || !targetDate?.trim()) {
    return res.status(400).json({ error: 'Judul target, kebiasaan, batas waktu (>0 menit), dan tanggal wajib diisi.' });
  }

  const pType = periodType === 'MINGGUAN' ? 'MINGGUAN' : 'HARIAN';
  const status = pct >= 100 ? 'SELESAI' : 'BERJALAN';
  const id = genId('tgt');

  db.prepare(
    `INSERT INTO targets (id, student_id, school_id, title, period_type, habit_to_improve, daily_limit_minutes, start_date, target_date, progress_percent, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, studentId, schoolId, title.trim(), pType, habitToImprove.trim(), Math.round(limit), startDate.trim(), targetDate.trim(), Math.round(pct), status);

  res.status(201).json({ id });
});

studentRoutes.put('/targets/:id', (req: AuthedRequest, res) => {
  const { studentId } = getStudentCtx(req);
  const existing = db.prepare('SELECT id, student_id FROM targets WHERE id = ?').get(req.params.id) as
    | { id: string; student_id: string }
    | undefined;
  if (!existing) return res.status(404).json({ error: 'Target tidak ditemukan.' });
  if (existing.student_id !== studentId) return res.status(403).json({ error: 'Akses ditolak.' });

  const { title, periodType, habitToImprove, dailyLimitMinutes, startDate, targetDate, progressPercent, status } = req.body as {
    title?: string;
    periodType?: string;
    habitToImprove?: string;
    dailyLimitMinutes?: number;
    startDate?: string;
    targetDate?: string;
    progressPercent?: number;
    status?: string;
  };

  const limit = Number(dailyLimitMinutes);
  let pct = Math.max(0, Math.min(100, Math.round(Number(progressPercent ?? 0))));
  let finalStatus = status === 'SELESAI' ? 'SELESAI' : 'BERJALAN';
  if (finalStatus === 'SELESAI') pct = 100;
  if (pct === 100) finalStatus = 'SELESAI';

  if (!title?.trim() || !habitToImprove?.trim() || !Number.isFinite(limit) || limit <= 0 || !startDate?.trim() || !targetDate?.trim()) {
    return res.status(400).json({ error: 'Data target tidak lengkap.' });
  }

  const pType = periodType === 'MINGGUAN' ? 'MINGGUAN' : 'HARIAN';
  db.prepare(
    `UPDATE targets
     SET title = ?, period_type = ?, habit_to_improve = ?, daily_limit_minutes = ?, start_date = ?, target_date = ?,
         progress_percent = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(title.trim(), pType, habitToImprove.trim(), Math.round(limit), startDate.trim(), targetDate.trim(), pct, finalStatus, existing.id);

  res.json({ ok: true });
});

studentRoutes.delete('/targets/:id', (req: AuthedRequest, res) => {
  const { studentId } = getStudentCtx(req);
  const existing = db.prepare('SELECT id, student_id FROM targets WHERE id = ?').get(req.params.id) as
    | { id: string; student_id: string }
    | undefined;
  if (!existing) return res.status(404).json({ error: 'Target tidak ditemukan.' });
  if (existing.student_id !== studentId) return res.status(403).json({ error: 'Akses ditolak.' });

  db.prepare('DELETE FROM targets WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

// --- JURNAL REFLEKSI ---
studentRoutes.get('/journals', (req: AuthedRequest, res) => {
  const { studentId } = getStudentCtx(req);
  const rows = db
    .prepare(
      `SELECT rj.id, rj.student_id as studentId, rj.school_id as schoolId, rj.journal_date as journalDate,
              rj.feeling_after_use as feelingAfterUse, rj.activity_impact as activityImpact,
              rj.time_control as timeControl, rj.habit_to_improve as habitToImprove,
              rj.positive_change as positiveChange, rj.free_note as freeNote,
              rj.shared_with_bk as sharedWithBk, rj.shared_bk_teacher_id as sharedBkTeacherId,
              u.full_name as sharedBkTeacherName, rj.created_at as createdAt
       FROM reflection_journals rj
       LEFT JOIN bk_teachers bt ON rj.shared_bk_teacher_id = bt.id
       LEFT JOIN users u ON bt.user_id = u.id
       WHERE rj.student_id = ?
       ORDER BY rj.journal_date DESC, rj.created_at DESC`
    )
    .all(studentId) as Array<Record<string, unknown>>;

  for (const r of rows) {
    r.sharedWithBk = Boolean(r.sharedWithBk);
  }
  res.json({ journals: rows });
});

studentRoutes.post('/journals', (req: AuthedRequest, res) => {
  const { studentId, schoolId } = getStudentCtx(req);
  const {
    journalDate,
    feelingAfterUse,
    activityImpact,
    timeControl,
    habitToImprove,
    positiveChange,
    freeNote,
    sharedWithBk,
    sharedBkTeacherId,
  } = req.body as {
    journalDate?: string;
    feelingAfterUse?: string;
    activityImpact?: string;
    timeControl?: string;
    habitToImprove?: string;
    positiveChange?: string;
    freeNote?: string;
    sharedWithBk?: boolean;
    sharedBkTeacherId?: string | null;
  };

  if (
    !journalDate?.trim() ||
    !feelingAfterUse?.trim() ||
    !activityImpact?.trim() ||
    !timeControl?.trim() ||
    !habitToImprove?.trim() ||
    !positiveChange?.trim()
  ) {
    return res.status(400).json({ error: 'Harap lengkapi semua pertanyaan panduan refleksi.' });
  }

  let validatedBkId: string | null = null;
  if (sharedWithBk && sharedBkTeacherId) {
    const bk = db.prepare('SELECT id FROM bk_teachers WHERE id = ? AND school_id = ?').get(sharedBkTeacherId, schoolId);
    if (!bk) return res.status(403).json({ error: 'Guru BK yang dipilih tidak berasal dari sekolah Anda.' });
    validatedBkId = sharedBkTeacherId;
  }

  const id = genId('jrn');
  db.prepare(
    `INSERT INTO reflection_journals (
       id, student_id, school_id, journal_date, feeling_after_use, activity_impact,
       time_control, habit_to_improve, positive_change, free_note, shared_with_bk, shared_bk_teacher_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    studentId,
    schoolId,
    journalDate.trim(),
    feelingAfterUse.trim(),
    activityImpact.trim(),
    timeControl.trim(),
    habitToImprove.trim(),
    positiveChange.trim(),
    (freeNote ?? '').trim(),
    sharedWithBk ? 1 : 0,
    sharedWithBk ? validatedBkId : null
  );

  res.status(201).json({ id });
});

studentRoutes.put('/journals/:id', (req: AuthedRequest, res) => {
  const { studentId, schoolId } = getStudentCtx(req);
  const existing = db.prepare('SELECT id, student_id FROM reflection_journals WHERE id = ?').get(req.params.id) as
    | { id: string; student_id: string }
    | undefined;
  if (!existing) return res.status(404).json({ error: 'Jurnal tidak ditemukan.' });
  if (existing.student_id !== studentId) return res.status(403).json({ error: 'Akses ditolak.' });

  const {
    journalDate,
    feelingAfterUse,
    activityImpact,
    timeControl,
    habitToImprove,
    positiveChange,
    freeNote,
    sharedWithBk,
    sharedBkTeacherId,
  } = req.body as {
    journalDate?: string;
    feelingAfterUse?: string;
    activityImpact?: string;
    timeControl?: string;
    habitToImprove?: string;
    positiveChange?: string;
    freeNote?: string;
    sharedWithBk?: boolean;
    sharedBkTeacherId?: string | null;
  };

  if (
    !journalDate?.trim() ||
    !feelingAfterUse?.trim() ||
    !activityImpact?.trim() ||
    !timeControl?.trim() ||
    !habitToImprove?.trim() ||
    !positiveChange?.trim()
  ) {
    return res.status(400).json({ error: 'Harap lengkapi semua pertanyaan panduan refleksi.' });
  }

  let validatedBkId: string | null = null;
  if (sharedWithBk && sharedBkTeacherId) {
    const bk = db.prepare('SELECT id FROM bk_teachers WHERE id = ? AND school_id = ?').get(sharedBkTeacherId, schoolId);
    if (!bk) return res.status(403).json({ error: 'Guru BK yang dipilih tidak berasal dari sekolah Anda.' });
    validatedBkId = sharedBkTeacherId;
  }

  db.prepare(
    `UPDATE reflection_journals
     SET journal_date = ?, feeling_after_use = ?, activity_impact = ?, time_control = ?,
         habit_to_improve = ?, positive_change = ?, free_note = ?, shared_with_bk = ?,
         shared_bk_teacher_id = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    journalDate.trim(),
    feelingAfterUse.trim(),
    activityImpact.trim(),
    timeControl.trim(),
    habitToImprove.trim(),
    positiveChange.trim(),
    (freeNote ?? '').trim(),
    sharedWithBk ? 1 : 0,
    sharedWithBk ? validatedBkId : null,
    existing.id
  );

  res.json({ ok: true });
});

studentRoutes.delete('/journals/:id', (req: AuthedRequest, res) => {
  const { studentId } = getStudentCtx(req);
  const existing = db.prepare('SELECT id, student_id FROM reflection_journals WHERE id = ?').get(req.params.id) as
    | { id: string; student_id: string }
    | undefined;
  if (!existing) return res.status(404).json({ error: 'Jurnal tidak ditemukan.' });
  if (existing.student_id !== studentId) return res.status(403).json({ error: 'Akses ditolak.' });

  db.prepare('DELETE FROM reflection_journals WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

// --- HUBUNGI GURU BK (OWN SCHOOL ONLY) ---
studentRoutes.get('/bk-teachers', (req: AuthedRequest, res) => {
  const { schoolId } = getStudentCtx(req);
  const teachers = db
    .prepare(
      `SELECT bt.id, bt.user_id as userId, u.full_name as fullName, u.email, bt.title, bt.bio
       FROM bk_teachers bt
       JOIN users u ON bt.user_id = u.id
       WHERE bt.school_id = ? AND u.status = 'ACTIVE'
       ORDER BY u.full_name ASC`
    )
    .all(schoolId);
  res.json({ bkTeachers: teachers });
});

studentRoutes.get('/consultations', (req: AuthedRequest, res) => {
  const { studentId } = getStudentCtx(req);
  const requests = db
    .prepare(
      `SELECT cr.id, cr.student_id as studentId, cr.school_id as schoolId, cr.bk_teacher_id as bkTeacherId,
              u.full_name as bkTeacherName, bt.title as bkTeacherTitle,
              cr.topic, cr.message, cr.preferred_schedule as preferredSchedule, cr.scheduled_at as scheduledAt,
              cr.status, cr.created_at as createdAt, cr.updated_at as updatedAt
       FROM consultation_requests cr
       JOIN bk_teachers bt ON cr.bk_teacher_id = bt.id
       JOIN users u ON bt.user_id = u.id
       WHERE cr.student_id = ?
       ORDER BY cr.created_at DESC`
    )
    .all(studentId) as Array<Record<string, unknown>>;

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

studentRoutes.post('/consultations', (req: AuthedRequest, res) => {
  const { studentId, schoolId } = getStudentCtx(req);
  const { bkTeacherId, topic, message, preferredSchedule } = req.body as {
    bkTeacherId?: string;
    topic?: string;
    message?: string;
    preferredSchedule?: string;
  };

  if (!bkTeacherId?.trim() || !topic?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Pilih Guru BK, topik konsultasi, dan pesan yang ingin disampaikan.' });
  }

  // Strictly enforce same-school Guru BK
  const teacher = db
    .prepare(
      `SELECT bt.id, u.status
       FROM bk_teachers bt JOIN users u ON bt.user_id = u.id
       WHERE bt.id = ? AND bt.school_id = ?`
    )
    .get(bkTeacherId.trim(), schoolId) as { id: string; status: string } | undefined;

  if (!teacher || teacher.status !== 'ACTIVE') {
    return res.status(403).json({ error: 'Guru BK yang dipilih tidak tersedia di sekolah Anda.' });
  }

  const id = genId('cns');
  db.prepare(
    `INSERT INTO consultation_requests (id, student_id, school_id, bk_teacher_id, topic, message, preferred_schedule, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'MENUNGGU')`
  ).run(id, studentId, schoolId, teacher.id, topic.trim(), message.trim(), (preferredSchedule ?? '').trim());

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId,
    action: 'CREATE_CONSULTATION_REQUEST',
    entityType: 'CONSULTATION',
    entityId: id,
    details: `Peserta didik mengajukan permintaan konsultasi topik "${topic.trim()}".`,
  });

  res.status(201).json({ id });
});

// --- RUANG FOKUS & KONTROL DIRI ---
studentRoutes.get('/focus-sessions', (req: AuthedRequest, res) => {
  const { studentId } = getStudentCtx(req);
  const sessions = db
    .prepare(
      `SELECT id, student_id as studentId, school_id as schoolId, title, duration_minutes as durationMinutes,
              session_date as sessionDate, reflection_note as reflectionNote, created_at as createdAt
       FROM focus_sessions
       WHERE student_id = ?
       ORDER BY session_date DESC, created_at DESC
       LIMIT 30`
    )
    .all(studentId) as Array<{ durationMinutes: number }>;

  const totals = db
    .prepare('SELECT COUNT(*) as sessionCount, COALESCE(SUM(duration_minutes), 0) as totalMinutes FROM focus_sessions WHERE student_id = ?')
    .get(studentId) as { sessionCount: number; totalMinutes: number };

  res.json({
    sessions,
    sessionCount: totals.sessionCount,
    totalMinutes: totals.totalMinutes,
  });
});

studentRoutes.post('/focus-sessions', (req: AuthedRequest, res) => {
  const { studentId, schoolId } = getStudentCtx(req);
  const { title, durationMinutes, sessionDate, reflectionNote } = req.body as {
    title?: string;
    durationMinutes?: number;
    sessionDate?: string;
    reflectionNote?: string;
  };

  const mins = Number(durationMinutes);
  if (!title?.trim() || !Number.isFinite(mins) || mins < 1 || mins > 480) {
    return res.status(400).json({ error: 'Judul sesi fokus dan durasi (1–480 menit) wajib diisi.' });
  }

  const finalDate = sessionDate?.trim() || new Date().toISOString().slice(0, 10);
  const id = genId('foc');
  db.prepare(
    `INSERT INTO focus_sessions (id, student_id, school_id, title, duration_minutes, session_date, reflection_note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, studentId, schoolId, title.trim(), Math.round(mins), finalDate, (reflectionNote ?? '').trim());

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId,
    action: 'COMPLETE_FOCUS_SESSION',
    entityType: 'FOCUS_SESSION',
    entityId: id,
    details: `Peserta didik menyelesaikan sesi fokus "${title.trim()}" (${Math.round(mins)} menit).`,
  });

  res.status(201).json({ id });
});

studentRoutes.delete('/focus-sessions/:id', (req: AuthedRequest, res) => {
  const { studentId } = getStudentCtx(req);
  const existing = db.prepare('SELECT id, student_id FROM focus_sessions WHERE id = ?').get(req.params.id) as
    | { id: string; student_id: string }
    | undefined;
  if (!existing) return res.status(404).json({ error: 'Catatan sesi fokus tidak ditemukan.' });
  if (existing.student_id !== studentId) return res.status(403).json({ error: 'Akses ditolak.' });

  db.prepare('DELETE FROM focus_sessions WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

// --- MISI DIGITAL, POIN & LENCANA ---
const ALLOWED_MISSION_POINTS: Record<string, number> = {
  detoks_malam: 30,
  mode_senyap: 25,
  jurnal_jujur: 25,
  aksi_nyata: 30,
  kurasi_feed: 20,
  simulasi_keputusan: 40,
};

function computeLevel(points: number) {
  const levels = [
    { level: 1, title: 'Penjelajah Sadar', min: 0, next: 100 },
    { level: 2, title: 'Pengatur Waktu', min: 100, next: 250 },
    { level: 3, title: 'Penjaga Fokus', min: 250, next: 500 },
    { level: 4, title: 'Ksatria Kontrol Diri', min: 500, next: 900 },
    { level: 5, title: 'Duta Digital Balance', min: 900, next: 1500 },
  ];
  let current = levels[0];
  for (const lvl of levels) {
    if (points >= lvl.min) current = lvl;
  }
  const span = Math.max(1, current.next - current.min);
  const progressPercent = Math.min(100, Math.max(0, Math.round(((points - current.min) / span) * 100)));
  return {
    level: current.level,
    title: current.title,
    nextLevelPoints: current.next,
    progressPercent,
  };
}

studentRoutes.get('/missions', (req: AuthedRequest, res) => {
  const { studentId } = getStudentCtx(req);
  const today = new Date().toISOString().slice(0, 10);

  const missionPoints = (
    db.prepare('SELECT COALESCE(SUM(points), 0) as p FROM student_missions WHERE student_id = ?').get(studentId) as { p: number }
  ).p;
  const focusCount = (
    db.prepare('SELECT COUNT(*) as c FROM focus_sessions WHERE student_id = ?').get(studentId) as { c: number }
  ).c;
  const assessmentCount = (
    db.prepare('SELECT COUNT(*) as c FROM self_assessments WHERE student_id = ?').get(studentId) as { c: number }
  ).c;
  const usageCount = (
    db.prepare('SELECT COUNT(*) as c FROM usage_records WHERE student_id = ?').get(studentId) as { c: number }
  ).c;
  const journalCount = (
    db.prepare('SELECT COUNT(*) as c FROM reflection_journals WHERE student_id = ?').get(studentId) as { c: number }
  ).c;
  const completedTargetsCount = (
    db.prepare("SELECT COUNT(*) as c FROM targets WHERE student_id = ? AND status = 'SELESAI'").get(studentId) as { c: number }
  ).c;
  const missionTotalCount = (
    db.prepare('SELECT COUNT(*) as c FROM student_missions WHERE student_id = ?').get(studentId) as { c: number }
  ).c;

  // Real earned points from missions + activity bonuses
  const totalPoints =
    missionPoints + focusCount * 20 + assessmentCount * 25 + usageCount * 10 + journalCount * 15 + completedTargetsCount * 30;

  const completedTodayRows = db
    .prepare('SELECT mission_key as missionKey FROM student_missions WHERE student_id = ? AND completed_date = ?')
    .all(studentId, today) as Array<{ missionKey: string }>;

  const activeDays = (
    db.prepare('SELECT COUNT(DISTINCT completed_date) as d FROM student_missions WHERE student_id = ?').get(studentId) as { d: number }
  ).d;

  const recentCompletions = db
    .prepare(
      `SELECT id, mission_key as missionKey, mission_title as missionTitle, points, completed_date as completedDate
       FROM student_missions
       WHERE student_id = ?
       ORDER BY created_at DESC
       LIMIT 10`
    )
    .all(studentId);

  const badges = [
    {
      id: 'b_cek',
      title: 'Sadar Diri',
      desc: 'Menyelesaikan minimal 1x Cek Diri',
      unlocked: assessmentCount >= 1,
    },
    {
      id: 'b_catat',
      title: 'Pelacak Waktu',
      desc: 'Mencatat minimal 3 penggunaan aplikasi',
      unlocked: usageCount >= 3,
    },
    {
      id: 'b_jurnal',
      title: 'Penulis Refleksi',
      desc: 'Menulis minimal 2 Jurnal Refleksi',
      unlocked: journalCount >= 2,
    },
    {
      id: 'b_target',
      title: 'Penakluk Target',
      desc: 'Menyelesaikan minimal 1 Target Saya',
      unlocked: completedTargetsCount >= 1,
    },
    {
      id: 'b_fokus',
      title: 'Fokus Tanpa Distraksi',
      desc: 'Menyelesaikan minimal 1 Sesi Fokus',
      unlocked: focusCount >= 1,
    },
    {
      id: 'b_misi',
      title: 'Pejuang Keseimbangan',
      desc: 'Menyelesaikan minimal 3 Misi / Simulasi',
      unlocked: missionTotalCount >= 3,
    },
  ];

  res.json({
    totalPoints,
    levelInfo: computeLevel(totalPoints),
    activeDays,
    completedTodayKeys: completedTodayRows.map((r) => r.missionKey),
    recentCompletions,
    badges,
  });
});

studentRoutes.post('/missions/complete', (req: AuthedRequest, res) => {
  const { studentId, schoolId } = getStudentCtx(req);
  const { missionKey, missionTitle } = req.body as {
    missionKey?: string;
    missionTitle?: string;
  };

  if (!missionKey || !(missionKey in ALLOWED_MISSION_POINTS)) {
    return res.status(400).json({ error: 'Jenis misi tidak valid.' });
  }

  const points = ALLOWED_MISSION_POINTS[missionKey];
  const today = new Date().toISOString().slice(0, 10);
  const existing = db
    .prepare('SELECT id FROM student_missions WHERE student_id = ? AND mission_key = ? AND completed_date = ?')
    .get(studentId, missionKey, today);

  if (existing) {
    return res.json({ ok: true, alreadyCompleted: true, message: 'Misi ini sudah kamu selesaikan hari ini.' });
  }

  const id = genId('msn');
  db.prepare(
    `INSERT INTO student_missions (id, student_id, school_id, mission_key, mission_title, points, completed_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, studentId, schoolId, missionKey, (missionTitle ?? missionKey).trim(), points, today);

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId,
    action: 'COMPLETE_MISSION',
    entityType: 'MISSION',
    entityId: id,
    details: `Peserta didik menyelesaikan misi "${(missionTitle ?? missionKey).trim()}" (+${points} poin).`,
  });

  res.status(201).json({ ok: true, alreadyCompleted: false, points, id });
});
