// ═══════════════════════════════════════════════════════════
// STOCK ENGINE — Inventory ka ASLI hisaab 📦
// ───────────────────────────────────────────────────────────
// ZAROORI SAMAJHNE WALI BAAT:
//   Is ERP me stock kahin "store" nahi hota. `item_master`
//   collection khaali hai (purani legacy). Asli stock COMPUTE
//   hota hai, bilkul wahi tarike se jaise QM screen karti hai:
//
//     Training items:  training_fund_expenses (kharida)
//                    − issue_records (trainees ko diya)
//                    = balance stock
//
//     Company assets:  company_assets_expenses (kharida)
//                      (ye issue nahi hote — furniture waghairah)
//
//   AI ko agar sirf `item_master` padhne dete to hamesha
//   "0 records" milta — jo user ne dekha bhi.
// ═══════════════════════════════════════════════════════════

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';

export interface SizeStock {
  size: string;
  purchased: number;
  issued: number;
  returned: number;
  balance: number;
}

export interface StockItem {
  itemName: string;
  category: string;
  kind: 'training' | 'asset';
  purchased: number;
  issued: number;
  returned: number;   // ★ Good-condition returns (stock wapas)
  damaged: number;    // ★ Damage write-off (stock mein nahi aata)
  balance: number;
  totalValue: number;
  unitPrice: number;
  sizes: SizeStock[];
}

export interface StockReport {
  items: StockItem[];
  totals: {
    distinctItems: number;
    totalPurchased: number;
    totalIssued: number;
    totalBalance: number;
    totalValue: number;
  };
  sources: string[];
  note: string;
}

// ─────────────────────────────────────────────
const norm = (v: any) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const num  = (v: any) => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

const isAssetLike = (category?: string, name?: string) => {
  const c = (category || '').toLowerCase();
  const n = (name || '').toLowerCase();
  return c.includes('asset') || n.includes('asset');
};

// QM screen ka fixed catalog (yahi list InventoryIssueScreen me hai)
const FIXED_ITEMS: { name: string; category: string }[] = [
  { name: 'DM Shoes',     category: 'Footwear'  },
  { name: 'PT Shoes',     category: 'Footwear'  },
  { name: 'Ankle Shoes',  category: 'Footwear'  },
  { name: 'PT T-Shirt',   category: 'Uniform'   },
  { name: 'Ground Sheet', category: 'Bedding'   },
  { name: 'Plate',        category: 'Mess Item' },
  { name: 'Glass',        category: 'Mess Item' },
  { name: 'Bucket',       category: 'Equipment' },
  { name: 'Mug',          category: 'Mess Item' },
  { name: 'Mess Tin',     category: 'Mess Item' },
  { name: 'Mosquito Net', category: 'Bedding'   },
  { name: 'Water Bottle', category: 'Equipment' },
  { name: 'Towel',        category: 'Equipment' },
  { name: 'Lock',         category: 'Equipment' },
];

// 60s cache
let cache: { at: number; report: StockReport } | null = null;
export const clearStockCache = () => { cache = null; };

const safeGet = async (name: string): Promise<any[]> => {
  try {
    const snap = await getDocs(collection(db, name));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn(`stockEngine: ${name} padh nahi paaya`, e);
    return [];
  }
};

