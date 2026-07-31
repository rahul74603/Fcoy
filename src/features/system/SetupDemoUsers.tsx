import { useState, useEffect } from 'react';
import { auth, db } from '../../config/firebase';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { AlertTriangle, Database } from 'lucide-react';
// ★ Module 19: feature-flag gate (system_config/flags.enableSeedTools)
import { getSystemFlags } from './systemHealth.api';

const DEMO_USERS = [
  { email: 'commander@fcoy.local', pass: 'Commander@123', name: 'Cmdr. F Coy', role: 'Company Commander', desig: 'AC / DC' },
  { email: 'qm@fcoy.local', pass: 'QM@12345', name: 'QM F Coy', role: 'Quarter Master', desig: 'Inspector / Sub Insp' },
  { email: 'clerk@fcoy.local', pass: 'Clerk@12345', name: 'Clerk F Coy', role: 'Clerk', desig: 'Head Constable' },
  { email: 'ustad@fcoy.local', pass: 'Ustad@12345', name: 'Ustad F Coy', role: 'Ustad', desig: 'Constable / HC' },
];

export const SetupDemoUsers = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // ★ Module 19: production-safety gate — flag OFF ho to screen block
  const [seedAllowed, setSeedAllowed] = useState<boolean | null>(null);
  useEffect(() => { getSystemFlags().then(f => setSeedAllowed(f.enableSeedTools)); }, []);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const generateUsers = async () => {
    setLoading(true);
    addLog('Starting User Generation...');

    for (const user of DEMO_USERS) {
      try {
        addLog(`Creating Auth for: ${user.email}`);
        const userCred = await createUserWithEmailAndPassword(auth, user.email, user.pass);
        
        addLog(`Creating Firestore Profile for: ${user.role}`);
        await setDoc(doc(db, 'users', userCred.user.uid), {
          name: user.name,
          email: user.email,
          phone: '0000000000',
          designation: user.desig,
          role: user.role,
          isActive: true,
          createdAt: new Date().toISOString(),
          createdBy: 'SystemSetup'
        });
        
        addLog(`✅ SUCCESS: ${user.role} created.`);
      } catch (error: any) {
        addLog(`❌ ERROR on ${user.email}: ${error.message}`);
      }
    }

    addLog('Logging out of setup session...');
    await signOut(auth);
    addLog('All Done. Safe to navigate to /login.');
    setLoading(false);
  };

  // ★ Module 19: seed tools flag gate
  if (seedAllowed === null) {
    return <div className="p-6 text-center text-xs font-bold text-slate-400 uppercase">Checking feature flags…</div>;
  }
  if (seedAllowed === false) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-6 bg-white border-2 border-red-400 shadow-flat text-center">
        <AlertTriangle className="text-red-500 mx-auto mb-3" size={32} />
        <h1 className="text-lg font-black text-red-700 uppercase">Demo Tools Blocked (Production Mode)</h1>
        <p className="text-xs text-slate-600 mt-2">
          Ye utility CC ne <strong>System Health → Feature Flags → Seed/Demo Tools</strong> se band ki hai.
          Production mode mein demo users inject karna blocked hai.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white border-2 border-amber-500 shadow-flat">
      <div className="flex items-center space-x-3 mb-4 border-b-2 border-amber-500 pb-2">
        <AlertTriangle className="text-amber-500" size={28} />
        <div>
          <h1 className="text-xl font-black text-military-900 uppercase">Development Setup Utility</h1>
          <p className="text-xs font-bold text-red-600 uppercase">WARNING: DO NOT DEPLOY THIS TO PRODUCTION.</p>
        </div>
      </div>

      <p className="text-sm text-slate-700 mb-6 font-medium">
        This utility will inject 4 hardcoded development users into Firebase Authentication and Firestore. 
        It will overwrite your current active session. Only run this once.
      </p>

      <button 
        onClick={generateUsers} 
        disabled={loading}
        className="w-full bg-amber-500 text-white font-black uppercase py-3 flex justify-center items-center hover:bg-amber-600 transition-colors"
      >
        <Database className="mr-2" />
        {loading ? 'Injecting Data...' : 'Initialize Demo Users'}
      </button>

      <div className="mt-6 bg-slate-900 text-green-400 p-4 font-mono text-xs rounded-sm h-64 overflow-y-auto">
        {logs.map((log, idx) => (
          <div key={idx}>{`> ${log}`}</div>
        ))}
        {!logs.length && <div>Waiting for execution...</div>}
      </div>
    </div>
  );
};