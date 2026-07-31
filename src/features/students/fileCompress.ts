// ═══════════════════════════════════════════════════════════════════════════
// fileCompress.ts — Client-side PHOTO + PDF compressor (browser ke andar hi)
// Kyun: Cloudinary free quota bachani hai (25 credits/month = GB ke hisaab).
// Phone ki 3–8MB scans/PDF upload se pehle ~150KB–1MB ho jaati hain.
//
// SAFETY RULES (kabhi nuksan nahi):
//  1. Chhoti file ko chhedte hi nahi (skip thresholds).
//  2. Compress karke file BADI ho jaye to asli file hi return hoti hai.
//  3. Koi bhi error aaye (corrupt PDF/HEIC etc.) to asli file hi upload hoti hai.
//  4. pdfjs/pdf-lib sirf yahin lazy-load hote hain — main app fast rehti hai.
// ═══════════════════════════════════════════════════════════════════════════

// ── Tunables (ek jagah — badalna ho to yahan badlo) ────────────────────────
const IMAGE_SKIP_KB = 300;      // is se chhoti photo ko compress karne ka fayda nahi
const IMAGE_MAX_DIM = 1600;     // lamba side max pixels (document readability kaafi)
const IMAGE_QUALITY = 0.78;     // JPEG quality (0–1)

const PDF_SKIP_KB   = 1200;     // is se chhoti PDF waise hi upload (over-engineering nahi)
const PDF_MAX_DIM   = 1500;     // har render huye page ka max side (px)
const PDF_JPEG_Q    = 0.62;     // page-image quality
const PDF_MAX_PAGES = 50;       // runaway PDFs se bachne ki hadd

// ── Types ──────────────────────────────────────────────────────────────────
export interface PreparedFile {
  /** Jo file FINAL upload hogi (compressed ya asli). */
  file: File;
  /** true = file ko compress kiya gaya; false = asli file pass-through. */
  compressed: boolean;
  originalKB: number;
  finalKB: number;
}

const kb = (bytes: number) => Math.round(bytes / 1024);

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — upload se pehle har file yahin se guzarti hai
// ─────────────────────────────────────────────────────────────────────────────
export async function prepareFileForUpload(file: File): Promise<PreparedFile> {
  const originalKB = kb(file.size);
  try {
    if (file.type.startsWith('image/')) {
      return await compressImage(file, originalKB);
    }
    if (file.type === 'application/pdf') {
      return await compressPdf(file, originalKB);
    }
  } catch (compressErr) {
    // Compressor ka fail hona upload ko kabhi block nahi karega
    console.warn('[fileCompress] compression skip — asli file use ho rahi hai:', compressErr);
  }
  return { file, compressed: false, originalKB, finalKB: originalKB };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHOTO compression — Canvas API (koi dependency nahi)
// ─────────────────────────────────────────────────────────────────────────────
async function compressImage(file: File, originalKB: number): Promise<PreparedFile> {
  if (originalKB <= IMAGE_SKIP_KB) {
    return { file, compressed: false, originalKB, finalKB: originalKB };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);

    // Downscale ratio — kabhi upscale nahi
    const scale       = Math.min(1, IMAGE_MAX_DIM / Math.max(img.width, img.height));
    const targetW     = Math.max(1, Math.round(img.width * scale));
    const targetH     = Math.max(1, Math.round(img.height * scale));

    const canvas      = document.createElement('canvas');
    canvas.width      = targetW;
    canvas.height     = targetH;
    const ctx         = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context nahi mila');

    // PNG/WebP transparency JPEG me kaali na ho — pehle safed background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY)
    );
    if (!blob) throw new Error('image encode fail');

    // Kabhi badi nahi hone dena
    if (blob.size >= file.size) {
      return { file, compressed: false, originalKB, finalKB: originalKB };
    }

    const jpgName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    const out     = new File([blob], jpgName, { type: 'image/jpeg' });
    return { file: out, compressed: true, originalKB, finalKB: kb(out.size) };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('image decode fail (HEIC/corrupt?)'));
    img.src     = src;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF compression — har page ko optimized image bana kar nayi PDF
// (hamare use-case = phone se scan hui documents; isi ke liye perfect)
// pdfjs-dist + pdf-lib YAHIN dynamic import hote hain (lazy chunk).
// ─────────────────────────────────────────────────────────────────────────────
async function compressPdf(file: File, originalKB: number): Promise<PreparedFile> {
  if (originalKB <= PDF_SKIP_KB) {
    return { file, compressed: false, originalKB, finalKB: originalKB };
  }

  const [{ getDocument, GlobalWorkerOptions }, workerMod, { PDFDocument }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    import('pdf-lib'),
  ]);
  GlobalWorkerOptions.workerSrc = workerMod.default;

  const data     = await file.arrayBuffer();
  const srcDoc   = await getDocument({ data }).promise;
  const outDoc   = await PDFDocument.create();

  try {
    const pageCount = Math.min(srcDoc.numPages, PDF_MAX_PAGES);

    for (let pageNo = 1; pageNo <= pageCount; pageNo++) {
      const page   = await srcDoc.getPage(pageNo);
      const baseVp = page.getViewport({ scale: 1 });
      const scale  = Math.min(2, PDF_MAX_DIM / Math.max(baseVp.width, baseVp.height));
      const vp     = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width  = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas 2d context nahi mila');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', PDF_JPEG_Q)
      );
      if (!blob) throw new Error(`page ${pageNo} encode fail`);

      const jpgBytes = await blob.arrayBuffer();
      const jpg      = await outDoc.embedJpg(jpgBytes);
      const outPage  = outDoc.addPage([canvas.width, canvas.height]);
      outPage.drawImage(jpg, { x: 0, y: 0, width: canvas.width, height: canvas.height });

      page.cleanup();
      // canvas GC ke liye chhota karo (mobile RAM bachao)
      canvas.width = 1;
      canvas.height = 1;
    }

    const rawBytes = await outDoc.save();
    if (rawBytes.byteLength >= file.size) {
      // text-based PDF waghera jahan image-banana mehenga pade — asli hi bhejo
      return { file, compressed: false, originalKB, finalKB: originalKB };
    }

    // plain ArrayBuffer copy (TS BlobPart typing ke liye zaroori)
    const outBytes = new Uint8Array(rawBytes.byteLength);
    outBytes.set(rawBytes);
    const out = new File([outBytes.buffer as ArrayBuffer], file.name, {
      type: 'application/pdf',
    });
    return { file: out, compressed: true, originalKB, finalKB: kb(out.size) };
  } finally {
    await srcDoc.destroy();
  }
}
