// src/features/quartermaster/qmCatalog.ts
// ═══════════════════════════════════════════════════════════════
// 📦 QM ITEM MASTER — SINGLE SOURCE OF TRUTH (code-level)
//
// Pehle ye list DO jagah hardcoded thi (InventoryIssueScreen +
// TraineeProfileScreen) — dono me drift ka risk tha. Ab dono screens
// YAHI module import karti hain.
//
// Dynamic items ka flow waisa hi hai:
//   FIXED_TRAINING_ITEMS (base kit)  +  training_custom_items (Firestore)
//        ↓
//   Inventory / Issue / Trainee Profile / Reports
//
// ⚠️ Item names/ids MAT badlo — purane issue_records aur trainees ke
// issuedKitItems inhi naamo se match hote hain (backward compatibility).
// ═══════════════════════════════════════════════════════════════

export const SHOE_SIZES  = ['5', '6', '7', '8', '9', '10', '11', '12', '13'];
export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export interface BaseTrainingItem {
  id: string;
  name: string;
  emoji: string;
  category: string;
  hasSizes?: boolean;
  sizeOptions?: string[];
  isCustom?: boolean;
}

export const FIXED_TRAINING_ITEMS: BaseTrainingItem[] = [
  { id: 'dm-shoes',     name: 'DM Shoes',     emoji: '👞', category: 'Footwear',  hasSizes: true, sizeOptions: SHOE_SIZES  },
  { id: 'pt-shoes',     name: 'PT Shoes',     emoji: '👟', category: 'Footwear',  hasSizes: true, sizeOptions: SHOE_SIZES  },
  { id: 'ankle-shoes',  name: 'Ankle Shoes',  emoji: '🥾', category: 'Footwear',  hasSizes: true, sizeOptions: SHOE_SIZES  },
  { id: 'pt-t-shirt',   name: 'PT T-Shirt',   emoji: '👕', category: 'Uniform',   hasSizes: true, sizeOptions: SHIRT_SIZES },
  { id: 'ground-sheet', name: 'Ground Sheet', emoji: '🛏️', category: 'Bedding'   },
  { id: 'plate',        name: 'Plate',        emoji: '🍽️', category: 'Mess Item' },
  { id: 'glass',        name: 'Glass',        emoji: '🥤', category: 'Mess Item' },
  { id: 'bucket',       name: 'Bucket',       emoji: '🪣', category: 'Equipment' },
  { id: 'mug',          name: 'Mug',          emoji: '☕', category: 'Mess Item' },
  { id: 'mess-tin',     name: 'Mess Tin',     emoji: '🥫', category: 'Mess Item' },
  { id: 'mosquito-net', name: 'Mosquito Net', emoji: '🦟', category: 'Bedding'   },
  { id: 'water-bottle', name: 'Water Bottle', emoji: '💧', category: 'Equipment' },
  { id: 'towel',        name: 'Towel',        emoji: '🧻', category: 'Equipment' },
  { id: 'lock',         name: 'Lock',         emoji: '🔒', category: 'Equipment' },
];

/** Simplified view (name/emoji/category) — Trainee Profile kit-status ke liye */
export const QM_FIXED_ITEMS = FIXED_TRAINING_ITEMS.map(({ name, emoji, category }) => ({
  name, emoji, category,
}));

/** Naam normalize — issue records/catalog match isi se hota hai */
export const normalizeItemName = (v: string): string =>
  (v || '').trim().toLowerCase().replace(/\s+/g, ' ');
