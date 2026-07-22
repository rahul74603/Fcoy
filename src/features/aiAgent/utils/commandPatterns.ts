// ═══════════════════════════════════════════════════════════
// COMMAND PATTERNS - Simple Greeting Detector
// ═══════════════════════════════════════════════════════════
// Kaam: Sirf greetings, thanks, bye, help detect karta hai
// Baaki sab kaam Groq AI karega (smart hai woh)
// Ye file fast aur reliable rakhi hai - sirf 100% sure cases
// ═══════════════════════════════════════════════════════════

export interface QuickResponse {
  matched: boolean;
  action?: string;
  reply?: string;
}

// ─────────────────────────────────────────────────────────
// GREETING PATTERNS
// ─────────────────────────────────────────────────────────
const GREETING_PATTERNS = [
  /^\s*(?:hello|hi+|hey+|namaste|namaskar|salaam|salam|hola|yo|sup|adaab|ram\s*ram)\s*[!.?,]*\s*$/i,
  /^\s*(?:good\s+(?:morning|evening|afternoon|night|day))\s*[!.?,]*\s*$/i,
  /^\s*(?:kaise\s+(?:ho|hain|hai|aap))\s*[!.?,]*\s*$/i,
  /^\s*(?:kya\s+haal|whats\s*up|sab\s+(?:badhiya|theek|sahi))\s*[!.?,]*\s*$/i,
];

// ─────────────────────────────────────────────────────────
// THANKS PATTERNS
// ─────────────────────────────────────────────────────────
const THANKS_PATTERNS = [
  /^\s*(?:thanks?|thank\s*you|thx|ty|shukriya|dhanyawad|dhanyavaad|meherbani)\s*[!.?,]*\s*$/i,
  /^\s*(?:bahut|bohot|very|much)\s+(?:shukriya|thanks|dhanyawad)\s*[!.?,]*\s*$/i,
];

// ─────────────────────────────────────────────────────────
// BYE PATTERNS
// ─────────────────────────────────────────────────────────
const BYE_PATTERNS = [
  /^\s*(?:bye+|goodbye|good\s*bye|see\s*you|alvida|tata|ok\s*bye|gtg|cya)\s*[!.?,]*\s*$/i,
  /^\s*(?:chalo\s*bye|theek\s*hai\s*bye|ok\s*chalo)\s*[!.?,]*\s*$/i,
];

// ─────────────────────────────────────────────────────────
// HELP PATTERNS
// ─────────────────────────────────────────────────────────
const HELP_PATTERNS = [
  /^\s*(?:help|madad|sahayata|commands?|options?|menu)\s*[!.?,]*\s*$/i,
  /(?:kya|what)\s+(?:kar|can)\s+(?:sakte|sakta|you|do)/i,
  /how\s+(?:to\s+use|do\s+i\s+use)/i,
  /(?:mujhe|me)\s+(?:kya|what)\s+karna/i,
];

// ─────────────────────────────────────────────────────────
// ACKNOWLEDGMENT PATTERNS (ok, haan, theek hai)
// ─────────────────────────────────────────────────────────
const ACK_PATTERNS = [
  /^\s*(?:ok+|okay|theek\s*hai|thik\s*hai|haan|han|yes|haa+|yup|yeah|sahi\s*hai|done)\s*[!.?,]*\s*$/i,
  /^\s*(?:nahi+|no|nope|nahin|nai)\s*[!.?,]*\s*$/i,
];

