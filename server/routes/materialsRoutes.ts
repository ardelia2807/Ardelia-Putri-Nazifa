import { Router } from 'express';
import { db, genId } from '../db.ts';
import { requireAuth, requireRole, logAudit, type AuthedRequest } from '../auth.ts';

export const materialsRoutes = Router();

materialsRoutes.use(requireAuth);

materialsRoutes.get('/', (req, res) => {
  const category = ((req.query.category as string) ?? '').trim();
  const q = ((req.query.q as string) ?? '').trim();
  const like = `%${q}%`;

  const rows = db
    .prepare(
      `SELECT id, title, category, image_url as imageUrl, summary,
              learning_objectives as learningObjectives, key_points as keyPoints,
              conclusion, created_at as createdAt
       FROM educational_materials
       WHERE (? = '' OR category = ?)
         AND (? = '' OR title LIKE ? OR summary LIKE ? OR category LIKE ?)
       ORDER BY created_at ASC`
    )
    .all(category, category, q, like, like, like) as Array<Record<string, unknown>>;

  const materials = rows.map((r) => ({
    ...r,
    learningObjectives: JSON.parse((r.learningObjectives as string) || '[]'),
    keyPoints: JSON.parse((r.keyPoints as string) || '[]'),
  }));

  res.json({ materials });
});

materialsRoutes.post('/', requireRole('ADMIN_CENTRAL', 'GURU_BK'), (req: AuthedRequest, res) => {
  const { title, category, imageUrl, summary, learningObjectives, keyPoints, conclusion } = req.body as {
    title?: string;
    category?: string;
    imageUrl?: string;
    summary?: string;
    learningObjectives?: string[];
    keyPoints?: string[];
    conclusion?: string;
  };

  if (!title?.trim() || !category?.trim() || !summary?.trim() || !conclusion?.trim()) {
    return res.status(400).json({ error: 'Judul, kategori, ringkasan, dan kesimpulan materi wajib diisi.' });
  }

  const id = genId('edu');
  db.prepare(
    `INSERT INTO educational_materials (id, title, category, image_url, summary, learning_objectives, key_points, conclusion, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    title.trim(),
    category.trim(),
    imageUrl?.trim() || '/src/assets/images/edu_mengenal_medsos_1795163570081.jpg',
    summary.trim(),
    JSON.stringify(Array.isArray(learningObjectives) ? learningObjectives.filter(Boolean) : []),
    JSON.stringify(Array.isArray(keyPoints) ? keyPoints.filter(Boolean) : []),
    conclusion.trim(),
    req.authUser!.id
  );

  logAudit({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    userRole: req.authUser!.role,
    schoolId: req.authUser!.schoolId,
    action: 'CREATE_EDUCATIONAL_MATERIAL',
    entityType: 'MATERIAL',
    entityId: id,
    details: `Menambahkan materi edukasi "${title.trim()}" (${category.trim()}).`,
  });

  res.status(201).json({ id });
});
