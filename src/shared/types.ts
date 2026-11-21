export type UserRole = 'ADMIN_CENTRAL' | 'GURU_BK' | 'PESERTA_DIDIK';
export type AccountStatus = 'ACTIVE' | 'INACTIVE';
export type SchoolStatus = 'ACTIVE' | 'INACTIVE';
export type ConsultationStatus = 'MENUNGGU' | 'DIPROSES' | 'SELESAI';
export type TargetPeriod = 'HARIAN' | 'MINGGUAN';
export type TargetStatus = 'BERJALAN' | 'SELESAI';
export type AnswerLabel = 'SS' | 'S' | 'TS' | 'STS';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  schoolId: string | null;
  schoolName: string | null;
  status: AccountStatus;
  studentId?: string | null;
  bkTeacherId?: string | null;
  classId?: string | null;
  className?: string | null;
  nisNisn?: string | null;
  nip?: string | null;
  title?: string | null;
}

export interface School {
  id: string;
  code?: string;
  name: string;
  npsn: string;
  level: string;
  address: string;
  email: string;
  phone: string;
  status: SchoolStatus;
  createdAt: string;
  updatedAt: string;
  bkCount?: number;
  studentCount?: number;
  assessmentCount?: number;
  journalCount?: number;
  consultationCount?: number;
  consultationDoneCount?: number;
  reflectionCount?: number;
  reflection30dCount?: number;
}

export interface SchoolClass {
  id: string;
  schoolId: string;
  name: string;
  gradeLevel: string;
  academicYear: string;
  studentCount?: number;
}

export interface BkTeacher {
  id: string;
  userId: string;
  schoolId: string;
  schoolName?: string;
  fullName: string;
  username: string;
  email: string;
  nip: string;
  title: string;
  bio: string;
  status: AccountStatus;
  createdAt: string;
}

export interface StudentRecord {
  id: string;
  userId: string;
  schoolId: string;
  schoolName?: string;
  classId: string | null;
  className?: string;
  fullName: string;
  username: string;
  email: string;
  nisNisn: string;
  gender: string;
  status: AccountStatus;
  createdAt: string;
}

export interface AssessmentQuestion {
  key: string;
  indicator: 'INTENSITAS' | 'DORONGAN' | 'SOSIAL_EMOSI' | 'KONTROL_DAMPAK';
  indicatorLabel: string;
  statement: string;
  isPositive?: boolean;
}

export interface SelfAssessment {
  id: string;
  studentId: string;
  schoolId: string;
  totalScore: number;
  maxScore: number;
  category: string;
  intensityScore: number;
  urgeScore: number;
  socialEmotionScore: number;
  controlImpactScore: number;
  summaryText: string;
  reflectionSuggestion: string;
  createdAt: string;
}

export interface UsageRecord {
  id: string;
  studentId: string;
  schoolId: string;
  recordDate: string;
  appName: string;
  durationMinutes: number;
  purpose: string;
  activityDescription: string;
  notes: string;
  createdAt: string;
}

export interface TargetItem {
  id: string;
  studentId: string;
  schoolId: string;
  title: string;
  periodType: TargetPeriod;
  habitToImprove: string;
  dailyLimitMinutes: number;
  startDate: string;
  targetDate: string;
  progressPercent: number;
  status: TargetStatus;
  createdAt: string;
}

export interface ReflectionJournal {
  id: string;
  studentId: string;
  studentName?: string;
  className?: string;
  schoolId: string;
  journalDate: string;
  feelingAfterUse: string;
  activityImpact: string;
  timeControl: string;
  habitToImprove: string;
  positiveChange: string;
  freeNote: string;
  sharedWithBk: boolean;
  sharedBkTeacherId: string | null;
  sharedBkTeacherName?: string | null;
  createdAt: string;
}

export interface ConsultationResponse {
  id: string;
  requestId: string;
  responderUserId: string;
  responderName: string;
  responseText: string;
  scheduleNote: string;
  createdAt: string;
}

export interface ConsultationRequest {
  id: string;
  studentId: string;
  studentName?: string;
  className?: string;
  schoolId: string;
  bkTeacherId: string;
  bkTeacherName?: string;
  bkTeacherTitle?: string;
  topic: string;
  message: string;
  preferredSchedule: string;
  scheduledAt: string;
  status: ConsultationStatus;
  createdAt: string;
  updatedAt: string;
  responses?: ConsultationResponse[];
}

export interface EducationalMaterial {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  summary: string;
  learningObjectives: string[];
  keyPoints: string[];
  conclusion: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  username: string;
  userRole: string;
  schoolId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string;
  createdAt: string;
}

export interface FocusSession {
  id: string;
  studentId: string;
  schoolId: string;
  title: string;
  durationMinutes: number;
  sessionDate: string;
  reflectionNote: string;
  createdAt: string;
}
