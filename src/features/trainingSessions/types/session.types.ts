// ═══════════════════════════════════════════════════════════
// TRAINING SESSION TYPES — T-150
// ═══════════════════════════════════════════════════════════

export type SessionType = 'Theory' | 'Practical' | 'Drill' | 'Firing' | 'Field' | 'Map Reading' | 'First Aid';

export interface TrainingSession {
  id: string;
  batchId: string;
  subject: string;
  topic: string;
  sessionDate: string;        // YYYY-MM-DD
  period: string;             // e.g. "Period 1"
  instructorId?: string;
  instructorName?: string;
  sessionType: SessionType;
  duration: number;           // minutes
  attendanceTaken: boolean;
  attendanceCount?: number;
  totalTrainees?: number;
  syllabusTopicId?: string;   // Link to syllabus
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export const SESSION_TYPE_CONFIG: Record<SessionType, { icon: string; color: string }> = {
  'Theory':       { icon: '📖', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  'Practical':    { icon: '🔧', color: 'bg-green-100 text-green-700 border-green-300' },
  'Drill':        { icon: '🎖️', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  'Firing':       { icon: '🎯', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  'Field':        { icon: '⛺', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  'Map Reading':  { icon: '🗺️', color: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
  'First Aid':    { icon: '🏥', color: 'bg-rose-100 text-rose-700 border-rose-300' },
};
