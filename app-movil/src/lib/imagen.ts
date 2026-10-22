/*
 * 📷 Fotos mas livianas antes de subirlas: una foto del iPhone (3–6 MB)
 * queda en ~300–700 KB, legible y con calidad de documento (cedulas,
 * licencias, carros, recibos). Asi el espacio gratis rinde 5 a 10 veces mas.
 * PDF, Word, Excel, videos, etc. NO se tocan.
 */

export const LADO_MAX = 2000;   // px del lado mas largo (se leen bien textos y placas)
export const CALIDAD = 0.82;
const MIN_BYTES = 350 * 1024;   // las fotos ya livianas se dejan igual

const K_PREF = 'jac_comprimir_fotos';
export function comprimirActivo(): boolean {
  try { return localStorage.getItem(K_PREF) !== 'no'; } catch { return true; }
}
export function setComprimir(si: boolean) {
  try { localStorage.setItem(K_PREF, si ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
}

export const esFoto = (f: { type?: string; name?: string }) =>
  /^image\/(jpe?g|png|webp|heic|heif)$/i.test(f.type || '') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name || '');

/** Medidas finales manteniendo la proporcion */
export function medidas(w: number, h: number, max = LADO_MAX): { w: number; h: number } {
  const m = Math.max(w, h);
  if (m <= max) return { w, h };
  const k = max / m;
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

async function decodificar(f: Blob): Promise<{ img: CanvasImageSource; w: number; h: number; cerrar: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const b = await createImageBitmap(f, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { img: b, w: b.width, h: b.height, cerrar: () => b.close() };
    } catch { /* algunos formatos (HEIC) solo los abre <img> en Safari */ }
  }
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return { img, w: img.naturalWidth, h: img.naturalHeight, cerrar: () => URL.revokeObjectURL(url) };
}

/** Devuelve la foto comprimida en JPEG, o el mismo archivo si no conviene o no se puede */
export async function comprimirFoto(f: File): Promise<File> {
  if (!comprimirActivo() || !esFoto(f) || f.size < MIN_BYTES || typeof document === 'undefined') return f;
  try {
    const d = await decodificar(f);
    const { w, h } = medidas(d.w, d.h);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (!g) { d.cerrar(); return f; }
    g.fillStyle = '#fff';            // PNG con transparencia: fondo blanco, no negro
    g.fillRect(0, 0, w, h);
    g.drawImage(d.img, 0, 0, w, h);
    d.cerrar();
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', CALIDAD));
    if (!blob || blob.size >= f.size * 0.9) return f;
    const nombre = f.name.replace(/\.(jpe?g|png|webp|heic|heif)$/i, '') + '.jpg';
    return new File([blob], nombre, { type: 'image/jpeg', lastModified: f.lastModified });
  } catch {
    return f; // si no se puede, se sube la original: nunca se pierde el archivo
  }
}
