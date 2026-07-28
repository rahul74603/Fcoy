// ═══════════════════════════════════════════════════════════
// STATE METADATA
// State → Zone + Primary Regional Language mapping.
//
// NOTE: Registration form me "language" ka field nahi hai,
// isliye Language dimension STATE se auto-derive hoti hai.
// Ye sirf INDICATIVE hai (welfare planning ke liye) —
// kisi trainee ki asli maatra-bhasha alag ho sakti hai.
// ═══════════════════════════════════════════════════════════

export interface StateMeta {
  zone: string;
  language: string;
}

/** Registration form (TraineeProfileScreen) ki exact state list */
export const STATES_OF_INDIA = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
] as const;

/** Registration form ki religion list */
export const RELIGIONS = [
  'Hindu', 'Muslim', 'Sikh', 'Christian', 'Buddhist', 'Jain', 'Other',
] as const;

export const STATE_META: Record<string, StateMeta> = {
  'Andhra Pradesh':    { zone: 'South',     language: 'Telugu'    },
  'Arunachal Pradesh': { zone: 'North East', language: 'Nyishi / Hindi' },
  'Assam':             { zone: 'North East', language: 'Assamese'  },
  'Bihar':             { zone: 'East',      language: 'Hindi / Bhojpuri' },
  'Chhattisgarh':      { zone: 'Central',   language: 'Chhattisgarhi' },
  'Goa':               { zone: 'West',      language: 'Konkani'   },
  'Gujarat':           { zone: 'West',      language: 'Gujarati'  },
  'Haryana':           { zone: 'North',     language: 'Haryanvi / Hindi' },
  'Himachal Pradesh':  { zone: 'North',     language: 'Pahari / Hindi' },
  'Jharkhand':         { zone: 'East',      language: 'Hindi / Santhali' },
  'Karnataka':         { zone: 'South',     language: 'Kannada'   },
  'Kerala':            { zone: 'South',     language: 'Malayalam' },
  'Madhya Pradesh':    { zone: 'Central',   language: 'Hindi'     },
  'Maharashtra':       { zone: 'West',      language: 'Marathi'   },
  'Manipur':           { zone: 'North East', language: 'Meitei'    },
  'Meghalaya':         { zone: 'North East', language: 'Khasi / Garo' },
  'Mizoram':           { zone: 'North East', language: 'Mizo'      },
  'Nagaland':          { zone: 'North East', language: 'Nagamese'  },
  'Odisha':            { zone: 'East',      language: 'Odia'      },
  'Punjab':            { zone: 'North',     language: 'Punjabi'   },
  'Rajasthan':         { zone: 'North',     language: 'Rajasthani / Hindi' },
  'Sikkim':            { zone: 'North East', language: 'Nepali'    },
  'Tamil Nadu':        { zone: 'South',     language: 'Tamil'     },
  'Telangana':         { zone: 'South',     language: 'Telugu'    },
  'Tripura':           { zone: 'North East', language: 'Bengali / Kokborok' },
  'Uttar Pradesh':     { zone: 'North',     language: 'Hindi'     },
  'Uttarakhand':       { zone: 'North',     language: 'Garhwali / Hindi' },
  'West Bengal':       { zone: 'East',      language: 'Bengali'   },
  'Delhi':             { zone: 'North',     language: 'Hindi'     },
  'Jammu & Kashmir':   { zone: 'North',     language: 'Kashmiri / Dogri' },
  'Ladakh':            { zone: 'North',     language: 'Ladakhi'   },
  'Chandigarh':        { zone: 'North',     language: 'Punjabi / Hindi' },
  'Puducherry':        { zone: 'South',     language: 'Tamil'     },
};

/**
 * Purane / galat spelling wale records ko sahi state name par map karta hai.
 * Key hamesha lowercase-trimmed hoti hai.
 */
export const STATE_ALIASES: Record<string, string> = {
  'wb': 'West Bengal',
  'bengal': 'West Bengal',
  'bangal': 'West Bengal',
  'w.b.': 'West Bengal',
  'w b': 'West Bengal',
  'westbengal': 'West Bengal',
  'up': 'Uttar Pradesh',
  'u.p.': 'Uttar Pradesh',
  'uttarpradesh': 'Uttar Pradesh',
  'mp': 'Madhya Pradesh',
  'm.p.': 'Madhya Pradesh',
  'madhyapradesh': 'Madhya Pradesh',
  'uk': 'Uttarakhand',
  'uttaranchal': 'Uttarakhand',
  'jk': 'Jammu & Kashmir',
  'j&k': 'Jammu & Kashmir',
  'j & k': 'Jammu & Kashmir',
  'jammu and kashmir': 'Jammu & Kashmir',
  'jammu kashmir': 'Jammu & Kashmir',
  'tn': 'Tamil Nadu',
  'tamilnadu': 'Tamil Nadu',
  'ap': 'Andhra Pradesh',
  'andhrapradesh': 'Andhra Pradesh',
  'hp': 'Himachal Pradesh',
  'himachal': 'Himachal Pradesh',
  'orissa': 'Odisha',
  'pondicherry': 'Puducherry',
  'new delhi': 'Delhi',
  'nct of delhi': 'Delhi',
  'chattisgarh': 'Chhattisgarh',
  'uttrakhand': 'Uttarakhand',
};

/** Religion spelling normalisation */
export const RELIGION_ALIASES: Record<string, string> = {
  'hinduism': 'Hindu',
  'hindhu': 'Hindu',
  'islam': 'Muslim',
  'muslin': 'Muslim',
  'musalman': 'Muslim',
  'sikhism': 'Sikh',
  'sardar': 'Sikh',
  'christianity': 'Christian',
  'christan': 'Christian',
  'isai': 'Christian',
  'buddhism': 'Buddhist',
  'bodh': 'Buddhist',
  'jainism': 'Jain',
  'others': 'Other',
};

/** Zone-wise accent colour (Tailwind classes) */
export const ZONE_COLORS: Record<string, string> = {
  'North':      'bg-blue-500',
  'South':      'bg-emerald-500',
  'East':       'bg-amber-500',
  'West':       'bg-purple-500',
  'Central':    'bg-rose-500',
  'North East': 'bg-cyan-500',
};

/** Religion-wise accent colour (welfare cards ke liye, neutral palette) */
export const RELIGION_COLORS: Record<string, string> = {
  'Hindu':     'bg-orange-500',
  'Muslim':    'bg-green-600',
  'Sikh':      'bg-amber-500',
  'Christian': 'bg-sky-600',
  'Buddhist':  'bg-yellow-500',
  'Jain':      'bg-red-400',
  'Other':     'bg-slate-500',
};
