// ═══════════════════════════════════════════════════════════
// COLLECTION REGISTRY — AI ka "Firebase Map" 🗺️
// ───────────────────────────────────────────────────────────
// Ye file AI ko batati hai ki poore Firestore me kya kya hai.
// Har collection ka: naam, matlab, fields, synonyms (Hindi+English),
// batch-scope, aur numeric fields (sum karne ke liye).
//
// Naya collection bane to bas yahan ek entry add karo —
// AI apne aap use padhne lagega. Koi code change nahi.
// ═══════════════════════════════════════════════════════════

export type FieldKind =
  | 'text' | 'number' | 'currency' | 'date' | 'bool'
  | 'enum' | 'id' | 'array' | 'object';

export interface FieldDef {
  name: string;
  kind: FieldKind;
  label: string;
  /** enum ke possible values */
  values?: string[];
  /** is field ko dhoondne ke liye Hindi/Hinglish shabd */
  synonyms?: string[];
}

export interface CollectionDef {
  /** Firestore collection ka exact naam */
  name: string;
  /** AI ko samjhane ke liye */
  description: string;
  /** Hindi/Hinglish shabd jinse user is collection ko bulata hai */
  synonyms: string[];
  /** kya isme batchId field hai (active batch se filter karna hai) */
  batchScoped: boolean;
  /** trainee se jodne wali field (cross-collection join) */
  linkField?: string;
  /** display ke liye main field */
  titleField?: string;
  fields: FieldDef[];
  /** ye collection kis domain ka hai */
  domain: 'trainee' | 'staff' | 'finance' | 'inventory' | 'training' | 'system';
  /** kitne documents tak fetch karna safe hai */
  maxDocs?: number;
}

// ─────────────────────────────────────────────
// SHARED FIELD SETS
// ─────────────────────────────────────────────
const MONEY = (name: string, label: string, syn: string[] = []): FieldDef =>
  ({ name, kind: 'currency', label, synonyms: ['rupaye', 'paisa', 'amount', ...syn] });

const DATEF = (name: string, label: string): FieldDef =>
  ({ name, kind: 'date', label, synonyms: ['date', 'tareekh', 'kab'] });

