// ═══════════════════════════════════════════════════════════
// EXPORT SERVICE — CSV/PDF Export for all registers
// BSF STC Tekanpur — Official record export
// ═══════════════════════════════════════════════════════════

// ── CSV Export ────────────────────────────────────────────
export const exportToCSV = (data: Record<string, any>[], filename: string): void => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        const str = val === null || val === undefined ? '' : String(val);
        // Escape commas and quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    ),
  ];

  const csvContent = csvRows.join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ── Firing Register Export (BSF Pattern) ──────────────────
export const exportFiringRegister = (tests: any[], trainees: any[]): void => {
  const rows: Record<string, any>[] = [];

  for (const test of tests) {
    if (test.testType !== 'firing') continue;
    const results = test.results || [];
    for (const r of results) {
      rows.push({
        'S/No': rows.length + 1,
        'Regt No': r.regNo || '',
        'Rank': r.rank || 'RCT',
        'Name': r.traineeName || '',
        'Platoon': r.platoon || '',
        'Weapon': test.firingConfig?.weaponType || '',
        'Exercise': test.firingConfig?.exerciseName || '',
        'Distance': test.firingConfig?.distance || '',
        'Target Type': test.firingConfig?.targetType || '',
        'Lane No': r.firingDetails?.laneNo || '',
        'Rounds Fired': r.firingDetails?.totalRounds || test.firingConfig?.totalRounds || '',
        'Ring Values': (r.firingDetails?.ringValues || []).join(', '),
        'Actual Score': r.firingDetails?.actualScore ?? r.marks ?? '',
        'Max Score': r.firingDetails?.maxScore ?? test.totalMarks ?? '',
        'Percentage': r.firingDetails?.maxScore ? Math.round(((r.firingDetails.actualScore || 0) / r.firingDetails.maxScore) * 100) + '%' : '',
        'Classification': r.firingDetails?.classification || '',
        'Group Size (mm)': r.firingDetails?.groupSize || '',
        'Date': test.testDate || '',
        'Remarks': r.remarks || '',
      });
    }
  }

  exportToCSV(rows, 'BSF_Firing_Register');
};

// ── Discipline Register Export ────────────────────────────
export const exportDisciplineRegister = (records: any[]): void => {
  const rows = records.map((r, i) => ({
    'S/No': i + 1,
    'Regt No': r.regNo || '',
    'Chest No': r.chestNo || '',
    'Name': r.traineeName || '',
    'Platoon': r.platoon || '',
    'Type': r.type || '',
    'Category': r.category || '',
    'Description': r.description || '',
    'Date': r.date || '',
    'Punishment Days': r.punishmentDays || '',
    'Punishment Type': r.punishmentType || '',
    'Awarded By': r.awardedBy || '',
    'Authority': r.authority || '',
    'Status': r.status || '',
    'Remarks': r.remarks || '',
  }));
  exportToCSV(rows, 'BSF_Anushasan_Register');
};

// ── Attendance Export ─────────────────────────────────────
export const exportAttendanceSummary = (trainees: any[], absentRecords: any[]): void => {
  const absentByTrainee: Record<string, any[]> = {};
  absentRecords.forEach(r => {
    const tid = r.traineeId;
    if (tid) (absentByTrainee[tid] = absentByTrainee[tid] || []).push(r);
  });

  const rows = trainees.map((t, i) => {
    const absences = absentByTrainee[t.id] || [];
    return {
      'S/No': i + 1,
      'Regt No': t.regNo || '',
      'Chest No': t.chestNo || '',
      'Name': t.name || '',
      'Platoon': t.platoon || '',
      'Absent Days': absences.filter(a => a.type === 'A').reduce((s, a) => s + (a.totalDays || 1), 0),
      'Leave Days': absences.filter(a => a.type === 'L').reduce((s, a) => s + (a.totalDays || 1), 0),
      'Sick Days': absences.filter(a => a.type === 'S').reduce((s, a) => s + (a.totalDays || 1), 0),
      'Hospital Days': absences.filter(a => a.type === 'H').reduce((s, a) => s + (a.totalDays || 1), 0),
      'Total Absence': absences.reduce((s, a) => s + (a.totalDays || 1), 0),
    };
  });
  exportToCSV(rows, 'BSF_Attendance_Summary');
};

// ── Final Result Export (Merit List) ──────────────────────
export const exportMeritList = (results: any[]): void => {
  const rows = results.map(r => ({
    'Position': r.position || '',
    'Regt No': r.regNo || '',
    'Chest No': r.chestNo || '',
    'Name': r.traineeName || '',
    'Platoon': r.platoon || '',
    'Obtained Marks': r.obtainedMarks || '',
    'Total Marks': r.totalMarks || '',
    'Percentage': r.percentage + '%' || '',
    'Grade': r.overallGrade || '',
    'FPT': r.fptResult || '',
    'Firing': r.firingClassification || '',
    'Attendance %': r.attendancePercentage + '%' || '',
    'Recommendation': r.recommendation || '',
  }));
  exportToCSV(rows, 'BSF_Merit_List');
};

// ── Trainee Master Export ─────────────────────────────────
export const exportTraineeMaster = (trainees: any[]): void => {
  const rows = trainees.map((t, i) => ({
    'S/No': i + 1,
    'Regt No': t.regNo || '',
    'Chest No': t.chestNo || '',
    'Name': t.name || '',
    'Father': t.fatherName || '',
    'DOB': t.dob || '',
    'Age': t.age || '',
    'Gender': t.gender || '',
    'Blood Group': t.bloodGroup || '',
    'Category': t.category || '',
    'Platoon': t.platoon || '',
    'Section': t.section || '',
    'Mobile': t.mobileNo || '',
    'State': t.state || '',
    'District': t.district || '',
    'Education': t.education || '',
    'Height': t.height || '',
    'Weight': t.weight || '',
    'FPT Result': t.fptResult || '',
    'Status': t.attn || '',
  }));
  exportToCSV(rows, 'BSF_Trainee_Master');
};