// ═══════════════════════════════════════════════════════════
// MAIN FUNCTION: Quick check karo
// ═══════════════════════════════════════════════════════════
export function checkQuickResponse(text: string): QuickResponse {
  const cleanText = text.trim();
  if (!cleanText) return { matched: false };

  // ─── GREETING ───
  if (GREETING_PATTERNS.some((p) => p.test(cleanText))) {
    console.log("⚡ Quick Match: GREETING");
    return {
      matched: true,
      action: "greeting",
      reply: getRandomReply([
        "Namaste! 🙏 Main aapka Training Center AI hu. Kya kaam hai batao!",
        "Hello! 👋 Main ready hu. Kya karna hai?",
        "Namaskar! 🎯 Bolo kya help chahiye?",
        "Salaam! 😊 Aapki seva mein hazir hu. Command do!",
      ]),
    };
  }

  // ─── THANKS ───
  if (THANKS_PATTERNS.some((p) => p.test(cleanText))) {
    console.log("⚡ Quick Match: THANKS");
    return {
      matched: true,
      action: "greeting",
      reply: getRandomReply([
        "Aapka swagat hai! 😊 Aur kuch kaam ho to batao!",
        "Khushi hui madad karke! 🎉 Aur kya chahiye?",
        "Welcome! 👍 Bas yahi kaam hai mera!",
        "Koi baat nahi! 🙏 Ye to mera farz hai!",
      ]),
    };
  }

  // ─── BYE ───
  if (BYE_PATTERNS.some((p) => p.test(cleanText))) {
    console.log("⚡ Quick Match: BYE");
    return {
      matched: true,
      action: "greeting",
      reply: getRandomReply([
        "Alvida! 👋 Jab bhi kaam ho, yahan hu main!",
        "Bye! 🙋 Take care, milte hain!",
        "Phir milenge! 😊 Khush raho!",
        "Tata! 👍 Kabhi bhi yaad karo!",
      ]),
    };
  }

  // ─── HELP ───
  if (HELP_PATTERNS.some((p) => p.test(cleanText))) {
    console.log("⚡ Quick Match: HELP");
    return {
      matched: true,
      action: "help",
      reply: `📋 **Main ye sab kar sakta hu:**

🎯 **Trainee Management:**
• "Rahul ko add karo"
• "Rahul, Ravi, Suresh ko trainee banao"
• "Chest 5 ki age 25 karo"
• "Chest 10 ka blood group B+ update karo"

🏥 **Leave Management:**
• "Chest 30 ko hospital leave do"
• "Trainee 5 ko medical leave 2 din"
• "Chest 5 ko emergency leave family problem"

📋 **Information:**
• "List dikhao"
• "Saare trainees"  
• "Kitne trainees hain"
• "Chest 5 ka detail batao"

📅 **Weekly Program:**
• "Aaj ka schedule dikhao"
• "Monday ka program"
• 📸 Image upload karo (purple button)

🎤 **Voice Input:** Mic button se Hindi mein bol sakte ho!

Bas naturally bolo, main samajh jaunga! 💪`,
    };
  }

  // ─── ACKNOWLEDGMENT ───
  if (ACK_PATTERNS.some((p) => p.test(cleanText))) {
    console.log("⚡ Quick Match: ACKNOWLEDGMENT");
    return {
      matched: true,
      action: "greeting",
      reply: getRandomReply([
        "👍 Aur kuch kaam ho to batao!",
        "✅ Theek hai, aur kya karna hai?",
        "🎯 Ready hu, agla command do!",
      ]),
    };
  }

  // Kuch quick match nahi hua - AI ko bhejna padega
  return { matched: false };
}

// ═══════════════════════════════════════════════════════════
// HELPER: Random reply pick karo (variety ke liye)
// ═══════════════════════════════════════════════════════════
function getRandomReply(replies: string[]): string {
  return replies[Math.floor(Math.random() * replies.length)];
}

// ═══════════════════════════════════════════════════════════
// TESTING FUNCTION (debug ke liye)
// ═══════════════════════════════════════════════════════════
export function testQuickResponses(testCases: string[]): void {
  console.log("\n═══════════════════════════════════════");
  console.log("⚡ QUICK RESPONSE TESTING");
  console.log("═══════════════════════════════════════\n");

  let matched = 0;
  let notMatched = 0;

  testCases.forEach((text, i) => {
    const result = checkQuickResponse(text);
    if (result.matched) {
      console.log(`✅ ${i + 1}. "${text}" → ${result.action}`);
      matched++;
    } else {
      console.log(`➡️  ${i + 1}. "${text}" → Will go to AI`);
      notMatched++;
    }
  });

  console.log("\n═══════════════════════════════════════");
  console.log(`📊 Results: ${matched} quick matched, ${notMatched} → AI`);
  console.log("═══════════════════════════════════════\n");
}