import { Router } from 'express';
import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { requireAuth, type AuthedRequest } from '../auth.ts';

export const aiRoutes = Router();

aiRoutes.use(requireAuth);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi pada panel Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const ALLOWED_CHAT_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-4-carbon',
  'gemini-4-neon',
  'gemini-3.1-flash-lite',
]);

interface ChatMessageInput {
  role: 'user' | 'model';
  text: string;
}

aiRoutes.post('/chat', async (req: AuthedRequest, res) => {
  const { message, history, model, mode } = req.body as {
    message?: string;
    history?: ChatMessageInput[];
    model?: string;
    mode?: 'REFLEKSI' | 'GURU_BK' | 'CEPAT';
  };

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
  }

  const chosenModel = model && ALLOWED_CHAT_MODELS.has(model) ? model : 'gemini-4-hydrogen';

  let systemInstruction =
    'Kamu adalah Teman Refleksi DIGITAL BALANCE, pendamping refleksi kebiasaan media sosial dan manajemen waktu untuk pelajar Indonesia. Gunakan bahasa Indonesia yang hangat, suportif, tidak menghakimi, ringkas, dan praktis. Kamu BUKAN psikolog klinis dan tidak boleh memberikan diagnosis medis atau psikologis; bila pengguna menunjukkan tekanan berat, sarankan dengan lembut untuk menghubungi Guru BK di sekolahnya melalui menu Hubungi Guru BK.';

  if (req.authUser?.role === 'GURU_BK' || mode === 'GURU_BK') {
    systemInstruction =
      'Kamu adalah Asisten Layanan Bimbingan & Konseling DIGITAL BALANCE bagi Guru BK sekolah. Bantu Guru BK merancang ide layanan klasikal, materi edukasi literasi digital, dan panduan refleksi non-diagnostik untuk peserta didik dalam bahasa Indonesia yang profesional dan empatik.';
  } else if (req.authUser?.role === 'ADMIN_CENTRAL') {
    systemInstruction =
      'Kamu adalah Asisten Perencanaan Program DIGITAL BALANCE untuk Admin Central. Bantu menyusun ringkasan kebijakan literasi digital sekolah, panduan implementasi multi-sekolah, dan ide materi edukasi.';
  }

  try {
    const ai = getAiClient();
    const formattedHistory = Array.isArray(history)
      ? history
          .filter((h) => (h.role === 'user' || h.role === 'model') && typeof h.text === 'string' && h.text.trim())
          .map((h) => ({
            role: h.role,
            parts: [{ text: h.text }],
          }))
      : [];

    const chat = ai.chats.create({
      model: chosenModel,
      config: {
        systemInstruction,
      },
      history: formattedHistory,
    });

    let response: GenerateContentResponse | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await chat.sendMessage({
          message: message.trim(),
        });
        break;
      } catch (innerErr: unknown) {
        const msg = innerErr instanceof Error ? innerErr.message : String(innerErr);
        if (attempt === 0 && (msg.includes('503') || msg.includes('UNAVAILABLE'))) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        throw innerErr;
      }
    }

    res.json({
      reply: response?.text ?? 'Maaf, belum ada respons yang dihasilkan.',
      model: chosenModel,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Gemini Chat error:', errMsg);
    if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE')) {
      return res.status(503).json({
        error: 'Layanan model AI sedang mengalami antrean tinggi. Silakan coba kirim ulang beberapa saat lagi atau pilih mode Gemini 3.1 Flash Lite.',
      });
    }
    if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
      return res.status(429).json({
        error:
          'Kuota model ini sedang penuh atau memerlukan API Key berbayar di Settings > Secrets. Anda dapat beralih ke mode Umum (gemini-4-hydrogen) atau Cepat (gemini-3.1-flash-lite).',
      });
    }
    if (errMsg.includes('API_KEY') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('403')) {
      return res.status(403).json({
        error: 'Kunci API Gemini belum aktif atau tidak memiliki izin untuk model ini. Periksa panel Settings > Secrets.',
      });
    }
    res.status(500).json({ error: errMsg || 'Terjadi kendala saat menghubungi asisten Gemini.' });
  }
});

aiRoutes.post('/generate-image', async (req: AuthedRequest, res) => {
  const { prompt, imageSize, aspectRatio } = req.body as {
    prompt?: string;
    imageSize?: string;
    aspectRatio?: string;
  };

  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'Deskripsi ilustrasi (prompt) wajib diisi.' });
  }

  const allowedSizes = new Set(['1K', '2K', '4K']);
  const allowedRatios = new Set(['1:1', '3:4', '4:3', '9:16', '16:9']);
  const chosenSize = imageSize && allowedSizes.has(imageSize) ? imageSize : '1K';
  const chosenRatio = aspectRatio && allowedRatios.has(aspectRatio) ? aspectRatio : '4:3';

  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            text: `Clean modern educational illustration in a calm violet (#6D28D9) and slate palette for school digital wellness counseling: ${prompt.trim()}`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: chosenRatio,
          imageSize: chosenSize,
        },
      },
    });

    let imageDataUrl = '';
    let noteText = '';
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? 'image/png';
        imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
      } else if (part.text) {
        noteText += part.text;
      }
    }

    if (!imageDataUrl) {
      return res.status(502).json({ error: 'Model tidak mengembalikan data gambar. Coba ubah deskripsi prompt.' });
    }

    res.json({
      imageUrl: imageDataUrl,
      imageSize: chosenSize,
      aspectRatio: chosenRatio,
      model: 'gemini-3-pro-image-preview',
      note: noteText,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Gemini Image Generation error:', errMsg);
    if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('403')) {
      return res.status(403).json({
        error:
          'Model gemini-3-pro-image-preview memerlukan API Key dengan penagihan aktif pada panel Settings > Secrets.',
      });
    }
    res.status(500).json({ error: errMsg || 'Gagal membuat ilustrasi gambar.' });
  }
});