// ═══════════════════════════════════════════════════════════
export async function buildStockReport(): Promise<StockReport> {
  if (cache && Date.now() - cache.at < 60_000) return cache.report;

  const [customItems, trainingExp, assetExp, issues, assetCustom, returns] = await Promise.all([
    safeGet('training_custom_items'),
    safeGet('training_fund_expenses'),
    safeGet('company_assets_expenses'),
    safeGet('issue_records'),
    safeGet('company_assets_custom_items'),
    safeGet('stock_returns'), // ★ Return Register
  ]);

  // ── Catalog: fixed + custom ──
  const catalog = new Map<string, { name: string; category: string }>();
  FIXED_ITEMS.forEach(i => catalog.set(norm(i.name), i));
  customItems.forEach(c => {
    const n = String(c.name ?? '').trim();
    if (n) catalog.set(norm(n), { name: n, category: c.category ?? 'Other' });
  });
  assetCustom.forEach(c => {
    const n = String(c.name ?? '').trim();
    if (n && !catalog.has(norm(n))) catalog.set(norm(n), { name: n, category: c.category ?? 'Asset' });
  });

  // ── PURCHASED (training fund) ──
  interface Agg {
    itemName: string; qty: number; value: number; unitPrice: number;
    sizes: Record<string, number>; kind: 'training' | 'asset';
  }
  const purchased = new Map<string, Agg>();

  const addPurchase = (d: any, kind: 'training' | 'asset') => {
    const itemName = String(d.itemName ?? '').trim();
    if (!itemName) return;
    const key = norm(itemName);
    if (!purchased.has(key)) {
      purchased.set(key, {
        itemName, qty: 0, value: 0, unitPrice: 0, sizes: {}, kind,
      });
    }
    const a = purchased.get(key)!;
    a.qty   += num(d.quantity ?? 0);
    a.value += num(d.amount ?? 0);
    const up = num(d.unitPrice);
    if (up > 0) a.unitPrice = up;

    const sizes = Array.isArray(d.sizes) ? d.sizes : [];
    sizes.forEach((s: any) => {
      const sz = String(s.size ?? '').trim();
      const q  = num(s.quantity);
      if (sz && q > 0) a.sizes[sz] = (a.sizes[sz] ?? 0) + q;
    });
  };

  trainingExp.forEach(d => addPurchase(d, 'training'));
  assetExp.forEach(d => addPurchase(d, 'asset'));

  // ── ISSUED (trainees ko diya gaya) ──
  const issued = new Map<string, { qty: number; sizes: Record<string, number> }>();
  issues.forEach(d => {
    const items = Array.isArray(d.issuedItems) ? d.issuedItems
                : Array.isArray(d.items)       ? d.items : [];
    items.forEach((it: any) => {
      const itemName = String(it.itemName ?? it.name ?? '').trim();
      if (!itemName) return;
      const key = norm(itemName);
      if (!issued.has(key)) issued.set(key, { qty: 0, sizes: {} });
      const a = issued.get(key)!;
      a.qty += num(it.quantity ?? 1);
      const sz = String(it.assignedSize ?? it.size ?? '').trim();
      if (sz && sz !== 'N/A') a.sizes[sz] = (a.sizes[sz] ?? 0) + num(it.quantity ?? 1);
    });
  });

  // ── ★ RETURNS (Good = stock wapas, Damaged = write-off) ──
  const returned = new Map<string, { good: number; damaged: number; sizes: Record<string, number> }>();
  returns.forEach(d => {
    const itemName = String(d.itemName ?? '').trim();
    if (!itemName) return;
    const key = norm(itemName);
    if (!returned.has(key)) returned.set(key, { good: 0, damaged: 0, sizes: {} });
    const a = returned.get(key)!;
    const q = num(d.quantity ?? 1);
    if ((d.condition ?? 'Good') === 'Good') {
      a.good += q;
      const sz = String(d.assignedSize ?? '').trim();
      if (sz && sz !== 'N/A') a.sizes[sz] = (a.sizes[sz] ?? 0) + q;
    } else {
      a.damaged += q;
    }
  });

  // ── MERGE ──
  const allKeys = new Set<string>([...catalog.keys(), ...purchased.keys()]);
  const items: StockItem[] = [];

  allKeys.forEach(key => {
    const meta = catalog.get(key);
    const p    = purchased.get(key);
    const i    = issued.get(key);
    const r    = returned.get(key);

    const itemName = p?.itemName ?? meta?.name ?? key;
    const category = meta?.category ?? (p?.kind === 'asset' ? 'Asset' : 'Other');
    const kind: 'training' | 'asset' =
      p?.kind ?? (isAssetLike(category, itemName) ? 'asset' : 'training');

    const sizeKeys = new Set<string>([
      ...Object.keys(p?.sizes ?? {}),
      ...Object.keys(i?.sizes ?? {}),
      ...Object.keys(r?.sizes ?? {}),
    ]);
    // ★ Balance = purchased − issued + good-returns
    const sizes: SizeStock[] = Array.from(sizeKeys).map(sz => {
      const pq = p?.sizes[sz] ?? 0;
      const iq = i?.sizes[sz] ?? 0;
      const rq = r?.sizes[sz] ?? 0;
      return { size: sz, purchased: pq, issued: iq, returned: rq, balance: pq - iq + rq };
    }).sort((a, b) => a.size.localeCompare(b.size));

    const pq = p?.qty ?? 0;
    const iq = i?.qty ?? 0;
    const rq = r?.good ?? 0;
    const dq = r?.damaged ?? 0;

    items.push({
      itemName, category, kind,
      purchased: pq,
      issued: iq,
      returned: rq,
      damaged: dq,
      balance: pq - iq + rq,
      totalValue: p?.value ?? 0,
      unitPrice: p?.unitPrice ?? 0,
      sizes,
    });
  });

  items.sort((a, b) => b.purchased - a.purchased || a.itemName.localeCompare(b.itemName));

  const report: StockReport = {
    items,
    totals: {
      distinctItems: items.length,
      totalPurchased: items.reduce((s, x) => s + x.purchased, 0),
      totalIssued:    items.reduce((s, x) => s + x.issued, 0),
      totalBalance:   items.reduce((s, x) => s + x.balance, 0),
      totalValue:     items.reduce((s, x) => s + x.totalValue, 0),
    },
    sources: [
      `training_fund_expenses (${trainingExp.length})`,
      `company_assets_expenses (${assetExp.length})`,
      `issue_records (${issues.length})`,
      `stock_returns (${returns.length})`,
      `training_custom_items (${customItems.length})`,
    ],
    note:
      'Stock COMPUTED hai: purchases − issues + good-returns (damaged returns write-off hain). ' +
      '`item_master` collection khaali hai (legacy) — usse mat padho.',
  };

  cache = { at: Date.now(), report };
  return report;
}

