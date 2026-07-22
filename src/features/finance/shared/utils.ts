// D:\ALL PROJECTS\BSF COYs\frontend\src\features\finance\shared\utils.ts

// ─────────────────────────────────────────────
// CURRENCY & DATE FORMATTERS
// ─────────────────────────────────────────────
export const formatCurrency = (n: number): string =>
  `₹${Math.abs(n).toLocaleString('en-IN')}`;

export const formatDate = (iso: string): string =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—';

export const formatMonth = (m: string): string =>
  m
    ? new Date(m + '-01').toLocaleDateString('en-IN', {
        month: 'long', year: 'numeric',
      })
    : '—';

export const formatDateTime = (iso: string): string =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

export const currentMonthStr = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const generateMonthOptions = (
  count = 12
): { value: string; label: string }[] => {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', {
      month: 'long', year: 'numeric',
    });
    months.push({ value, label });
  }
  return months;
};

// ─────────────────────────────────────────────
// FILE SIZE FORMATTER
// ─────────────────────────────────────────────
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// ─────────────────────────────────────────────
// IMAGE COMPRESSION
// ─────────────────────────────────────────────
export const compressImage = (
  file: File,
  maxSizeKB = 700
): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1600;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas not supported');
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.9;
        let base64 = canvas.toDataURL('image/jpeg', quality);
        while (
          base64.length > maxSizeKB * 1024 * 1.37 &&
          quality > 0.1
        ) {
          quality -= 0.1;
          base64 = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(base64);
      };
      img.onerror = () => reject('Image load failed');
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject('File read failed');
    reader.readAsDataURL(file);
  });

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject('File read failed');
    reader.readAsDataURL(file);
  });

// ─────────────────────────────────────────────
// BILL FILE CONSTANTS
// ─────────────────────────────────────────────
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

export const MAX_FILE_SIZE     = 5 * 1024 * 1024;  // 5MB
export const MAX_PDF_SIZE      = 800 * 1024;        // 800KB
export const MAX_BASE64_SIZE   = 800 * 1024;        // 800KB for Firestore

// ─────────────────────────────────────────────
// BILL PROCESSING (used in multiple screens)
// ─────────────────────────────────────────────
export interface ProcessedBill {
  billBase64:   string;
  billFileName: string;
  billFileType: string;
  billFileSize: number;
}

export const processBillFile = async (
  file: File
): Promise<{ data: ProcessedBill | null; error: string | null }> => {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return { data: null, error: 'Sirf PDF, JPG, PNG, WEBP allowed hai' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      data: null,
      error: `File ${formatFileSize(file.size)} hai. Max 5MB allowed.`,
    };
  }

  try {
    let base64: string;
    const isPdf = file.type === 'application/pdf';

    if (isPdf) {
      if (file.size > MAX_PDF_SIZE) {
        return {
          data: null,
          error: `PDF ${formatFileSize(file.size)} hai. Max 800KB allowed.`,
        };
      }
      base64 = await fileToBase64(file);
    } else {
      base64 = await compressImage(file, 700);
    }

    // Final size check
    const base64Bytes = Math.round((base64.length * 3) / 4);
    if (base64Bytes > MAX_BASE64_SIZE) {
      return {
        data: null,
        error: `Compress ke baad bhi ${formatFileSize(base64Bytes)} hai. Chhoti file dein.`,
      };
    }

    return {
      data: {
        billBase64:   base64,
        billFileName: file.name,
        billFileType: file.type,
        billFileSize: file.size,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: `File process nahi hua: ${String(err)}` };
  }
};

// ─────────────────────────────────────────────
// MESS FUND CATEGORIES (Single Source of Truth)
// ─────────────────────────────────────────────
export interface MessCategory {
  key:     string;
  label:   string;
  emoji:   string;
  hint:    string;
  isFixed: boolean;  // false = user created custom
}

export const FIXED_MESS_CATEGORIES: MessCategory[] = [
  { key: 'atta_chakki',       label: 'Atta Chakki',       emoji: '🏭', hint: 'Gehun pisai, atta',                                          isFixed: true },
  { key: 'ration_store',      label: 'Ration Store',       emoji: '🏪', hint: 'Mirch, masale, tomato sauce, eggs, oil, dal, rice, sugar',   isFixed: true },
  { key: 'milk_parlour',      label: 'Milk Parlour',       emoji: '🥛', hint: 'Butter, paneer, bread, lassi, ice cream, milk, curd',        isFixed: true },
  { key: 'meat_shop',         label: 'Meat Shop',          emoji: '🍖', hint: 'Chicken, mutton, fish',                                      isFixed: true },
  { key: 'fresh_vegetables',  label: 'Fresh Vegetables',   emoji: '🥬', hint: 'All type vegetables — aloo, pyaaz, tamatar etc.',            isFixed: true },
  { key: 'gas_cylinder',      label: 'Gas Cylinder',       emoji: '⛽', hint: 'LPG gas cylinders',                                          isFixed: true },
];

// ─────────────────────────────────────────────
// VENDOR CATEGORIES (for vendor management)
// ─────────────────────────────────────────────
export const VENDOR_MESS_CATEGORY_KEYS = [
  'atta_chakki',
  'ration_store',
  'milk_parlour',
  'meat_shop',
  'fresh_vegetables',
  'gas_cylinder',
];

// ─────────────────────────────────────────────
// NUMBER HELPERS
// ─────────────────────────────────────────────
export const safeNumber = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
};

export const clamp = (
  val: number,
  min: number,
  max: number
): number => Math.max(min, Math.min(max, val));