import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import { db, genId } from './db.ts';
import type { AuthUser, UserRole } from '../src/shared/types.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'digital-balance-dev-secret-change-in-production';
export const SESSION_COOKIE_NAME = 'db_session';

interface JwtPayload {
  userId: string;
  role: UserRole;
}

export interface AuthedRequest extends Request {
  authUser?: AuthUser;
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function signAuthToken(userId: string, role: UserRole): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

export function loadAuthUserById(userId: string): AuthUser | null {
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.full_name, u.role, u.school_id, u.status,
              s.name as school_name, s.status as school_status
       FROM users u
       LEFT JOIN schools s ON u.school_id = s.id
       WHERE u.id = ?`
    )
    .get(userId) as
    | {
        id: string;
        username: string;
        email: string;
        full_name: string;
        role: UserRole;
        school_id: string | null;
        status: 'ACTIVE' | 'INACTIVE';
        school_name: string | null;
        school_status: 'ACTIVE' | 'INACTIVE' | null;
      }
    | undefined;

  if (!row) return null;
  if (row.status !== 'ACTIVE') return null;
  if (row.school_id && row.school_status !== 'ACTIVE') return null;

  const base: AuthUser = {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    schoolId: row.school_id,
    schoolName: row.school_name,
    status: row.status,
  };

  if (row.role === 'PESERTA_DIDIK') {
    const stu = db
      .prepare(
        `SELECT st.id, st.class_id, st.nis_nisn, c.name as class_name
         FROM students st
         LEFT JOIN classes c ON st.class_id = c.id
         WHERE st.user_id = ?`
      )
      .get(row.id) as { id: string; class_id: string | null; nis_nisn: string; class_name: string | null } | undefined;
    if (stu) {
      base.studentId = stu.id;
      base.classId = stu.class_id;
      base.className = stu.class_name;
      base.nisNisn = stu.nis_nisn;
    }
  } else if (row.role === 'GURU_BK') {
    const bk = db
      .prepare(`SELECT id, nip, title FROM bk_teachers WHERE user_id = ?`)
      .get(row.id) as { id: string; nip: string; title: string } | undefined;
    if (bk) {
      base.bkTeacherId = bk.id;
      base.nip = bk.nip;
      base.title = bk.title;
    }
  }

  return base;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : null;
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  const token = bearer || cookieToken;

  if (!token) {
    return res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan masuk kembali.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const user = loadAuthUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Akun atau sekolah tidak aktif. Hubungi pengelola sistem.' });
    }
    req.authUser = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token sesi tidak valid atau telah kedaluwarsa.' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Autentikasi diperlukan.' });
    }
    if (!roles.includes(req.authUser.role)) {
      return res.status(403).json({ error: 'Akses ditolak: Anda tidak memiliki hak akses untuk fitur ini.' });
    }
    next();
  };
}

export function logAudit(params: {
  userId?: string | null;
  username: string;
  userRole: string;
  schoolId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details: string;
}) {
  try {
    db.prepare(
      `INSERT INTO audit_logs (id, user_id, username, user_role, school_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      genId('aud'),
      params.userId ?? null,
      params.username,
      params.userRole,
      params.schoolId ?? null,
      params.action,
      params.entityType,
      params.entityId ?? null,
      params.details
    );
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
}