/** Naam se stock dhoondo (partial match) */
export async function findStock(itemQuery?: string, sizeQuery?: string): Promise<StockReport> {
  const full = await buildStockReport();
  if (!itemQuery && !sizeQuery) return full;

  const q = norm(itemQuery ?? '');
  let items = q
    ? full.items.filter(i =>
        norm(i.itemName).includes(q) ||
        q.split(' ').some(w => w.length > 2 && norm(i.itemName).includes(w)))
    : full.items;

  // Size filter: "M size t-shirt" jaise sawaal ke liye
  if (sizeQuery) {
    const sq = String(sizeQuery).trim().toUpperCase();
    items = items
      .filter(i => i.sizes.some(s => s.size.toUpperCase() === sq))
      .map(i => ({ ...i, sizes: i.sizes.filter(s => s.size.toUpperCase() === sq) }));
  }

  return {
    items,
    totals: {
      distinctItems: items.length,
      totalPurchased: items.reduce((s, x) => s + x.purchased, 0),
      totalIssued:    items.reduce((s, x) => s + x.issued, 0),
      totalBalance:   items.reduce((s, x) => s + x.balance, 0),
      totalValue:     items.reduce((s, x) => s + x.totalValue, 0),
    },
    sources: full.sources,
    note: items.length === 0
      ? `"${itemQuery}" naam ka koi item nahi mila. Available: ` +
        full.items.slice(0, 15).map(i => i.itemName).join(', ')
      : full.note,
  };
}
