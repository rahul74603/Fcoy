import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../../config/firebase'; // Path check kar lena

interface StudentFormProps {
  onSuccess: () => void;
  initialData?: any;
}

export const StudentForm = ({ onSuccess, initialData }: StudentFormProps) => {
  const [formData, setFormData] = useState({
    examRollNo: '',
    chestNo: '',
    name: '',
    aadhaarNo: '',
    panNo: '',
    bankAccount: '',
    ifscCode: '',
    platoon: 'Platoon 1',
    medStat: 'SHAPE-1',
    attn: 'P',
    docsComplete: false,
    kitIssued: false,
    messBill: 3500,
    messPaid: 0,
    remarks: 'New Batch 2027 Enlistment'
  });

  // Agar 'initialData' aaya (Edit Mode), toh form bhar do
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (initialData?.id) {
        // Edit Mode: Purane record ko update karo
        await updateDoc(doc(db, 'trainees', initialData.id), formData);
        alert("Record Updated Successfully!");
      } else {
        // Add Mode: Naya record banao
        await addDoc(collection(db, 'trainees'), formData);
        alert("New Recruit Added Successfully!");
      }
      onSuccess();
    } catch (err) {
      alert("Error saving data");
      console.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <input className="border p-2 text-xs" placeholder="Chest No" required value={formData.chestNo} onChange={e => setFormData({...formData, chestNo: e.target.value})} />
        <input className="border p-2 text-xs" placeholder="Full Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <input className="border p-2 text-xs" placeholder="Aadhaar No" value={formData.aadhaarNo} onChange={e => setFormData({...formData, aadhaarNo: e.target.value})} />
        <input className="border p-2 text-xs" placeholder="Bank Account" value={formData.bankAccount} onChange={e => setFormData({...formData, bankAccount: e.target.value})} />
      </div>

      <button type="submit" className="w-full bg-military-800 text-white font-bold py-2 text-xs uppercase">
        {initialData?.id ? 'Update Record' : 'Save Recruit'}
      </button>
    </form>
  );
};