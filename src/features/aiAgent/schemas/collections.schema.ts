// Ye file batati hai AI ko ki Firebase mein kya kya collections hain
// aur unke fields kaise hote hain

export const COLLECTIONS_SCHEMA = {

  trainees: {
    description: "Training mein aaye recruits ki list",
    requiredFields: ["name", "chestNo", "batchId"],
    fields: {
      name:                 { type: "string",    required: true  },
      chestNo:              { type: "string",    required: true  },
      batchId:              { type: "string",    required: true  },
      batchName:            { type: "string",    required: false },
      batchNumber:          { type: "string",    required: false },
      age:                  { type: "string",    required: false },
      dob:                  { type: "string",    required: false },
      gender:               { type: "string",    required: false, options: ["Male", "Female"] },
      bloodGroup:           { type: "string",    required: false },
      category:             { type: "string",    required: false, options: ["General", "OBC", "SC", "ST"] },
      aadharNo:             { type: "string",    required: false },
      education:            { type: "string",    required: false },
      fatherName:           { type: "string",    required: false },
      emergencyContact:     { type: "string",    required: false },
      emergencyContactName: { type: "string",    required: false },
      district:             { type: "string",    required: false },
      height:               { type: "string",    required: false },
      dressSize:            { type: "string",    required: false },
      attn:                 { type: "string",    required: false, options: ["P", "A", "L"] },
      fptResult:            { type: "string",    required: false },
      fptScore:             { type: "string",    required: false },
      status:               { type: "string",    required: false },
      createdAt:            { type: "timestamp", required: false },
      addedBy:              { type: "string",    required: false },
      source:               { type: "string",    required: false },
    },
  },

  leaves: {
    description: "Trainees ki leave records",
    requiredFields: ["chestNo", "reason"],
    fields: {
      chestNo:     { type: "string",    required: true  },
      traineeName: { type: "string",    required: false },
      traineeId:   { type: "string",    required: false },
      reason:      { type: "string",    required: true  },
      leaveType:   { type: "string",    required: false, options: ["medical", "casual", "emergency", "general"] },
      startDate:   { type: "string",    required: false },
      endDate:     { type: "string",    required: false },
      status:      { type: "string",    required: false },
      createdAt:   { type: "timestamp", required: false },
      addedBy:     { type: "string",    required: false },
    },
  },

  batches: {
    description: "Training batches ki list",
    requiredFields: ["batchName", "batchNumber"],
    fields: {
      batchName:     { type: "string", required: true  },
      batchNumber:   { type: "string", required: true  },
      startDate:     { type: "string", required: false },
      endDate:       { type: "string", required: false },
      status:        { type: "string", required: false },
      totalTrainees: { type: "number", required: false },
    },
  },

  weeklyPrograms: {
    description: "Weekly training schedule",
    requiredFields: ["weekNumber", "subject"],
    fields: {
      weekNumber:  { type: "number", required: true  },
      subject:     { type: "string", required: true  },
      day:         { type: "string", required: false },
      time:        { type: "string", required: false },
      instructor:  { type: "string", required: false },
      venue:       { type: "string", required: false },
    },
  },

};

// ─────────────────────────────────────────
// Ye function AI ke liye schema ko
// simple text mein convert karta hai
// ─────────────────────────────────────────
export function getSchemaForAI(): string {
  let text = "=== FIREBASE COLLECTIONS ===\n\n";

  for (const [collectionName, schema] of Object.entries(COLLECTIONS_SCHEMA)) {
    text += `📁 ${collectionName.toUpperCase()}\n`;
    text += `   Kaam: ${schema.description}\n`;
    text += `   Zaruri fields: ${schema.requiredFields.join(", ")}\n`;
    text += `   Saare fields:\n`;

    for (const [fieldName, fieldInfo] of Object.entries(schema.fields)) {
      const info = fieldInfo as any;
      let line = `     - ${fieldName} (${info.type})`;
      if (info.required) line += " [ZARURI]";
      if (info.options) line += ` [Options: ${info.options.join("/")}]`;
      text += line + "\n";
    }

    text += "\n";
  }

  return text;
}