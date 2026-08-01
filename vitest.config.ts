// vitest.config.ts — sirf `npm run test:rules` (Firestore/Storage emulator tests) ke liye.
// Ye file app build ko TOUCH nahi karti (vite build sirf vite.config.ts use karta hai).
//
// ➕ ADD (01-Aug): pehla real run Windows PC par hua — Java emulator + Listen
// retries mile-milisec slow hote hain; default 5s timeout par healthy test bhi
// "Test timed out" mar gaya tha. Emulator tests network-RPC hote hain (unit nahi),
// isliye generous timeouts.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Har individual test max 20s (emulator RPC round-trips)
    testTimeout: 20000,
    // beforeAll/afterAll/beforeEach hooks max 30s (seed/clear cycles)
    hookTimeout: 30000,
    // Rules tests sequence me hi chalne chahiye (ek hi emulator instance share hota hai;
    // parallel files me clearFirestore race kar sakta hai)
    fileParallelism: false,
  },
});
