import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

function resolveDataDir(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', 'digital_balance_data');
  }
  const localDir = path.resolve(process.cwd(), 'data');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    fs.accessSync(localDir, fs.constants.W_OK);
    return localDir;
  } catch {
    return path.join('/tmp', 'digital_balance_data');
  }
}

const dataDir = resolveDataDir();
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'digital_balance.db');
export const db = new DatabaseSync(dbPath);

try {
  db.exec('PRAGMA journal_mode = WAL;');
} catch {
  // Fallback if filesystem does not support WAL shared memory
}
db.exec('PRAGMA foreign_keys = ON;');

export function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

let dbInitialized = false;

export function initDatabase() {
  if (dbInitialized) return;
  dbInitialized = true;
  db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      npsn TEXT NOT NULL UNIQUE,
      level TEXT NOT NULL,
      address TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN_CENTRAL', 'GURU_BK', 'PESERTA_DIDIK')),
      school_id TEXT REFERENCES schools(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      grade_level TEXT NOT NULL,
      academic_year TEXT NOT NULL DEFAULT '2026/2027',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (school_id, name)
    );

    CREATE TABLE IF NOT EXISTS bk_teachers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      nip TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT 'Guru Bimbingan & Konseling',
      bio TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
      nis_nisn TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT 'Laki-laki',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS self_assessments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      total_score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      category TEXT NOT NULL,
      intensity_score INTEGER NOT NULL,
      urge_score INTEGER NOT NULL,
      social_emotion_score INTEGER NOT NULL,
      control_impact_score INTEGER NOT NULL,
      summary_text TEXT NOT NULL,
      reflection_suggestion TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS self_assessment_answers (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL REFERENCES self_assessments(id) ON DELETE CASCADE,
      question_key TEXT NOT NULL,
      indicator TEXT NOT NULL,
      statement_text TEXT NOT NULL,
      answer_label TEXT NOT NULL CHECK (answer_label IN ('SS', 'S', 'TS', 'STS')),
      score_value INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      record_date TEXT NOT NULL,
      app_name TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      purpose TEXT NOT NULL,
      activity_description TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS targets (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      period_type TEXT NOT NULL CHECK (period_type IN ('HARIAN', 'MINGGUAN')),
      habit_to_improve TEXT NOT NULL,
      daily_limit_minutes INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      target_date TEXT NOT NULL,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'BERJALAN' CHECK (status IN ('BERJALAN', 'SELESAI')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reflection_journals (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      journal_date TEXT NOT NULL,
      feeling_after_use TEXT NOT NULL,
      activity_impact TEXT NOT NULL,
      time_control TEXT NOT NULL,
      habit_to_improve TEXT NOT NULL,
      positive_change TEXT NOT NULL,
      free_note TEXT NOT NULL DEFAULT '',
      shared_with_bk INTEGER NOT NULL DEFAULT 0,
      shared_bk_teacher_id TEXT REFERENCES bk_teachers(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS consultation_requests (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      bk_teacher_id TEXT NOT NULL REFERENCES bk_teachers(id) ON DELETE CASCADE,
      topic TEXT NOT NULL,
      message TEXT NOT NULL,
      preferred_schedule TEXT NOT NULL DEFAULT '',
      scheduled_at TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU', 'DIPROSES', 'SELESAI')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS consultation_responses (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES consultation_requests(id) ON DELETE CASCADE,
      responder_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      response_text TEXT NOT NULL,
      schedule_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS educational_materials (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      summary TEXT NOT NULL,
      learning_objectives TEXT NOT NULL,
      key_points TEXT NOT NULL,
      conclusion TEXT NOT NULL,
      created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      session_date TEXT NOT NULL,
      reflection_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS student_missions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      mission_key TEXT NOT NULL,
      mission_title TEXT NOT NULL,
      points INTEGER NOT NULL,
      completed_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (student_id, mission_key, completed_date)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT NOT NULL,
      user_role TEXT NOT NULL,
      school_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seedInitialSystemData();
  syncAdminAccountFromEnv();
}

function syncAdminAccountFromEnv() {
  const envUsername = process.env.ADMIN_USERNAME?.trim();
  const envEmail = process.env.ADMIN_EMAIL?.trim();
  const envPassword = process.env.ADMIN_PASSWORD?.trim();
  const envFullName = process.env.ADMIN_FULL_NAME?.trim();

  if (!envUsername && !envEmail && !envPassword && !envFullName) {
    return;
  }

  const adminRow = db
    .prepare("SELECT id, username, email, full_name FROM users WHERE role = 'ADMIN_CENTRAL' ORDER BY created_at ASC LIMIT 1")
    .get() as { id: string; username: string; email: string; full_name: string } | undefined;

  if (!adminRow) {
    const username = envUsername || 'admin.central';
    const email = envEmail || 'admin@digitalbalance.id';
    const passwordHash = bcrypt.hashSync(envPassword || crypto.randomBytes(24).toString('hex'), 10);
    const fullName = envFullName || 'Koordinator Admin Central';
    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, school_id, status)
       VALUES ('usr_admin_central', ?, ?, ?, ?, 'ADMIN_CENTRAL', NULL, 'ACTIVE')`
    ).run(username, email, passwordHash, fullName);
    return;
  }

  const updates: string[] = [];
  const params: string[] = [];
  if (envUsername && envUsername !== adminRow.username) {
    updates.push('username = ?');
    params.push(envUsername);
  }
  if (envEmail && envEmail !== adminRow.email) {
    updates.push('email = ?');
    params.push(envEmail);
  }
  if (envFullName && envFullName !== adminRow.full_name) {
    updates.push('full_name = ?');
    params.push(envFullName);
  }
  if (envPassword) {
    updates.push('password_hash = ?');
    params.push(bcrypt.hashSync(envPassword, 10));
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(adminRow.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }
}

function seedInitialSystemData() {
  const userCountRow = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (userCountRow.cnt === 0) {
    const initialAdminUsername = process.env.ADMIN_USERNAME?.trim() || 'admin.central';
    const initialAdminEmail = process.env.ADMIN_EMAIL?.trim() || 'admin@digitalbalance.id';
    const initialAdminFullName = process.env.ADMIN_FULL_NAME?.trim() || 'Koordinator Admin Central';
    const initialAdminPass = process.env.ADMIN_PASSWORD?.trim() || 'Admin123!';

    const adminPass = bcrypt.hashSync(initialAdminPass, 10);
    // Seeded Guru BK & student accounts use private random credentials unless explicitly configured;
    // Admin Central creates or resets Guru BK credentials inside the dashboard.
    const bkPass = bcrypt.hashSync(
      process.env.DEFAULT_BK_PASSWORD?.trim() || crypto.randomBytes(24).toString('hex'),
      10
    );
    const studentPass = bcrypt.hashSync(
      process.env.DEFAULT_STUDENT_PASSWORD?.trim() || crypto.randomBytes(24).toString('hex'),
      10
    );

    const adminId = 'usr_admin_central';
    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, school_id, status)
       VALUES (?, ?, ?, ?, ?, 'ADMIN_CENTRAL', NULL, 'ACTIVE')`
    ).run(adminId, initialAdminUsername, initialAdminEmail, adminPass, initialAdminFullName);

    // Initial two schools so multi-school isolation can be verified immediately
    const sch1 = 'sch_harapan_01';
    const sch2 = 'sch_cendekia_02';
    db.prepare(
      `INSERT INTO schools (id, name, npsn, level, address, email, phone, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`
    ).run(
      sch1,
      'SMA Negeri 1 Harapan',
      '20219001',
      'SMA',
      'Jl. Pendidikan No. 14, Bandung',
      'bk@sman1harapan.sch.id',
      '022-7201140'
    );
    db.prepare(
      `INSERT INTO schools (id, name, npsn, level, address, email, phone, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`
    ).run(
      sch2,
      'SMP Negeri 2 Cendekia',
      '20219002',
      'SMP',
      'Jl. Merdeka No. 88, Surabaya',
      'bk@smpn2cendekia.sch.id',
      '031-5342210'
    );

    // Classes
    const cls1a = 'cls_10_ipa_1';
    const cls1b = 'cls_11_ips_2';
    const cls2a = 'cls_8a';
    db.prepare(`INSERT INTO classes (id, school_id, name, grade_level) VALUES (?, ?, ?, ?)`).run(cls1a, sch1, 'X IPA 1', '10');
    db.prepare(`INSERT INTO classes (id, school_id, name, grade_level) VALUES (?, ?, ?, ?)`).run(cls1b, sch1, 'XI IPS 2', '11');
    db.prepare(`INSERT INTO classes (id, school_id, name, grade_level) VALUES (?, ?, ?, ?)`).run(cls2a, sch2, 'VIII-A', '8');

    // BK Teachers (2 in school 1, 1 in school 2)
    const bk1UserId = 'usr_bk_sari';
    const bk2UserId = 'usr_bk_hendra';
    const bk3UserId = 'usr_bk_budi';

    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, school_id, status)
       VALUES (?, ?, ?, ?, ?, 'GURU_BK', ?, 'ACTIVE')`
    ).run(bk1UserId, 'bk.sari', 'sari.wijaya@sman1harapan.sch.id', bkPass, 'Dra. Sari Wijaya, M.Pd.', sch1);
    db.prepare(
      `INSERT INTO bk_teachers (id, user_id, school_id, nip, title, bio)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('bkt_sari_01', bk1UserId, sch1, '198405122010012011', 'Koordinator Guru BK', 'Mendampingi peserta didik dalam manajemen waktu digital dan kesejahteraan emosi.');

    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, school_id, status)
       VALUES (?, ?, ?, ?, ?, 'GURU_BK', ?, 'ACTIVE')`
    ).run(bk2UserId, 'bk.hendra', 'hendra.pratama@sman1harapan.sch.id', bkPass, 'Hendra Pratama, S.Pd.', sch1);
    db.prepare(
      `INSERT INTO bk_teachers (id, user_id, school_id, nip, title, bio)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('bkt_hendra_02', bk2UserId, sch1, '199108202019031007', 'Guru BK Kelas X & XI', 'Fokus pada pendampingan kontrol diri dan konseling pribadi.');

    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, school_id, status)
       VALUES (?, ?, ?, ?, ?, 'GURU_BK', ?, 'ACTIVE')`
    ).run(bk3UserId, 'bk.budi', 'budi.santoso@smpn2cendekia.sch.id', bkPass, 'Budi Santoso, S.Pd., Kons.', sch2);
    db.prepare(
      `INSERT INTO bk_teachers (id, user_id, school_id, nip, title, bio)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('bkt_budi_03', bk3UserId, sch2, '198811032014021003', 'Guru BK SMPN 2 Cendekia', 'Pendampingan literasi digital remaja dan keseimbangan belajar.');

    // Students (one in school 1, one in school 2)
    const stu1UserId = 'usr_stu_dina';
    const stu2UserId = 'usr_stu_rafi';

    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, school_id, status)
       VALUES (?, ?, ?, ?, ?, 'PESERTA_DIDIK', ?, 'ACTIVE')`
    ).run(stu1UserId, 'siswa.dina', 'dina.amalia@sman1harapan.sch.id', studentPass, 'Dina Amalia Putri', sch1);
    db.prepare(
      `INSERT INTO students (id, user_id, school_id, class_id, nis_nisn, gender)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('std_dina_01', stu1UserId, sch1, cls1a, '242510018', 'Perempuan');

    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, school_id, status)
       VALUES (?, ?, ?, ?, ?, 'PESERTA_DIDIK', ?, 'ACTIVE')`
    ).run(stu2UserId, 'siswa.rafi', 'rafi.ahmad@smpn2cendekia.sch.id', studentPass, 'Rafi Ahmad Fauzan', sch2);
    db.prepare(
      `INSERT INTO students (id, user_id, school_id, class_id, nis_nisn, gender)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('std_rafi_02', stu2UserId, sch2, cls2a, '242508042', 'Laki-laki');

    db.prepare(
      `INSERT INTO audit_logs (id, user_id, username, user_role, school_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, NULL, 'SYSTEM_INIT', 'SYSTEM', 'init', ?)`
    ).run(genId('aud'), adminId, 'admin.central', 'ADMIN_CENTRAL', 'Inisialisasi awal basis data DIGITAL BALANCE dengan sekolah dan akun dasar.');
  }

  const eduCountRow = db.prepare('SELECT COUNT(*) as cnt FROM educational_materials').get() as { cnt: number };
  if (eduCountRow.cnt === 0) {
    const materials = [
      {
        id: 'edu_01',
        title: 'Memahami Algoritma dan Cara Kerja Media Sosial',
        category: 'Mengenal Media Sosial',
        image_url: '/src/assets/images/edu_mengenal_medsos_1795163570081.jpg',
        summary:
          'Platform media sosial dirancang untuk mempertahankan perhatian penggunanya melalui umpan tak terbatas, notifikasi instan, dan rekomendasi personal. Mengenali mekanisme ini membantu kamu mengambil keputusan secara lebih sadar.',
        learning_objectives: JSON.stringify([
          'Memahami bagaimana algoritma memengaruhi konten yang muncul di beranda.',
          'Mengenali pemicu kebiasaan membuka aplikasi secara otomatis tanpa tujuan.',
          'Membedakan penggunaan media sosial yang disengaja dan penggunaan pasif.'
        ]),
        key_points: JSON.stringify([
          'Scroll tanpa batas (infinite scroll) menghilangkan tanda alami untuk berhenti.',
          'Notifikasi merah memicu rasa penasaran meski pesan tidak mendesak.',
          'Kamu memegang kendali penuh untuk mengatur ulang feed dan notifikasi.'
        ]),
        conclusion:
          'Media sosial adalah alat komunikasi dan belajar yang bermanfaat selama kamu sadar kapan dan mengapa membukanya.'
      },
      {
        id: 'edu_02',
        title: 'Melatih Kontrol Diri di Era Distraksi Digital',
        category: 'Pentingnya Kontrol Diri',
        image_url: '/src/assets/images/edu_kontrol_diri_1795163569691.jpg',
        summary:
          'Kontrol diri bukan berarti menjauhi teknologi sepenuhnya, melainkan kemampuan menahan dorongan sesaat agar tetap selaras dengan prioritas belajar, istirahat, dan relasi nyata.',
        learning_objectives: JSON.stringify([
          'Mengidentifikasi momen ketika dorongan membuka gawai muncul saat belajar.',
          'Menerapkan jeda sadar 10 detik sebelum membuka aplikasi hiburan.',
          'Membangun lingkungan belajar yang minim gangguan notifikasi.'
        ]),
        key_points: JSON.stringify([
          'Jauhkan ponsel dari jangkauan tangan saat sesi belajar fokus 25–45 menit.',
          'Gunakan mode Jangan Ganggu (Do Not Disturb) pada jam istirahat malam.',
          'Rayakan keberhasilan kecil setiap kali berhasil mematuhi batas waktu.'
        ]),
        conclusion:
          'Kontrol diri adalah keterampilan yang tumbuh lewat latihan bertahap dan konsisten setiap hari.'
      },
      {
        id: 'edu_03',
        title: 'Mengenali Dampak Pola Penggunaan Media Sosial yang Berlebihan',
        category: 'Dampak Penggunaan Media Sosial',
        image_url: '/src/assets/images/edu_mengenal_medsos_1795163570081.jpg',
        summary:
          'Penggunaan media sosial larut malam atau tanpa jeda dapat memengaruhi kualitas tidur, fokus di kelas, dan suasana hati. Mengenali sinyal awal membantu kamu melakukan penyesuaian lebih dini.',
        learning_objectives: JSON.stringify([
          'Mengamati hubungan antara durasi layar malam hari dan kesegaran pagi.',
          'Memahami fenomena membandingkan diri (social comparison) di media sosial.',
          'Menyadari tanda kelelahan mental akibat paparan informasi berlebih.'
        ]),
        key_points: JSON.stringify([
          'Cahaya layar dan konten emosional menjelang tidur menunda rasa kantuk.',
          'Unggahan orang lain sering kali hanya menampilkan sorotan terbaik, bukan keseharian penuh.',
          'Mengurangi waktu layar sebelum tidur berdampak langsung pada konsentrasi belajar.'
        ]),
        conclusion:
          'Memperhatikan dampak fisik dan emosional setelah berselancar membantu kita menjaga keseimbangan diri.'
      },
      {
        id: 'edu_04',
        title: 'Strategi Manajemen Waktu: Menyeimbangkan Belajar, Hobi, dan Layar',
        category: 'Manajemen Waktu',
        image_url: '/src/assets/images/edu_manajemen_waktu_1795163569589.jpg',
        summary:
          'Manajemen waktu yang sehat memberi porsi adil bagi tugas sekolah, istirahat, aktivitas fisik, dan hiburan digital tanpa rasa bersalah.',
        learning_objectives: JSON.stringify([
          'Menyusun blok waktu harian yang realistis antara belajar dan hiburan.',
          'Menggunakan pengingat durasi aplikasi sebagai batas bantu.',
          'Mengganti kebiasaan scrolling kosong dengan aktivitas pemulihan energi.'
        ]),
        key_points: JSON.stringify([
          'Terapkan aturan "Kerjakan Prioritas Dulu, Hiburan Kemudian".',
          'Tentukan jam bebas layar minimal 30–45 menit sebelum waktu tidur.',
          'Catat durasi penggunaan secara jujur untuk melihat pola mingguanmu.'
        ]),
        conclusion:
          'Waktu yang terkelola baik membuatmu lebih tenang menikmati hiburan tanpa mengorbankan tanggung jawab.'
      },
      {
        id: 'edu_05',
        title: 'Menjaga Kesehatan Sosial dan Emosional di Dunia Nyata & Maya',
        category: 'Kesehatan Sosial dan Emosional',
        image_url: '/src/assets/images/edu_kesehatan_emosi_1795163571676.jpg',
        summary:
          'Interaksi tatap muka bersama teman dan keluarga memberi dukungan emosional yang hangat dan nyata. Menjaga kesehatan emosi juga berarti berani meminta dukungan saat merasa kewalahan.',
        learning_objectives: JSON.stringify([
          'Memahami pentingnya percakapan tatap muka untuk rasa keterhubungan.',
          'Mengelola emosi ketika menemui komentar negatif atau tekanan sosial online.',
          'Mengetahui kapan perlu berdiskusi dengan Guru BK atau orang terpercaya.'
        ]),
        key_points: JSON.stringify([
          'Luangkan waktu berbicara langsung tanpa memegang ponsel saat berkumpul.',
          'Unfollow atau bisukan akun yang membuatmu cemas atau tidak nyaman.',
          'Berbagi cerita dengan Guru BK adalah langkah positif untuk merawat diri.'
        ]),
        conclusion:
          'Kesejahteraan emosional tumbuh subur ketika interaksi digital diimbangi dengan koneksi sosial yang hangat di dunia nyata.'
      },
      {
        id: 'edu_06',
        title: 'Langkah Praktis Membangun Kebiasaan Digital yang Sehat',
        category: 'Membangun Kebiasaan Digital yang Sehat',
        image_url: '/src/assets/images/login_digital_balance_hero_1795163570176.jpg',
        summary:
          'Kebiasaan digital yang sehat dibangun melalui perubahan kecil yang mudah dilakukan setiap hari, seperti menata layar utama ponsel dan melakukan refleksi rutin.',
        learning_objectives: JSON.stringify([
          'Merancang aturan pribadi yang ramah dan realistis untuk diri sendiri.',
          'Melakukan refleksi mingguan untuk mengevaluasi perasaan dan progres.',
          'Mempertahankan kebiasaan baik tanpa bersikap terlalu keras pada diri sendiri.'
        ]),
        key_points: JSON.stringify([
          'Pindahkan aplikasi hiburan ke folder halaman kedua agar tidak langsung terlihat.',
          'Tetapkan satu zona bebas gawai, misalnya meja makan atau tempat tidur.',
          'Tulis jurnal singkat setiap minggu tentang hal positif yang berhasil dilakukan.'
        ]),
        conclusion:
          'Keseimbangan digital bukan tentang kesempurnaan, melainkan langkah sadar kecil yang terus berlanjut.'
      }
    ];

    const stmt = db.prepare(
      `INSERT INTO educational_materials (id, title, category, image_url, summary, learning_objectives, key_points, conclusion, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    );
    for (const m of materials) {
      stmt.run(m.id, m.title, m.category, m.image_url, m.summary, m.learning_objectives, m.key_points, m.conclusion);
    }
  }
}
