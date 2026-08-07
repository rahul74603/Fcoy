/** Canonical platoon names used throughout the application. */
export const PLATOON_OPTIONS = ['Platoon 1', 'Platoon 2', 'Platoon 3', 'Platoon 4'] as const;

/** Converts legacy labels (A/B/C/D, 1/2/3/4) to the permanent names. */
export const normalizePlatoon = (value?: string): string => {
  const v = String(value ?? '').trim();
  const key = v.toLowerCase().replace(/\s+/g, '');
  const map: Record<string, string> = {
    a: 'Platoon 1', b: 'Platoon 2', c: 'Platoon 3', d: 'Platoon 4',
    '1': 'Platoon 1', '2': 'Platoon 2', '3': 'Platoon 3', '4': 'Platoon 4',
    platoon1: 'Platoon 1', platoon2: 'Platoon 2', platoon3: 'Platoon 3', platoon4: 'Platoon 4',
  };
  return map[key] ?? (PLATOON_OPTIONS.includes(v as typeof PLATOON_OPTIONS[number]) ? v : 'Platoon 1');
};
