import React from 'react';
import { Shield } from 'lucide-react';

export const UstadDashboard = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end border-b-2 border-military-800 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-military-900 uppercase tracking-wider">Ustad Command</h1>
          <p className="text-sm text-slate-500 font-semibold mt-1">Training Deployment & Field Operations</p>
        </div>
        <span className="bg-military-100 text-military-800 px-3 py-1 text-[10px] border border-military-300 font-bold uppercase rounded-sm flex items-center">
          <Shield size={14} className="mr-1"/> Ustad Access
        </span>
      </div>
      
      <div className="bg-white p-6 border border-slate-300 shadow-flat text-center">
        <p className="text-sm font-bold text-slate-500 uppercase">Weekly Training Program Will Be Displayed Here</p>
      </div>
    </div>
  );
};