// ═══════════════════════════════════════════════════════════
// THE REGISTRY
// ═══════════════════════════════════════════════════════════
export const COLLECTIONS: CollectionDef[] = [

  // ══════════════ TRAINEE DOMAIN ══════════════
  {
    name: 'trainees',
    description: 'Saare recruits/trainees ki master list — personal, address, training, medical, kit sab kuch',
    synonyms: ['trainee', 'trainees', 'recruit', 'rangroot', 'jawan', 'bacche', 'student',
               'candidate', 'strength', 'nafri', 'log', 'aadmi', 'ladke'],
    batchScoped: true,
    linkField: 'chestNo',
    titleField: 'name',
    domain: 'trainee',
    maxDocs: 2000,
    fields: [
      { name: 'name',        kind: 'text', label: 'Name',        synonyms: ['naam', 'name'] },
      { name: 'chestNo',     kind: 'id',   label: 'Chest No',    synonyms: ['chest', 'chest no', 'seena', 'number'] },
      { name: 'regNo',       kind: 'id',   label: 'Reg No',      synonyms: ['registration', 'reg'] },
      { name: 'fatherName',  kind: 'text', label: 'Father Name', synonyms: ['pita', 'father', 'baap'] },
      { name: 'motherName',  kind: 'text', label: 'Mother Name', synonyms: ['mata', 'mother'] },
      { name: 'state',       kind: 'text', label: 'State',       synonyms: ['rajya', 'state', 'pradesh'] },
      { name: 'district',    kind: 'text', label: 'District',    synonyms: ['zila', 'jila', 'district'] },
      { name: 'village',     kind: 'text', label: 'Village',     synonyms: ['gaon', 'gram'] },
      { name: 'religion',    kind: 'enum', label: 'Religion',    values: ['Hindu','Muslim','Sikh','Christian','Buddhist','Jain','Other'],
        synonyms: ['dharm', 'dharam', 'religion', 'mazhab'] },
      { name: 'category',    kind: 'enum', label: 'Category',    values: ['General','OBC','SC','ST','EWS'],
        synonyms: ['shreni', 'category', 'caste', 'jati'] },
      { name: 'gender',      kind: 'enum', label: 'Gender',      values: ['Male','Female'], synonyms: ['ling', 'gender'] },
      { name: 'bloodGroup',  kind: 'enum', label: 'Blood Group', synonyms: ['blood', 'khoon', 'rakt'] },
      { name: 'dob',         kind: 'date', label: 'Date of Birth', synonyms: ['janm', 'birth', 'dob'] },
      { name: 'age',         kind: 'number', label: 'Age',       synonyms: ['umar', 'age', 'aayu'] },
      { name: 'maritalStatus', kind: 'enum', label: 'Marital Status', synonyms: ['shadi', 'vivah', 'married'] },
      { name: 'education',   kind: 'text', label: 'Education',   synonyms: ['padhai', 'shiksha', 'qualification'] },
      { name: 'mobileNo',    kind: 'text', label: 'Mobile',      synonyms: ['phone', 'mobile', 'number'] },
      { name: 'emergencyContact', kind: 'text', label: 'Emergency Contact', synonyms: ['emergency'] },
      { name: 'platoon',     kind: 'enum', label: 'Platoon',     synonyms: ['platoon', 'pltn'] },
      { name: 'section',     kind: 'enum', label: 'Section',     synonyms: ['section'] },
      { name: 'attn',        kind: 'enum', label: 'Attendance',  values: ['P','A','L','S','H','R','M'],
        synonyms: ['attendance', 'hazri', 'present', 'absent', 'gair hazir'] },
      { name: 'medStat',     kind: 'enum', label: 'Medical Status', values: ['SHAPE-1','SHAPE-2','Temporary Unfit','Permanent Unfit'],
        synonyms: ['medical', 'shape', 'fit', 'unfit', 'sehat'] },
      { name: 'height',      kind: 'number', label: 'Height',    synonyms: ['lambai', 'height'] },
      { name: 'weight',      kind: 'number', label: 'Weight',    synonyms: ['wazan', 'weight'] },
      { name: 'chest',       kind: 'text', label: 'Chest Measurement' },
      { name: 'fptResult',   kind: 'enum', label: 'FPT Result',  values: ['Pass','Fail'],
        synonyms: ['fpt', 'physical', 'fitness'] },
      { name: 'fptScore',    kind: 'text', label: 'FPT Score' },
      { name: 'weeklyExamResult', kind: 'enum', label: 'Weekly Exam Result', values: ['Pass','Fail'],
        synonyms: ['weekly', 'exam', 'test', 'pariksha'] },
      { name: 'weeklyExamMarks', kind: 'text', label: 'Exam Marks', synonyms: ['marks', 'ank'] },
      { name: 'punishments', kind: 'number', label: 'Punishments', synonyms: ['saza', 'punishment'] },
      { name: 'kitIssued',   kind: 'bool', label: 'Kit Issued',  synonyms: ['kit', 'saman'] },
      { name: 'issuedKitItems', kind: 'array', label: 'Issued Kit Items' },
      { name: 'docsComplete', kind: 'bool', label: 'Documents Complete', synonyms: ['document', 'kagaz', 'papers'] },
      { name: 'joinDate',    kind: 'date', label: 'Joining Date', synonyms: ['joining', 'bharti'] },
      { name: 'rank',        kind: 'text', label: 'Rank' },
      { name: 'batchId',     kind: 'id',   label: 'Batch ID' },
      { name: 'batchNumber', kind: 'text', label: 'Batch Number', synonyms: ['batch'] },
    ],
  },

  {
    name: 'absentRecords',
    description: 'Absent / chhutti / hospital / sick ke detailed records with dates aur reason',
    synonyms: ['absent', 'gair hazir', 'chhutti', 'leave', 'hospital', 'sick', 'bimar',
               'medical leave', 'rest', 'nadaarad', 'gayab'],
    batchScoped: true,
    linkField: 'chestNo',
    titleField: 'traineeName',
    domain: 'trainee',
    fields: [
      { name: 'traineeName', kind: 'text', label: 'Trainee Name', synonyms: ['naam'] },
      { name: 'chestNo',     kind: 'id',   label: 'Chest No' },
      { name: 'platoon',     kind: 'text', label: 'Platoon' },
      { name: 'type',        kind: 'enum', label: 'Absence Type', values: ['A','L','S','H','R','M'],
        synonyms: ['type', 'kis wajah', 'kaaran'] },
      { name: 'reason',      kind: 'text', label: 'Reason',      synonyms: ['wajah', 'kaaran', 'reason'] },
      DATEF('fromDate', 'From Date'),
      DATEF('toDate', 'To Date'),
      { name: 'totalDays',   kind: 'number', label: 'Total Days', synonyms: ['din', 'days'] },
      { name: 'status',      kind: 'enum', label: 'Status', values: ['Active','Returned'] },
      { name: 'remarks',     kind: 'text', label: 'Remarks' },
    ],
  },

  {
    name: 'medicalRecords',
    description: 'MI Room / hospital medical register — bimari, ilaj, doctor ki salah',
    synonyms: ['medical', 'mi room', 'hospital', 'doctor', 'ilaj', 'bimari', 'dawa', 'treatment'],
    batchScoped: true,
    linkField: 'chestNo',
    domain: 'trainee',
    fields: [
      { name: 'traineeName', kind: 'text', label: 'Trainee Name' },
      { name: 'chestNo',     kind: 'id',   label: 'Chest No' },
      { name: 'complaint',   kind: 'text', label: 'Complaint',  synonyms: ['shikayat', 'problem', 'bimari'] },
      { name: 'diagnosis',   kind: 'text', label: 'Diagnosis' },
      { name: 'treatment',   kind: 'text', label: 'Treatment',  synonyms: ['ilaj', 'dawa'] },
      DATEF('date', 'Date'),
      { name: 'status',      kind: 'text', label: 'Status' },
    ],
  },

  {
    name: 'fptRecords',
    description: 'FPT (Field Physical Test) ke results — running, pushups, situps waghairah',
    synonyms: ['fpt', 'physical test', 'fitness', 'running', 'daud', 'pushup', 'situp', 'physical'],
    batchScoped: true,
    linkField: 'chestNo',
    domain: 'training',
    fields: [
      { name: 'traineeName', kind: 'text', label: 'Trainee Name' },
      { name: 'chestNo',     kind: 'id',   label: 'Chest No' },
      { name: 'overallStatus', kind: 'enum', label: 'Overall Status', values: ['Pass','Fail'],
        synonyms: ['pass', 'fail', 'result', 'natija'] },
      { name: 'status',      kind: 'enum', label: 'Status', values: ['Pass','Fail'] },
      { name: 'totalMarks',  kind: 'number', label: 'Total Marks', synonyms: ['marks', 'ank'] },
      { name: 'events',      kind: 'array', label: 'Event-wise Results' },
      DATEF('date', 'Test Date'),
    ],
  },

  {
    name: 'weeklyTestRecords',
    description: 'Weekly / subject test ke results',
    synonyms: ['weekly test', 'weekly', 'subject test', 'exam', 'pariksha', 'test'],
    batchScoped: true,
    linkField: 'chestNo',
    domain: 'training',
    fields: [
      { name: 'traineeName', kind: 'text', label: 'Trainee Name' },
      { name: 'chestNo',     kind: 'id',   label: 'Chest No' },
      { name: 'subject',     kind: 'text', label: 'Subject', synonyms: ['vishay', 'subject'] },
      { name: 'marks',       kind: 'number', label: 'Marks', synonyms: ['ank', 'number'] },
      { name: 'totalMarks',  kind: 'number', label: 'Total Marks' },
      { name: 'status',      kind: 'enum', label: 'Status', values: ['Pass','Fail'] },
      DATEF('date', 'Test Date'),
    ],
  },

  {
    name: 'issue_records',
    description: 'Kit issue register — kis trainee ko kya saman diya gaya',
    synonyms: ['kit', 'issue', 'saman', 'diya', 'kit issue', 'items', 'shoes', 'uniform'],
    batchScoped: false,
    linkField: 'chestNo',
    domain: 'inventory',
    fields: [
      { name: 'traineeName', kind: 'text', label: 'Trainee Name' },
      { name: 'chestNo',     kind: 'id',   label: 'Chest No' },
      { name: 'platoon',     kind: 'text', label: 'Platoon' },
      { name: 'issuedItems', kind: 'array', label: 'Issued Items' },
      { name: 'totalItemsIssued', kind: 'number', label: 'Total Items' },
      MONEY('totalValue', 'Total Value'),
      { name: 'issuedBy',    kind: 'text', label: 'Issued By' },
      DATEF('issueDateISO', 'Issue Date'),
    ],
  },

  {
    name: 'recoveries',
    description: 'Trainee se paisa recovery — kit damage, loss waghairah',
    synonyms: ['recovery', 'vasooli', 'kaatna', 'penalty', 'damage', 'nuksan'],
    batchScoped: false,
    linkField: 'chestNo',
    domain: 'finance',
    fields: [
      { name: 'traineeName', kind: 'text', label: 'Trainee Name' },
      { name: 'chestNo',     kind: 'id',   label: 'Chest No' },
      MONEY('amount', 'Amount'),
      { name: 'reason',      kind: 'text', label: 'Reason' },
      { name: 'status',      kind: 'text', label: 'Status' },
      DATEF('date', 'Date'),
    ],
  },

  {
    name: 'batches',
    description: 'Training batches — kaunsa batch active hai, kab shuru/khatam',
    synonyms: ['batch', 'batches', 'course', 'session'],
    batchScoped: false,
    titleField: 'batchName',
    domain: 'system',
    fields: [
      { name: 'batchNumber', kind: 'text', label: 'Batch Number' },
      { name: 'batchName',   kind: 'text', label: 'Batch Name' },
      { name: 'status',      kind: 'enum', label: 'Status', values: ['active','completed','upcoming'] },
      DATEF('startDate', 'Start Date'),
      DATEF('endDate', 'End Date'),
      { name: 'totalTrainees', kind: 'number', label: 'Total Trainees' },
    ],
  },

  // ══════════════ STAFF DOMAIN ══════════════
  {
    name: 'staff',
    description: 'Ustad / instructor / staff ki list',
    synonyms: ['staff', 'ustad', 'instructor', 'teacher', 'guru', 'trainer', 'karamchari'],
    batchScoped: true,
    titleField: 'name',
    domain: 'staff',
    fields: [
      { name: 'name',      kind: 'text', label: 'Name' },
      { name: 'rank',      kind: 'text', label: 'Rank', synonyms: ['rank', 'pad'] },
      { name: 'forceNo',   kind: 'id',   label: 'Force Number' },
      { name: 'status',    kind: 'enum', label: 'Status', values: ['active','leave','td','hospital','inactive'] },
      { name: 'mobileNo',  kind: 'text', label: 'Mobile' },
      { name: 'subjects',  kind: 'array', label: 'Subjects' },
    ],
  },
  {
    name: 'staff_attendance',
    description: 'Staff ki daily attendance',
    synonyms: ['staff attendance', 'ustad hazri', 'instructor attendance'],
    batchScoped: true,
    domain: 'staff',
    fields: [
      { name: 'staffId',  kind: 'id',   label: 'Staff ID' },
      { name: 'staffName', kind: 'text', label: 'Staff Name' },
      { name: 'status',   kind: 'enum', label: 'Status' },
      DATEF('date', 'Date'),
    ],
  },
  {
    name: 'staff_leave',
    description: 'Staff ki leave applications aur approvals',
    synonyms: ['staff leave', 'ustad chhutti', 'instructor leave'],
    batchScoped: true,
    domain: 'staff',
    fields: [
      { name: 'staffName', kind: 'text', label: 'Staff Name' },
      { name: 'leaveType', kind: 'text', label: 'Leave Type' },
      { name: 'status',    kind: 'enum', label: 'Status', values: ['pending','approved','rejected'] },
      DATEF('fromDate', 'From'),
      DATEF('toDate', 'To'),
      { name: 'totalDays', kind: 'number', label: 'Days' },
    ],
  },
  {
    name: 'staff_duty',
    description: 'Staff ko di gayi duties',
    synonyms: ['duty', 'staff duty', 'guard', 'assignment'],
    batchScoped: true,
    domain: 'staff',
    fields: [
      { name: 'staffName', kind: 'text', label: 'Staff Name' },
      { name: 'dutyTypeId', kind: 'id',  label: 'Duty Type' },
      { name: 'status',    kind: 'text', label: 'Status' },
      DATEF('date', 'Date'),
    ],
  },
  {
    name: 'deputation_records',
    description: 'Ustad ki deputation / udhari — dusri company se liya ya diya',
    synonyms: ['deputation', 'udhari', 'attachment', 'bheja', 'liya'],
    batchScoped: true,
    domain: 'staff',
    fields: [
      { name: 'staffName', kind: 'text', label: 'Staff Name' },
      { name: 'fromCoy',   kind: 'text', label: 'From Company' },
      { name: 'toCoy',     kind: 'text', label: 'To Company' },
      { name: 'status',    kind: 'text', label: 'Status' },
      { name: 'reason',    kind: 'text', label: 'Reason' },
    ],
  },
  {
    name: 'training_schedule',
    description: 'Training ka schedule — kaunsa period, kaun sa ustad, kya subject',
    synonyms: ['schedule', 'timetable', 'period', 'class', 'training schedule'],
    batchScoped: true,
    domain: 'training',
    fields: [
      { name: 'subject',   kind: 'text', label: 'Subject' },
      { name: 'instructor', kind: 'text', label: 'Instructor' },
      { name: 'time',      kind: 'text', label: 'Time' },
      { name: 'status',    kind: 'text', label: 'Status' },
      DATEF('date', 'Date'),
    ],
  },
  {
    name: 'weeklyPrograms',
    description: 'Hafte ka training program — din ke hisaab se sessions',
    synonyms: ['weekly program', 'saptahik', 'week program', 'program'],
    batchScoped: true,
    domain: 'training',
    fields: [
      { name: 'weekName',  kind: 'text', label: 'Week Name' },
      DATEF('fromDate', 'From'),
      DATEF('toDate', 'To'),
      { name: 'schedule',  kind: 'array', label: 'Day-wise Schedule' },
    ],
  },
  {
    name: 'udhariRecords',
    description: 'Ustad udhari records (purana system)',
    synonyms: ['udhari', 'udhaar'],
    batchScoped: false,
    domain: 'staff',
    fields: [
      { name: 'ustadName', kind: 'text', label: 'Ustad Name' },
      { name: 'fromCoy',   kind: 'text', label: 'From Coy' },
      { name: 'toCoy',     kind: 'text', label: 'To Coy' },
      { name: 'status',    kind: 'text', label: 'Status' },
      { name: 'direction', kind: 'enum', label: 'Direction', values: ['given','taken'] },
    ],
  },

  // ══════════════ FINANCE DOMAIN ══════════════
  {
    name: 'mess_fund_collections',
    description: 'Mess fund me aaya paisa (collection)',
    synonyms: ['mess fund collection', 'mess collection', 'mess jama', 'khana fund'],
    batchScoped: false, domain: 'finance',
    fields: [MONEY('amount','Amount'), DATEF('date','Date'),
      { name:'label', kind:'text', label:'Label' },
      { name:'perHead', kind:'number', label:'Per Head' },
      { name:'traineeCount', kind:'number', label:'Trainee Count' }],
  },
  {
    name: 'mess_fund_expenses',
    description: 'Mess fund se hua kharcha (ration, sabzi, doodh waghairah)',
    synonyms: ['mess expense', 'mess kharcha', 'mess kharch', 'ration',
               'khana kharcha', 'mess fund', 'mess ka kharcha', 'mess bill'],
    batchScoped: false, domain: 'finance',
    fields: [MONEY('amount','Amount'), DATEF('date','Date'),
      { name:'itemName', kind:'text', label:'Item' },
      { name:'category', kind:'text', label:'Category' },
      { name:'vendor', kind:'text', label:'Vendor' },
      MONEY('paidAmount','Paid'), MONEY('dueAmount','Due')],
  },
  {
    name: 'training_fund_collections',
    description: 'Training fund me aaya paisa',
    synonyms: ['training fund collection', 'training jama'],
    batchScoped: false, domain: 'finance',
    fields: [MONEY('amount','Amount'), DATEF('date','Date'), { name:'label', kind:'text', label:'Label' }],
  },
  {
    name: 'training_fund_expenses',
    description: 'Training items ki KHARIDARI (t-shirt, shoes, bucket...). Stock ka purchase side.',
    synonyms: ['training expense', 'training kharcha', 'training fund',
               'kit kharida', 'item purchase', 'saman kharida'],
    batchScoped: false, domain: 'finance',
    fields: [MONEY('amount','Amount'), DATEF('date','Date'),
      { name:'itemName', kind:'text', label:'Item', synonyms:['item','saman','cheez'] },
      { name:'quantity', kind:'number', label:'Quantity', synonyms:['qty','kitne'] },
      { name:'sizes', kind:'array', label:'Size-wise Qty', synonyms:['size','naap'] },
      { name:'vendor', kind:'text', label:'Vendor' },
      MONEY('unitPrice','Unit Price'), MONEY('paidAmount','Paid'), MONEY('dueAmount','Due')],
  },
  {
    name: 'training_fund_recoveries',
    description: 'Training fund ki recoveries',
    synonyms: ['training recovery'],
    batchScoped: false, domain: 'finance',
    fields: [MONEY('amount','Amount'), DATEF('date','Date'), { name:'chestNo', kind:'id', label:'Chest No' }],
  },
  {
    name: 'company_assets_collections',
    description: 'Company assets fund me aaya paisa',
    synonyms: ['assets collection', 'company assets jama'],
    batchScoped: false, domain: 'finance',
    fields: [MONEY('amount','Amount'), DATEF('date','Date'), { name:'label', kind:'text', label:'Label' }],
  },
  {
    name: 'company_assets_expenses',
    description: 'Company assets ki kharidari — CHAIR, table, furniture, fan, cooler, equipment.',
    synonyms: ['assets expense', 'company assets', 'asset kharcha', 'furniture',
               'chair', 'kursi', 'table', 'mez', 'almirah', 'fan', 'cooler',
               'equipment', 'saman', 'bed', 'palang'],
    batchScoped: false, domain: 'finance',
    fields: [MONEY('amount','Amount'), DATEF('date','Date'),
      { name:'itemName', kind:'text', label:'Item', synonyms:['item','saman','cheez'] },
      { name:'quantity', kind:'number', label:'Quantity', synonyms:['qty','kitne','kitni'] },
      { name:'vendor', kind:'text', label:'Vendor' },
      { name:'assetStatus', kind:'text', label:'Asset Status' },
      MONEY('unitPrice','Unit Price'), MONEY('paidAmount','Paid'), MONEY('dueAmount','Due')],
  },
  {
    name: 'general_fund_collections',
    description: 'General fund (central reserve) me aaya paisa',
    synonyms: ['general fund collection', 'general jama', 'central fund'],
    batchScoped: false, domain: 'finance',
    fields: [MONEY('amount','Amount'), DATEF('date','Date'), { name:'label', kind:'text', label:'Label' }],
  },
  {
    name: 'general_fund_expenses',
    description: 'General fund se kharcha',
    synonyms: ['general expense', 'general fund', 'general kharcha'],
    batchScoped: false, domain: 'finance',
    fields: [MONEY('amount','Amount'), DATEF('date','Date'),
      { name:'itemName', kind:'text', label:'Item' }, MONEY('paidAmount','Paid'), MONEY('dueAmount','Due')],
  },
  {
    name: 'collections',
    description: 'Generic fund collections (purana/mixed)',
    synonyms: ['collection', 'jama', 'vasooli'],
    batchScoped: false, domain: 'finance',
    fields: [MONEY('amount','Amount'), DATEF('date','Date'),
      { name:'fundType', kind:'enum', label:'Fund Type', values:['Mess','Training','Assets','General'] }],
  },
  {
    name: 'expenses',
    description: 'Generic expenses (purana/mixed)',
    synonyms: ['expense', 'kharcha', 'kharch', 'spending'],
    batchScoped: false, domain: 'finance',
    fields: [MONEY('amount','Amount'), DATEF('date','Date'),
      { name:'itemName', kind:'text', label:'Item' },
      { name:'fundType', kind:'enum', label:'Fund Type' },
      { name:'vendor', kind:'text', label:'Vendor' }],
  },
  {
    name: 'fund_transfers',
    description: 'Ek fund se dusre fund me paisa transfer',
    synonyms: ['transfer', 'fund transfer', 'paisa bheja'],
    batchScoped: false, domain: 'finance',
    fields: [MONEY('amount','Amount'), DATEF('date','Date'),
      { name:'fromFund', kind:'text', label:'From Fund' }, { name:'toFund', kind:'text', label:'To Fund' }],
  },
  {
    name: 'vendors',
    description: 'Vendor / supplier / dukandar ki list',
    synonyms: ['vendor', 'supplier', 'dukandar', 'shop', 'seller', 'party'],
    batchScoped: false, titleField: 'name', domain: 'finance',
    fields: [{ name:'name', kind:'text', label:'Vendor Name' },
      { name:'phone', kind:'text', label:'Phone' },
      { name:'categoryLabel', kind:'text', label:'Category' },
      { name:'isActive', kind:'bool', label:'Active' }],
  },
  {
    name: 'vendor_entries',
    description: 'Vendor ke bills/entries — kitna baaki hai (due)',
    synonyms: ['vendor bill', 'vendor due', 'vendor baaki', 'bill', 'udhaar', 'baki paisa'],
    batchScoped: false, domain: 'finance',
    fields: [{ name:'vendorName', kind:'text', label:'Vendor' },
      MONEY('totalAmount','Total'), MONEY('paidAmount','Paid'), MONEY('dueAmount','Due'),
      { name:'status', kind:'text', label:'Status' }, DATEF('entryDate','Date')],
  },
  {
    name: 'vendor_payments',
    description: 'Vendor ko kiye gaye payments',
    synonyms: ['vendor payment', 'vendor ko diya', 'payment'],
    batchScoped: false, domain: 'finance',
    fields: [{ name:'vendorName', kind:'text', label:'Vendor' },
      MONEY('amount','Amount'), DATEF('date','Date'),
      { name:'paymentMode', kind:'text', label:'Mode' }],
  },
  {
    name: 'bills',
    description: 'Upload kiye gaye bills',
    synonyms: ['bill', 'receipt', 'raseed'],
    batchScoped: false, domain: 'finance',
    fields: [MONEY('amount','Amount'), DATEF('date','Date'), { name:'vendor', kind:'text', label:'Vendor' }],
  },
  {
    name: 'mess_boys',
    description: 'Mess boy staff ki list',
    synonyms: ['mess boy', 'cook', 'bawarchi', 'khansama'],
    batchScoped: false, titleField: 'name', domain: 'finance',
    fields: [{ name:'name', kind:'text', label:'Name' },
      MONEY('salary','Salary'), { name:'isActive', kind:'bool', label:'Active' }],
  },
  {
    name: 'mess_boy_salaries',
    description: 'Mess boy ki salary payments',
    synonyms: ['mess boy salary', 'cook salary', 'tankhwah'],
    batchScoped: false, domain: 'finance',
    fields: [{ name:'name', kind:'text', label:'Name' },
      MONEY('totalSalary','Total Salary'), { name:'totalDays', kind:'number', label:'Days' },
      { name:'monthLabel', kind:'text', label:'Month' }],
  },

  // ══════════════ INVENTORY ══════════════
  {
    // ⚠️ LEGACY — ye collection KHAALI hai. Koi screen isme likhti nahi.
    // Stock ke liye get_stock tool use karo (purchases − issues compute karta hai).
    name: 'item_master',
    description: '⚠️ EMPTY legacy collection — DO NOT USE. For stock use get_stock tool.',
    synonyms: [],
    batchScoped: false, titleField: 'name', domain: 'inventory',
    fields: [{ name:'name', kind:'text', label:'Item Name' },
      { name:'category', kind:'text', label:'Category' },
      { name:'quantity', kind:'number', label:'Quantity' },
      MONEY('rate','Rate')],
  },
  {
    name: 'training_custom_items',
    description: 'Training fund ke custom items',
    synonyms: ['custom item', 'training item'],
    batchScoped: false, domain: 'inventory',
    fields: [{ name:'name', kind:'text', label:'Name' }, { name:'category', kind:'text', label:'Category' }],
  },
  {
    name: 'company_assets_custom_items',
    description: 'Company assets ke custom items',
    synonyms: ['asset item'],
    batchScoped: false, domain: 'inventory',
    fields: [{ name:'name', kind:'text', label:'Name' }, { name:'category', kind:'text', label:'Category' }],
  },
  {
    name: 'mess_custom_categories',
    description: 'Mess ki custom expense categories',
    synonyms: ['mess category'],
    batchScoped: false, domain: 'inventory',
    fields: [{ name:'name', kind:'text', label:'Name' }],
  },

  // ══════════════ SYSTEM ══════════════
  {
    name: 'users',
    description: 'System users — commander, clerk, QM, ustad ke logins',
    synonyms: ['user', 'login', 'account', 'staff login'],
    batchScoped: false, titleField: 'name', domain: 'system',
    fields: [{ name:'name', kind:'text', label:'Name' },
      { name:'email', kind:'text', label:'Email' },
      { name:'role', kind:'enum', label:'Role', values:['Company Commander','Clerk','Quarter Master','Ustad'] },
      { name:'isActive', kind:'bool', label:'Active' }],
  },
  {
    name: 'ustads',
    description: 'Ustad list (purana collection)',
    synonyms: ['ustad list'],
    batchScoped: false, domain: 'staff',
    fields: [{ name:'name', kind:'text', label:'Name' }, { name:'rank', kind:'text', label:'Rank' }],
  },
  {
    name: 'leave_types',
    description: 'Leave ke prakar aur unka quota',
    synonyms: ['leave type', 'chhutti prakar'],
    batchScoped: false, domain: 'system',
    fields: [{ name:'name', kind:'text', label:'Name' }, { name:'maxDays', kind:'number', label:'Max Days' }],
  },
  {
    name: 'duty_types',
    description: 'Duty ke prakar',
    synonyms: ['duty type'],
    batchScoped: false, domain: 'system',
    fields: [{ name:'name', kind:'text', label:'Name' }],
  },
];

