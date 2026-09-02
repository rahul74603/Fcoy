export interface Vendor {
  id: string;
  name: string;
  phone: string;
  address: string;
  categoryKey: string;
  categoryLabel: string;
  isActive: boolean;
  createdAt: string;
  notes: string;
}

export interface VendorItem {
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface BillAttachment {
  id: string;
  base64: string;       // DEPRECATED — kept for backward compat
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  // NEW: Storage fields
  downloadUrl?: string;
  storagePath?: string;
}

export interface VendorEntry {
  id: string;
  vendorId: string;
  vendorName: string;
  categoryKey: string;
  categoryLabel: string;
  items: VendorItem[];
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: 'Pending' | 'Partial' | 'Paid';
  entryDate: string;
  remarks: string;
  bills: BillAttachment[];
  createdBy: string;
}