import React, { useState, useEffect } from 'react';
import { UserPlus, Shield } from 'lucide-react';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';

interface UserModel {
  id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

export const UserManagementPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    designation: '',
    role: 'Clerk',
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const userList: UserModel[] = [];
      snap.forEach(docSnap => userList.push({ id: docSnap.id, ...docSnap.data() } as UserModel));
      setUsers(userList);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    
    try {
      const newUserId = `USR-${Date.now()}`; 
      await setDoc(doc(db, 'users', newUserId), {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        designation: formData.designation,
        role: formData.role,
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || 'System'
      });
      
      setMessage('SUCCESS: User profile added to database.');
      setFormData({ name: '', email: '', password: '', phone: '', designation: '', role: 'Clerk' });
      fetchUsers();
    } catch (error) {
      setMessage('ERROR: Failed to create user profile.');
    }
  };

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', id), { isActive: !currentStatus });
      fetchUsers();
    } catch (error) {
      alert("Failed to update status");
    }
  };

  if (user?.role !== 'Company Commander') {
    return <div className="p-4 text-red-600 font-bold uppercase">Restricted Area: Commander Clearance Required</div>;
  }

  const inputClass = "w-full border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:border-military-700 bg-white";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-end border-b-2 border-military-800 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-military-900 uppercase tracking-wider">User Management</h1>
          <p className="text-sm text-slate-500 font-semibold mt-1">Command Control: Staff Access & Roles</p>
        </div>
        <div className="flex space-x-2">
          <span className="bg-military-800 text-white px-3 py-1 text-[10px] font-bold uppercase rounded-sm flex items-center">
            <Shield size={14} className="mr-1"/> Commander Clearance
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ADD USER FORM */}
        <div className="lg:col-span-1">
          <form onSubmit={handleCreateUser} className="bg-white border-t-4 border-t-military-800 border border-slate-300 shadow-flat p-4 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-military-900 flex items-center border-b border-slate-200 pb-2">
              <UserPlus size={16} className="mr-2"/> Register New Staff
            </h2>

            {message && (
              <div className={`p-2 text-[10px] font-bold uppercase ${message.includes('ERROR') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {message}
              </div>
            )}

            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Full Name</label>
            <input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className={inputClass} /></div>
            
            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Email (Login ID)</label>
            <input type="email" required value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className={inputClass} /></div>

            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Phone</label>
              <input type="text" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} className={inputClass} /></div>
              
              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Designation</label>
              <input type="text" placeholder="e.g. Sub Inspector" value={formData.designation} onChange={e=>setFormData({...formData, designation: e.target.value})} className={inputClass} /></div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">System Role</label>
              <select value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})} className={inputClass}>
                <option value="Company Commander">Company Commander</option>
                <option value="Quarter Master">Quarter Master</option>
                <option value="Clerk">Clerk</option>
                <option value="Ustad">Ustad</option>
              </select>
            </div>

            <button type="submit" className="w-full bg-military-800 text-white font-bold uppercase text-xs py-2 hover:bg-military-900 transition-colors">
              Authorize User Profile
            </button>
          </form>
        </div>

        {/* USER LIST */}
        <div className="lg:col-span-2 bg-white border border-slate-300 shadow-flat">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2">
            <span className="text-xs font-bold uppercase text-military-900">Active System Personnel</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px]">Name & Desig</th>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px]">Contact</th>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px]">Role</th>
                  <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-4 text-xs font-bold">Loading Personnel Data...</td></tr>
                ) : (
                  users.map(u => (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <div className="font-bold text-slate-800">{u.name}</div>
                        <div className="text-[10px] text-slate-500 uppercase">{u.designation}</div>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        <div className="text-slate-800">{u.email}</div>
                        <div className="text-slate-500">{u.phone}</div>
                      </td>
                      <td className="px-4 py-2">
                        <span className="bg-military-100 text-military-800 border border-military-200 px-2 py-0.5 text-[10px] font-bold uppercase rounded-sm">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button 
                          onClick={() => toggleUserStatus(u.id, u.isActive)}
                          className={`text-[10px] font-bold uppercase px-3 py-1 rounded-sm border ${u.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                        >
                          {u.isActive ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};