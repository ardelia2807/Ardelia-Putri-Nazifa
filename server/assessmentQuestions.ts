import type { AnswerLabel, AssessmentQuestion } from '../src/shared/types.ts';

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  // 1. Intensitas Penggunaan (4 items)
  {
    key: 'int_1',
    indicator: 'INTENSITAS',
    indicatorLabel: 'Intensitas Penggunaan',
    statement: 'Saya menghabiskan waktu lebih lama di media sosial dibandingkan rencana awal yang saya buat.',
  },
  {
    key: 'int_2',
    indicator: 'INTENSITAS',
    indicatorLabel: 'Intensitas Penggunaan',
    statement: 'Saya langsung memeriksa media sosial sesaat setelah bangun tidur atau sebelum tidur malam.',
  },
  {
    key: 'int_3',
    indicator: 'INTENSITAS',
    indicatorLabel: 'Intensitas Penggunaan',
    statement: 'Saya sering membuka aplikasi media sosial berulang kali dalam jeda waktu yang singkat.',
  },
  {
    key: 'int_4',
    indicator: 'INTENSITAS',
    indicatorLabel: 'Intensitas Penggunaan',
    statement: 'Waktu luang saya lebih banyak diisi dengan menggulir (scrolling) media sosial daripada aktivitas luar layar.',
  },

  // 2. Dorongan atau Keinginan (4 items)
  {
    key: 'urg_1',
    indicator: 'DORONGAN',
    indicatorLabel: 'Dorongan atau Keinginan',
    statement: 'Saya merasa terdorong untuk segera membuka ponsel setiap kali mendengar atau melihat notifikasi.',
  },
  {
    key: 'urg_2',
    indicator: 'DORONGAN',
    indicatorLabel: 'Dorongan atau Keinginan',
    statement: 'Saya merasa kurang nyaman atau gelisah ketika tidak dapat mengakses media sosial selama beberapa jam.',
  },
  {
    key: 'urg_3',
    indicator: 'DORONGAN',
    indicatorLabel: 'Dorongan atau Keinginan',
    statement: 'Saya membuka media sosial secara otomatis tanpa tujuan khusus saat merasa bosan.',
  },
  {
    key: 'urg_4',
    indicator: 'DORONGAN',
    indicatorLabel: 'Dorongan atau Keinginan',
    statement: 'Saya sering memikirkan pembaruan atau unggahan terbaru di media sosial saat sedang beraktivitas.',
  },

  // 3. Dampak Sosial dan Emosi (4 items)
  {
    key: 'soc_1',
    indicator: 'SOSIAL_EMOSI',
    indicatorLabel: 'Dampak Sosial dan Emosi',
    statement: 'Suasana hati saya mudah terpengaruh oleh komentar, jumlah suka, atau unggahan orang lain di media sosial.',
  },
  {
    key: 'soc_2',
    indicator: 'SOSIAL_EMOSI',
    indicatorLabel: 'Dampak Sosial dan Emosi',
    statement: 'Saya pernah menunda percakapan langsung dengan keluarga atau teman karena masih asyik dengan media sosial.',
  },
  {
    key: 'soc_3',
    indicator: 'SOSIAL_EMOSI',
    indicatorLabel: 'Dampak Sosial dan Emosi',
    statement: 'Saya kadang membandingkan pencapaian atau penampilan diri dengan apa yang saya lihat di media sosial.',
  },
  {
    key: 'soc_4',
    indicator: 'SOSIAL_EMOSI',
    indicatorLabel: 'Dampak Sosial dan Emosi',
    statement: 'Saya merasa lelah secara emosional atau kurang bersemangat setelah berselancar terlalu lama di media sosial.',
  },

  // 4. Kontrol dan Dampak Negatif (4 items)
  {
    key: 'ctl_1',
    indicator: 'KONTROL_DAMPAK',
    indicatorLabel: 'Kontrol dan Dampak Negatif',
    statement: 'Tugas sekolah atau waktu belajar saya pernah tertunda karena keasyikan menggunakan media sosial.',
  },
  {
    key: 'ctl_2',
    indicator: 'KONTROL_DAMPAK',
    indicatorLabel: 'Kontrol dan Dampak Negatif',
    statement: 'Saya kesulitan berhenti menggunakan media sosial meskipun tahu waktu istirahat saya sudah tiba.',
  },
  {
    key: 'ctl_3',
    indicator: 'KONTROL_DAMPAK',
    indicatorLabel: 'Kontrol dan Dampak Negatif',
    statement: 'Saya pernah mencoba mengurangi durasi penggunaan media sosial, tetapi masih sering kembali ke kebiasaan lama.',
  },
  {
    key: 'ctl_4',
    indicator: 'KONTROL_DAMPAK',
    indicatorLabel: 'Kontrol dan Dampak Negatif',
    statement: 'Waktu tidur atau kebugaran saya terganggu akibat menggunakan media sosial hingga larut malam.',
  },
];

