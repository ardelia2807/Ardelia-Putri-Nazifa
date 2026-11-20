import React, { useState } from 'react';
import { Image as ImageIcon, Download, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';

export function ImageStudioPanel({
  onSelectGeneratedUrl,
}: {
  onSelectGeneratedUrl?: (url: string) => void;
}) {
  const [prompt, setPrompt] = useState(
    'Pelajar menata waktu belajar dengan buku catatan, tanaman hijau, dan jam istirahat yang seimbang jauh dari notifikasi ponsel'
  );
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [aspectRatio, setAspectRatio] = useState<'4:3' | '16:9' | '1:1'>('4:3');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ imageUrl: string; imageSize: string; aspectRatio: string }>(
        '/api/ai/generate-image',
        {
          method: 'POST',
          body: JSON.stringify({ prompt, imageSize, aspectRatio }),
        }
      );
      setGeneratedUrl(res.imageUrl);
      if (onSelectGeneratedUrl) {
        onSelectGeneratedUrl(res.imageUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat gambar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Studio Ilustrasi Edukasi &amp; Papan Motivasi
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Buat ilustrasi edukasi atau visual target pribadi resolusi tinggi (1K, 2K, 4K) dengan gemini-3-pro-image-preview.
          </p>
        </div>
      </div>

      <form onSubmit={handleGenerate} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Deskripsi Ilustrasi
          </label>
          <textarea
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Contoh: Ilustrasi siswa membaca buku di taman yang tenang dengan jam belajar teratur..."
            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1.5">
              Ukuran Resolusi Gambar
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
              {(['1K', '2K', '4K'] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setImageSize(size)}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    imageSize === size
                      ? 'bg-white text-violet-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1.5">
              Rasio Aspek
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
              {(['4:3', '16:9', '1:1'] as const).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    aspectRatio === ratio
                      ? 'bg-white text-violet-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium rounded-lg inline-flex items-center gap-2 disabled:opacity-50"
          >
            <ImageIcon className="w-4 h-4" />
            <span>{loading ? `Membuat Gambar (${imageSize})...` : `Buat Ilustrasi (${imageSize})`}</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {generatedUrl && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
          <img
            src={generatedUrl}
            alt="Hasil ilustrasi DIGITAL BALANCE"
            className="w-full max-h-80 object-contain bg-white"
            referrerPolicy="no-referrer"
          />
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>Resolusi: {imageSize} · Rasio {aspectRatio}</span>
            <a
              href={generatedUrl}
              download={`digital-balance-${imageSize.toLowerCase()}.png`}
              className="inline-flex items-center gap-1.5 font-semibold text-violet-700 hover:underline"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Gambar</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