// ─────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────
export const COLLECTION_MAP: Record<string, CollectionDef> =
  COLLECTIONS.reduce((acc, c) => { acc[c.name] = c; return acc; }, {} as Record<string, CollectionDef>);

export const ALL_COLLECTION_NAMES = COLLECTIONS.map(c => c.name);

/** AI prompt ke liye compact schema text (full — sirf reference/testing) */
export function buildSchemaDigest(): string {
  const byDomain = COLLECTIONS.reduce((acc, c) => {
    (acc[c.domain] ??= []).push(c);
    return acc;
  }, {} as Record<string, CollectionDef[]>);

  return Object.entries(byDomain).map(([domain, cols]) => {
    const lines = cols.map(c => {
      const f = c.fields.slice(0, 14).map(x => x.name).join(', ');
      return `  • ${c.name}${c.batchScoped ? ' [batch]' : ''} — ${c.description}\n    fields: ${f}`;
    }).join('\n');
    return `${domain.toUpperCase()}:\n${lines}`;
  }).join('\n\n');
}

/**
 * TOKEN-EFFICIENT DIGEST 🪶
 * ─────────────────────────
 * Poora schema bhejne se har call ~1,270 token kha jaata tha aur
 * Groq ka free TPM (12,000/min) 3-4 call me hi khatam ho jaata tha.
 *
 * Ab: sawaal se related top collections ke POORE fields bhejte hain,
 * baaki sabke sirf naam. Agar AI ko kisi aur ka detail chahiye to
 * wo `describe_schema` tool khud call kar lega.
 */