export function scoreAnswer(label: AnswerLabel): number {
  switch (label) {
    case 'SS':
      return 4;
    case 'S':
      return 3;
    case 'TS':
      return 2;
    case 'STS':
      return 1;
  }
}

export function evaluateAssessment(answers: Record<string, AnswerLabel>) {
  let intensityScore = 0;
  let urgeScore = 0;
  let socialEmotionScore = 0;
  let controlImpactScore = 0;

  const detailedAnswers = ASSESSMENT_QUESTIONS.map((q) => {
    const label = answers[q.key];
    const score = scoreAnswer(label);
    if (q.indicator === 'INTENSITAS') intensityScore += score;
    if (q.indicator === 'DORONGAN') urgeScore += score;
    if (q.indicator === 'SOSIAL_EMOSI') socialEmotionScore += score;
    if (q.indicator === 'KONTROL_DAMPAK') controlImpactScore += score;
    return {
      questionKey: q.key,
      indicator: q.indicator,
      statementText: q.statement,
      answerLabel: label,
      scoreValue: score,
    };
  });

  const totalScore = intensityScore + urgeScore + socialEmotionScore + controlImpactScore;
  const maxScore = ASSESSMENT_QUESTIONS.length * 4; // 64
  const ratio = totalScore / maxScore;

  let category = '';
  let summaryText = '';
  let reflectionSuggestion = '';

  if (ratio <= 0.4375) {
    // 16 - 28
    category = 'Kebiasaan Digital Seimbang';
    summaryText =
      'Hasil refleksi menunjukkan kebiasaan penggunaan media sosialmu saat ini tergolong seimbang. Kamu cukup mampu menjaga batas waktu dan memprioritaskan aktivitas belajar serta relasi sehari-hari.';
    reflectionSuggestion =
      'Pertahankan rutinitas positif yang sudah berjalan. Catat kebiasaan baikmu di Jurnal Refleksi dan bagikan tips manajemen waktu saat berdiskusi dengan teman atau Guru BK.';
  } else if (ratio <= 0.625) {
    // 29 - 40
    category = 'Perlu Penyesuaian Ringan';
    summaryText =
      'Kamu umumnya dapat mengelola aktivitas digital, namun pada beberapa situasi masih ada dorongan untuk membuka media sosial di luar rencana. Ini adalah hal yang wajar dan mudah disesuaikan.';
    reflectionSuggestion =
      'Coba buat satu target harian di menu Target Saya, misalnya menonaktifkan notifikasi saat sesi belajar 45 menit atau berhenti membuka gawai 30 menit sebelum tidur.';
  } else if (ratio <= 0.8125) {
    // 41 - 52
    category = 'Perlu Penguatan Kontrol Diri';
    summaryText =
      'Hasil Cek Diri menunjukkan penggunaan media sosial mulai cukup sering memengaruhi fokus, waktu istirahat, atau suasana hatimu. Mengenali pola ini adalah langkah awal yang baik untuk melakukan perubahan bertahap.';
    reflectionSuggestion =
      'Catat aktivitas harianmu di menu Catatan Penggunaan selama 3 hari ke depan untuk melihat aplikasi mana yang paling menyita waktu, lalu pilih materi di Pustaka Edukasi tentang Kontrol Diri.';
  } else {
    // 53 - 64
    category = 'Perlu Pendampingan Reflektif';
    summaryText =
      'Saat ini media sosial terasa cukup kuat menarik perhatian dan waktumu sehingga berdampak pada keseharian dan ketenangan diri. Ingat bahwa hasil ini bukan label medis atau diagnosis, melainkan sinyal untuk memberi perhatian lebih pada keseimbangan dirimu.';
    reflectionSuggestion =
      'Sangat disarankan untuk menuliskan perasaanmu di Jurnal Refleksi dan menjadwalkan obrolan santai bersama Guru BK melalui menu Hubungi Guru BK agar kamu mendapat dukungan yang tepat.';
  }

  return {
    totalScore,
    maxScore,
    category,
    intensityScore,
    urgeScore,
    socialEmotionScore,
    controlImpactScore,
    summaryText,
    reflectionSuggestion,
    detailedAnswers,
  };
}
