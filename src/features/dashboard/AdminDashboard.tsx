import { Users, Shield, FileText, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock Data for the chart
const attendanceData = [
  { name: 'Alpha COY', present: 120, leave: 5 },
  { name: 'Bravo COY', present: 98, leave: 12 },
  { name: 'Charlie COY', present: 115, leave: 2 },
  { name: 'Delta COY', present: 105, leave: 8 },
];

export const AdminDashboard = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
      
      {/* Top Header Section */}
      <div className="flex justify-between items-center mb-8 bg-white p-4 border-l-4 border-green-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">HQ Training Command</h1>
          <p className="text-sm text-gray-500 font-medium">BSF Training Center Management System</p>
        </div>
        <div className="flex items-center space-x-4">
          <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded border border-green-300">
            Role: SUPER ADMIN
          </span>
          <div className="h-10 w-10 bg-green-900 rounded-full flex items-center justify-center text-white font-bold">
            HQ
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 border-t-4 border-green-800 shadow-sm rounded-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-semibold">Total Trainees</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-1">1,245</h3>
            </div>
            <Users className="text-green-800 h-8 w-8 opacity-80" />
          </div>
        </div>

        <div className="bg-white p-6 border-t-4 border-green-700 shadow-sm rounded-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-semibold">Active Companies</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-1">12</h3>
            </div>
            <Shield className="text-green-700 h-8 w-8 opacity-80" />
          </div>
        </div>

        <div className="bg-white p-6 border-t-4 border-gray-600 shadow-sm rounded-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-semibold">Pending Verifications</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-1">48</h3>
            </div>
            <FileText className="text-gray-600 h-8 w-8 opacity-80" />
          </div>
        </div>

        <div className="bg-white p-6 border-t-4 border-red-700 shadow-sm rounded-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500 font-semibold">On Leave / Sick</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-1">27</h3>
            </div>
            <Activity className="text-red-700 h-8 w-8 opacity-80" />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart Section */}
        <div className="bg-white p-6 shadow-sm rounded-sm lg:col-span-2 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Company Wise Attendance (Today)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '4px', border: '1px solid #e5e7eb'}} />
                <Bar dataKey="present" name="Present" fill="#166534" radius={[2, 2, 0, 0]} />
                <Bar dataKey="leave" name="On Leave" fill="#9ca3af" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Alerts / Status Section */}
        <div className="bg-white p-6 shadow-sm rounded-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Critical Alerts</h3>
          <div className="space-y-4">
            
            <div className="flex items-start p-3 bg-red-50 border-l-4 border-red-600 rounded-r-sm">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-800">Low Ammunition Stock</p>
                <p className="text-xs text-gray-600 mt-1">Alpha COY armory reporting 5.56mm stock below threshold.</p>
              </div>
            </div>

            <div className="flex items-start p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded-r-sm">
              <Activity className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-800">Medical Board Pending</p>
                <p className="text-xs text-gray-600 mt-1">12 trainees pending annual medical checkup in Bravo COY.</p>
              </div>
            </div>

            <div className="flex items-start p-3 bg-green-50 border-l-4 border-green-700 rounded-r-sm">
              <CheckCircle className="h-5 w-5 text-green-700 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-800">Firing Practice Complete</p>
                <p className="text-xs text-gray-600 mt-1">Charlie COY has completed day firing module successfully.</p>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Data Table Section */}
      <div className="mt-8 bg-white shadow-sm rounded-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">Recent Instructor Deployments</h3>
          <button className="text-sm bg-green-800 text-white px-4 py-2 rounded shadow-sm hover:bg-green-900 transition">
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
                <th className="px-6 py-3 border-b font-semibold">Service No.</th>
                <th className="px-6 py-3 border-b font-semibold">Name & Rank</th>
                <th className="px-6 py-3 border-b font-semibold">Company</th>
                <th className="px-6 py-3 border-b font-semibold">Subject</th>
                <th className="px-6 py-3 border-b font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-800">
              <tr className="hover:bg-gray-50 border-b border-gray-100">
                <td className="px-6 py-4 font-mono text-gray-600">IRLA-84729</td>
                <td className="px-6 py-4 font-bold">Insp. Rajeev Singh</td>
                <td className="px-6 py-4">Alpha COY</td>
                <td className="px-6 py-4">Weapon Training</td>
                <td className="px-6 py-4">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">ACTIVE</span>
                </td>
              </tr>
              <tr className="hover:bg-gray-50 border-b border-gray-100">
                <td className="px-6 py-4 font-mono text-gray-600">IRLA-91823</td>
                <td className="px-6 py-4 font-bold">SI Amit Kumar</td>
                <td className="px-6 py-4">Bravo COY</td>
                <td className="px-6 py-4">Physical Training</td>
                <td className="px-6 py-4">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">ACTIVE</span>
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-gray-600">IRLA-75634</td>
                <td className="px-6 py-4 font-bold">HC Vikram Rathore</td>
                <td className="px-6 py-4">Charlie COY</td>
                <td className="px-6 py-4">Field Craft</td>
                <td className="px-6 py-4">
                  <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-bold">COMPLETED</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};