export function buildFocusedDigest(userMessage: string, topN = 6): string {
  const matched = matchCollections(userMessage).slice(0, topN);

  // Trainees hamesha rakho — zyadatar sawaal isi se jude hote hain
  if (!matched.find(c => c.name === 'trainees')) {
    const tr = COLLECTION_MAP['trainees'];
    if (tr) matched.unshift(tr);
  }

  const detailed = matched.slice(0, topN).map(c => {
    const f = c.fields.map(x => {
      const vals = x.values?.length ? `(${x.values.slice(0, 8).join('|')})` : '';
      return `${x.name}${vals}`;
    }).join(', ');
    return `• ${c.name}${c.batchScoped ? '[b]' : ''} — ${c.description}\n  ${f}`;
  }).join('\n');

  const detailedNames = new Set(matched.slice(0, topN).map(c => c.name));
  const others = COLLECTIONS
    .filter(c => !detailedNames.has(c.name))
    .map(c => c.name)
    .join(', ');

  return `RELEVANT COLLECTIONS (poore fields):
${detailed}

BAAKI COLLECTIONS (naam only — detail ke liye describe_schema chalao):
${others}

[b] = batch-scoped`;
}

/** User ke shabdon se collection dhoondo (local planner ke liye) */
export function matchCollections(text: string): CollectionDef[] {
  const t = ` ${text.toLowerCase()} `;
  const scored: { c: CollectionDef; score: number }[] = [];

  for (const c of COLLECTIONS) {
    let score = 0;
    for (const syn of c.synonyms) {
      if (!t.includes(syn)) continue;
      // Multi-word synonym ("mess kharcha") bahut strong signal hai —
      // generic single word ("kharcha") se kahin zyada specific.
      const words = syn.trim().split(/\s+/).length;
      score += words > 1 ? 6 * words : (syn.length > 6 ? 3 : 2);
    }
    if (t.includes(` ${c.name.toLowerCase()} `)) score += 8;
    // field synonyms bhi count karo (halka weight)
    for (const f of c.fields) {
      for (const fs of f.synonyms ?? []) {
        if (t.includes(` ${fs} `)) score += 1;
      }
    }
    if (score > 0) scored.push({ c, score });
  }

  return scored.sort((a, b) => b.score - a.score).map(s => s.c);
}
