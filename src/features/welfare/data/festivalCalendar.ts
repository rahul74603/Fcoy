// ═══════════════════════════════════════════════════════════
// FESTIVAL / WELFARE CALENDAR — 2026 & 2027
// ───────────────────────────────────────────────────────────
// Ye calendar sirf WELFARE PLANNING ke liye hai:
//   • Festival par extra ration / mithai / puja saamagri
//   • Special mess menu
//   • Chhutti (leave roster) plan karna
//   • Ghar par phone / video call arrangement
//
// Lunar festivals (Eid, Muharram, Milad) ki dates
// chaand dikhne par 1 din aage-peeche ho sakti hain —
// "TENTATIVE" maan kar unit HQ se confirm karein.
// ═══════════════════════════════════════════════════════════

import type { FestivalDef } from '../types/welfare.types';

const HINDI_BELT = [
  'Bihar', 'Uttar Pradesh', 'Jharkhand', 'Madhya Pradesh',
  'Rajasthan', 'Haryana', 'Delhi', 'Chhattisgarh', 'Uttarakhand',
];

export const FESTIVAL_CALENDAR: FestivalDef[] = [
  // ══════════════ NATIONAL — sabke liye ══════════════
  {
    id: 'independence-2026', name: 'Independence Day', hindiName: 'स्वतंत्रता दिवस',
    date: '2026-08-15', kind: 'National', religions: [], states: [], mode: 'ANY',
    welfareNote: 'Poori company — Flag hoisting, special lunch, sweets distribution.',
    emoji: '🇮🇳',
  },
  {
    id: 'gandhi-jayanti-2026', name: 'Gandhi Jayanti', hindiName: 'गांधी जयंती',
    date: '2026-10-02', kind: 'National', religions: [], states: [], mode: 'ANY',
    welfareNote: 'Poori company — Shramdaan, special mess menu.',
    emoji: '🕊️',
  },
  {
    id: 'republic-2027', name: 'Republic Day', hindiName: 'गणतंत्र दिवस',
    date: '2027-01-26', kind: 'National', religions: [], states: [], mode: 'ANY',
    welfareNote: 'Poori company — Parade, special lunch, sweets.',
    emoji: '🇮🇳',
  },
  {
    id: 'independence-2027', name: 'Independence Day', hindiName: 'स्वतंत्रता दिवस',
    date: '2027-08-15', kind: 'National', religions: [], states: [], mode: 'ANY',
    welfareNote: 'Poori company — Flag hoisting, special lunch.',
    emoji: '🇮🇳',
  },

  // ══════════════ HINDU ══════════════
  {
    id: 'raksha-bandhan-2026', name: 'Raksha Bandhan', hindiName: 'रक्षा बंधन',
    date: '2026-08-28', kind: 'Religious', religions: ['Hindu', 'Jain', 'Sikh'], states: [], mode: 'ANY',
    welfareNote: 'Ghar se aayi rakhi ki dak time par pahunchayein. Video-call slot dein.',
    emoji: '🧵',
  },
  {
    id: 'janmashtami-2026', name: 'Krishna Janmashtami', hindiName: 'कृष्ण जन्माष्टमी',
    date: '2026-09-04', kind: 'Religious', religions: ['Hindu'], states: [], mode: 'ANY',
    welfareNote: 'Vrat rakhne walon ke liye phalahaar (fruit / sabudana) ki alag vyavastha.',
    emoji: '🪈',
  },
  {
    id: 'ganesh-chaturthi-2026', name: 'Ganesh Chaturthi', hindiName: 'गणेश चतुर्थी',
    date: '2026-09-14', kind: 'Religious', religions: ['Hindu'],
    states: ['Maharashtra', 'Goa', 'Karnataka', 'Telangana', 'Andhra Pradesh', 'Gujarat'], mode: 'ANY',
    welfareNote: 'Maharashtra/Goa ke trainees ke liye modak + puja arrangement.',
    emoji: '🐘',
  },
  {
    id: 'navratri-2026', name: 'Sharad Navratri Begins', hindiName: 'शारदीय नवरात्रि प्रारंभ',
    date: '2026-10-11', kind: 'Religious', religions: ['Hindu'], states: [], mode: 'ANY',
    welfareNote: '9 din vrat — mess me daily phalahaar/satvik thali ka standing order.',
    emoji: '🪔',
  },
  {
    id: 'durga-ashtami-2026', name: 'Durga Ashtami / Maha Navami', hindiName: 'दुर्गा अष्टमी',
    date: '2026-10-19', kind: 'Regional', religions: ['Hindu'],
    states: ['West Bengal', 'Odisha', 'Assam', 'Tripura', 'Bihar', 'Jharkhand'], mode: 'ALL',
    welfareNote: 'Bengali trainees ke liye Durga Puja — bhog + cultural evening.',
    emoji: '🛕',
  },
  {
    id: 'dussehra-2026', name: 'Dussehra / Vijayadashami', hindiName: 'दशहरा',
    date: '2026-10-20', kind: 'Religious', religions: ['Hindu'], states: [], mode: 'ANY',
    welfareNote: 'Shastra Puja + company-wide special dinner.',
    emoji: '🏹',
  },
  {
    id: 'dhanteras-2026', name: 'Dhanteras', hindiName: 'धनतेरस',
    date: '2026-11-06', kind: 'Religious', religions: ['Hindu', 'Jain'], states: [], mode: 'ANY',
    welfareNote: 'Diwali week shuru — canteen stock aur advance pay ka intezaam.',
    emoji: '🪙',
  },
  {
    id: 'kali-puja-2026', name: 'Kali Puja', hindiName: 'काली पूजा',
    date: '2026-11-07', kind: 'Regional', religions: ['Hindu'],
    states: ['West Bengal', 'Assam', 'Tripura', 'Odisha'], mode: 'ALL',
    welfareNote: 'Bengali trainees — Kali Puja bhog aur puja samagri.',
    emoji: '🌺',
  },
  {
    id: 'diwali-2026', name: 'Diwali / Deepavali', hindiName: 'दीपावली',
    date: '2026-11-08', kind: 'Religious', religions: ['Hindu', 'Sikh', 'Jain', 'Buddhist'], states: [], mode: 'ANY',
    welfareNote: 'Sabse bada welfare event — mithai, diya, extra grant, ghar call slots.',
    emoji: '🪔',
  },
  {
    id: 'bhai-dooj-2026', name: 'Bhai Dooj', hindiName: 'भाई दूज',
    date: '2026-11-11', kind: 'Religious', religions: ['Hindu'], states: [], mode: 'ANY',
    welfareNote: 'Ghar par phone call ka extra slot.',
    emoji: '🎁',
  },
  {
    id: 'chhath-2026', name: 'Chhath Puja', hindiName: 'छठ पूजा',
    date: '2026-11-15', kind: 'Regional', religions: ['Hindu'],
    states: ['Bihar', 'Jharkhand', 'Uttar Pradesh'], mode: 'ALL',
    welfareNote: '36-ghante nirjala vrat — thekua saamagri, ghat/water-point arrangement, duty relief.',
    emoji: '🌅',
  },
  {
    id: 'makar-sankranti-2027', name: 'Makar Sankranti / Pongal / Bihu', hindiName: 'मकर संक्रांति',
    date: '2027-01-15', kind: 'Harvest', religions: ['Hindu'], states: [], mode: 'ANY',
    welfareNote: 'Til-gud / khichdi / pongal — region wise alag mess menu.',
    emoji: '🪁',
  },
  {
    id: 'shivratri-2027', name: 'Maha Shivaratri', hindiName: 'महाशिवरात्रि',
    date: '2027-03-06', kind: 'Religious', religions: ['Hindu'], states: [], mode: 'ANY',
    welfareNote: 'Vrat walon ke liye phalahaar; raat ki duty me relief.',
    emoji: '🔱',
  },
  {
    id: 'holi-2027', name: 'Holi', hindiName: 'होली',
    date: '2027-03-22', kind: 'Religious', religions: ['Hindu'], states: [], mode: 'ANY',
    welfareNote: 'Gujiya + rang; company-wide milan samaroh.',
    emoji: '🎨',
  },
  {
    id: 'ram-navami-2027', name: 'Ram Navami', hindiName: 'राम नवमी',
    date: '2027-04-15', kind: 'Religious', religions: ['Hindu'], states: [], mode: 'ANY',
    welfareNote: 'Vrat / bhandara arrangement.',
    emoji: '🏹',
  },
  {
    id: 'bengali-new-year-2027', name: 'Poila Boishakh / Bohag Bihu', hindiName: 'पोइला बोइशाख / बिहू',
    date: '2027-04-15', kind: 'Regional', religions: [],
    states: ['West Bengal', 'Assam', 'Tripura'], mode: 'ANY',
    welfareNote: 'Bengali & Assamese trainees — naya saal, special sweets (mishti).',
    emoji: '🎊',
  },
  {
    id: 'rath-yatra-2027', name: 'Jagannath Rath Yatra', hindiName: 'रथ यात्रा',
    date: '2027-07-05', kind: 'Regional', religions: ['Hindu'],
    states: ['Odisha', 'West Bengal', 'Gujarat'], mode: 'ALL',
    welfareNote: 'Odia trainees — mahaprasad arrangement.',
    emoji: '🛕',
  },
  {
    id: 'onam-2027', name: 'Onam', hindiName: 'ओणम',
    date: '2027-09-12', kind: 'Harvest', religions: [],
    states: ['Kerala', 'Puducherry'], mode: 'ANY',
    welfareNote: 'Kerala ke trainees — Onam Sadhya (kela patte par thali).',
    emoji: '🌸',
  },
  {
    id: 'diwali-2027', name: 'Diwali / Deepavali', hindiName: 'दीपावली',
    date: '2027-10-29', kind: 'Religious', religions: ['Hindu', 'Sikh', 'Jain', 'Buddhist'], states: [], mode: 'ANY',
    welfareNote: 'Mithai, diya, extra welfare grant, ghar call slots.',
    emoji: '🪔',
  },
  {
    id: 'chhath-2027', name: 'Chhath Puja', hindiName: 'छठ पूजा',
    date: '2027-11-04', kind: 'Regional', religions: ['Hindu'],
    states: ['Bihar', 'Jharkhand', 'Uttar Pradesh'], mode: 'ALL',
    welfareNote: 'Thekua saamagri + ghat arrangement + duty relief.',
    emoji: '🌅',
  },

  // ══════════════ MUSLIM ══════════════
  {
    id: 'milad-2026', name: 'Milad-un-Nabi (Eid-e-Milad)', hindiName: 'ईद-ए-मिलाद',
    date: '2026-08-26', kind: 'Religious', religions: ['Muslim'], states: [], mode: 'ANY',
    welfareNote: 'TENTATIVE (chaand par nirbhar). Namaz ke liye time + special meal.',
    emoji: '🕌',
  },
  {
    id: 'eid-fitr-2027', name: 'Eid-ul-Fitr (Ramzan Eid)', hindiName: 'ईद-उल-फ़ितर',
    date: '2027-03-10', kind: 'Religious', religions: ['Muslim'], states: [], mode: 'ANY',
    welfareNote: 'TENTATIVE. Poore Ramzan sehri (subah) + iftar (shaam) ka mess schedule badlein. Eid par sewaiyan.',
    emoji: '🌙',
  },
  {
    id: 'ramzan-2027', name: 'Ramzan Begins', hindiName: 'रमज़ान प्रारंभ',
    date: '2027-02-09', kind: 'Religious', religions: ['Muslim'], states: [], mode: 'ANY',
    welfareNote: 'TENTATIVE. 30 din — sehri/iftar timing, roza rakhne walon ki PT load review.',
    emoji: '🌙',
  },
  {
    id: 'bakrid-2027', name: 'Eid-ul-Adha (Bakrid)', hindiName: 'बकरीद',
    date: '2027-05-17', kind: 'Religious', religions: ['Muslim'], states: [], mode: 'ANY',
    welfareNote: 'TENTATIVE. Namaz slot + special meal.',
    emoji: '🕌',
  },
  {
    id: 'muharram-2027', name: 'Muharram', hindiName: 'मुहर्रम',
    date: '2027-06-16', kind: 'Religious', religions: ['Muslim'], states: [], mode: 'ANY',
    welfareNote: 'TENTATIVE. Shok ka mahina — samuhik programme se parhez, duty adjust.',
    emoji: '🕌',
  },
  {
    id: 'milad-2027', name: 'Milad-un-Nabi (Eid-e-Milad)', hindiName: 'ईद-ए-मिलाद',
    date: '2027-08-15', kind: 'Religious', religions: ['Muslim'], states: [], mode: 'ANY',
    welfareNote: 'TENTATIVE. Independence Day ke saath — dono ka combined plan.',
    emoji: '🕌',
  },

  // ══════════════ SIKH ══════════════
  {
    id: 'guru-nanak-2026', name: 'Guru Nanak Jayanti (Gurpurab)', hindiName: 'गुरु नानक जयंती',
    date: '2026-11-24', kind: 'Religious', religions: ['Sikh'], states: ['Punjab', 'Chandigarh', 'Haryana', 'Delhi'], mode: 'ANY',
    welfareNote: 'Langar arrangement + Gurudwara visit ke liye transport/leave.',
    emoji: '🪯',
  },
  {
    id: 'guru-gobind-2027', name: 'Guru Gobind Singh Jayanti', hindiName: 'गुरु गोबिंद सिंह जयंती',
    date: '2027-01-15', kind: 'Religious', religions: ['Sikh'], states: [], mode: 'ANY',
    welfareNote: 'Langar + prabhat pheri ke liye samay.',
    emoji: '🪯',
  },
  {
    id: 'lohri-2027', name: 'Lohri', hindiName: 'लोहड़ी',
    date: '2027-01-13', kind: 'Harvest', religions: ['Sikh', 'Hindu'],
    states: ['Punjab', 'Haryana', 'Himachal Pradesh', 'Chandigarh', 'Delhi', 'Jammu & Kashmir'], mode: 'ALL',
    welfareNote: 'Punjab/Haryana trainees — bonfire evening, rewri-gajak-moongphali.',
    emoji: '🔥',
  },
  {
    id: 'baisakhi-2027', name: 'Baisakhi / Vaisakhi', hindiName: 'बैसाखी',
    date: '2027-04-14', kind: 'Harvest', religions: ['Sikh'],
    states: ['Punjab', 'Haryana', 'Chandigarh', 'Himachal Pradesh'], mode: 'ANY',
    welfareNote: 'Punjabi trainees — Khalsa Sajna Diwas, langar + bhangra evening.',
    emoji: '🌾',
  },
  {
    id: 'guru-nanak-2027', name: 'Guru Nanak Jayanti (Gurpurab)', hindiName: 'गुरु नानक जयंती',
    date: '2027-11-14', kind: 'Religious', religions: ['Sikh'], states: [], mode: 'ANY',
    welfareNote: 'Langar arrangement + Gurudwara visit.',
    emoji: '🪯',
  },

  // ══════════════ CHRISTIAN ══════════════
  {
    id: 'christmas-2026', name: 'Christmas', hindiName: 'क्रिसमस',
    date: '2026-12-25', kind: 'Religious', religions: ['Christian'], states: [], mode: 'ANY',
    welfareNote: 'Church visit ke liye transport/leave + cake aur special dinner.',
    emoji: '🎄',
  },
  {
    id: 'good-friday-2027', name: 'Good Friday', hindiName: 'गुड फ्राइडे',
    date: '2027-03-26', kind: 'Religious', religions: ['Christian'], states: [], mode: 'ANY',
    welfareNote: 'Prarthana ke liye samay; upvaas walon ka alag menu.',
    emoji: '✝️',
  },
  {
    id: 'easter-2027', name: 'Easter Sunday', hindiName: 'ईस्टर',
    date: '2027-03-28', kind: 'Religious', religions: ['Christian'], states: [], mode: 'ANY',
    welfareNote: 'Church visit + special breakfast.',
    emoji: '🐣',
  },
  {
    id: 'christmas-2027', name: 'Christmas', hindiName: 'क्रिसमस',
    date: '2027-12-25', kind: 'Religious', religions: ['Christian'], states: [], mode: 'ANY',
    welfareNote: 'Church visit + cake aur special dinner.',
    emoji: '🎄',
  },

  // ══════════════ BUDDHIST / JAIN ══════════════
  {
    id: 'buddha-purnima-2027', name: 'Buddha Purnima', hindiName: 'बुद्ध पूर्णिमा',
    date: '2027-05-20', kind: 'Religious', religions: ['Buddhist'], states: [], mode: 'ANY',
    welfareNote: 'Vihar visit + satvik bhojan.',
    emoji: '☸️',
  },
  {
    id: 'mahavir-jayanti-2027', name: 'Mahavir Jayanti', hindiName: 'महावीर जयंती',
    date: '2027-04-19', kind: 'Religious', religions: ['Jain'], states: [], mode: 'ANY',
    welfareNote: 'Jain trainees — shuddh satvik (bina pyaz-lehsun) thali.',
    emoji: '🕉️',
  },
];

/** Hindi-belt helper (agar future me naya festival add karna ho) */
export const HINDI_BELT_STATES = HINDI_BELT;

/** Per-head default welfare budget (₹) — Settings se override ho sakta hai */
export const DEFAULT_PER_HEAD_BUDGET: Record<string, number> = {
  National:  120,
  Religious: 200,
  Regional:  180,
  Harvest:   150,
};
