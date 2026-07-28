import { useEffect, useState } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { Trash2 } from 'lucide-react';

interface StudentListProps {
  refreshKey: number;
  onDeleteSuccess: () => void;
  onEdit: (student: any) => void; // Ye line add kijiye
}

export const StudentList = ({ refreshKey, onDeleteSuccess }: StudentListProps) => {
  const [trainees, setTrainees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTrainees = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'trainees'));
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setTrainees(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrainees();
  }, [refreshKey]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Kya aap is jawan ka record delete karna chahte hain?')) {
      try {
        await deleteDoc(doc(db, 'trainees', id));
        onDeleteSuccess();
      } catch (err) {
        alert('Could not delete record');
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 border border-slate-300 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-military-700 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 border border-slate-300 shadow-flat overflow-x-auto">
      <h3 className="text-xs font-bold text-military-900 uppercase tracking-wider mb-3">Master Enlistment Roster ({trainees.length} Jawans)</h3>
      <table className="min-w-full text-left text-[11px] border-collapse">
        <thead>
          <tr className="bg-slate-100 border-y border-slate-200 text-slate-600 uppercase font-bold">
            <th className="p-2 border">Roll No.</th>
            <th className="p-2 border">Chest No.</th>
            <th className="p-2 border">Rank & Name</th>
            <th className="p-2 border">Aadhaar Card</th>
            <th className="p-2 border">PAN Card</th>
            <th className="p-2 border">Bank Account & IFSC</th>
            <th className="p-2 border text-center">Action</th>
          </tr>
        </thead>
        <tbody className="text-slate-800">
          {trainees.map((t) => (
            <tr key={t.id} className="border-b hover:bg-slate-50">
              <td className="p-2 border font-mono font-bold text-military-900">{t.examRollNo || 'N/A'}</td>
              <td className="p-2 border font-bold text-status-info">{t.chestNo || 'N/A'}</td>
              <td className="p-2 border font-bold">{t.name}</td>
              <td className="p-2 border font-mono">{t.aadhaarNo || 'N/A'}</td>
              <td className="p-2 border font-mono uppercase">{t.panNo || 'N/A'}</td>
              <td className="p-2 border">
                <span className="block font-mono font-semibold">{t.bankAccount}</span>
                <span className="text-[10px] text-slate-400 font-mono uppercase">{t.ifscCode}</span>
              </td>
              <td className="p-2 border text-center">
                <button
                  onClick={() => handleDelete(t.id)}
                  className="bg-red-100 hover:bg-red-200 text-red-700 p-1 rounded transition-colors"
                  title="Remove Recruit"
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
          {trainees.length === 0 && (
            <tr>
              <td colSpan={7} className="p-4 text-center text-slate-400 italic">No recruits registered in this batch yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};