import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, Download, FileText, 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, 
  MoreVertical, FileSpreadsheet
} from 'lucide-react';

export interface Column<T> {
  header: string;
  accessor: keyof T | string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  title?: string;
  columns: Column<T>[];
  data: T[];
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  onRowAction?: (action: string, row: T) => void;
}

export function DataTable<T extends Record<string, any>>({ 
  title, 
  columns, 
  data,
  onExportExcel,
  onExportPDF
}: DataTableProps<T>) {
  
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Search & Filter Logic
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    return data.filter(row => 
      Object.values(row).some(val => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm]);

  // Sorting Logic
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  // Pagination Logic
  const totalPages = Math.ceil(sortedData.length / rowsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * rowsPerPage, 
    currentPage * rowsPerPage
  );

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="flex flex-col bg-white border border-slate-300 shadow-flat w-full h-full min-h-0">
      
      {/* Table Toolbar */}
      <div className="flex justify-between items-center bg-slate-200 border-b border-slate-300 px-3 py-2">
        <div className="flex items-center space-x-4">
          {title && <span className="text-[12px] font-bold uppercase tracking-wider text-military-900">{title}</span>}
          
          {/* Global Search */}
          <div className="relative flex items-center">
            <Search className="absolute left-2 text-slate-500" size={12} />
            <input 
              type="text" 
              placeholder="Search all columns..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="text-[11px] pl-7 pr-2 py-1 border border-slate-300 w-64 focus:outline-none focus:border-military-500 bg-white"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-1 border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50 transition-colors text-slate-700">
            <Filter size={12} />
            <span className="text-[10px] font-bold uppercase">Filter</span>
          </button>
          <div className="h-4 w-px bg-slate-300 mx-1"></div>
          <button 
            onClick={onExportExcel}
            className="flex items-center space-x-1 border border-military-600 bg-military-50 px-2 py-1 hover:bg-military-100 transition-colors text-military-800"
          >
            <FileSpreadsheet size={12} />
            <span className="text-[10px] font-bold uppercase">Excel</span>
          </button>
          <button 
            onClick={onExportPDF}
            className="flex items-center space-x-1 border border-red-200 bg-red-50 px-2 py-1 hover:bg-red-100 transition-colors text-red-700"
          >
            <FileText size={12} />
            <span className="text-[10px] font-bold uppercase">PDF</span>
          </button>
        </div>
      </div>

      {/* Table Container with Sticky Header */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-white relative">
        <table className="w-full text-[11px] text-left border-collapse whitespace-nowrap">
          <thead className="sticky top-0 bg-slate-100 z-10 shadow-[0_1px_0_0_#cbd5e1]">
            <tr className="text-slate-700 border-b border-slate-300 uppercase tracking-wide">
              {columns.map((col, idx) => (
                <th 
                  key={idx} 
                  className={`px-3 py-2 font-bold border-r border-slate-300 select-none ${col.sortable ? 'cursor-pointer hover:bg-slate-200' : ''}`}
                  onClick={() => col.sortable && handleSort(col.accessor as string)}
                  style={{ textAlign: col.align || 'left' }}
                >
                  <div className={`flex items-center space-x-1 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                    <span>{col.header}</span>
                    {col.sortable && (
                      <div className="flex flex-col text-slate-400">
                        <ChevronUp size={10} className={`${sortConfig?.key === col.accessor && sortConfig.direction === 'asc' ? 'text-military-700' : '-mb-1'}`} />
                        <ChevronDown size={10} className={`${sortConfig?.key === col.accessor && sortConfig.direction === 'desc' ? 'text-military-700' : ''}`} />
                      </div>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 font-bold text-center w-10">Act</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-slate-200 hover:bg-slate-50 even:bg-slate-50/50">
                  {columns.map((col, colIndex) => (
                    <td 
                      key={colIndex} 
                      className="px-3 py-1.5 border-r border-slate-200"
                      style={{ textAlign: col.align || 'left' }}
                    >
                      {col.render ? col.render(row) : (row[col.accessor as keyof T] as React.ReactNode)}
                    </td>
                  ))}
                  {/* Row Actions */}
                  <td className="px-3 py-1.5 text-center">
                    <button className="text-slate-400 hover:text-military-700 p-0.5 rounded focus:outline-none focus:bg-slate-200">
                      <MoreVertical size={14} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-slate-500 font-semibold">
                  No records found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="bg-slate-100 border-t border-slate-300 px-3 py-1.5 flex justify-between items-center text-[10px] text-slate-600">
        <div className="flex items-center space-x-4">
          <span>Showing {sortedData.length === 0 ? 0 : ((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, sortedData.length)} of {sortedData.length} records</span>
          <div className="flex items-center space-x-1">
            <span>Rows per page:</span>
            <select 
              value={rowsPerPage} 
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="border border-slate-300 bg-white px-1 py-0.5 focus:outline-none focus:border-military-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
        
        <div className="flex space-x-1 items-center">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 border border-slate-300 bg-white hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <ChevronLeft size={12} />
          </button>
          
          <div className="flex space-x-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, i, arr) => (
                <React.Fragment key={p}>
                  {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-slate-400">...</span>}
                  <button 
                    onClick={() => setCurrentPage(p)}
                    className={`px-2 py-0.5 border border-slate-300 ${currentPage === p ? 'bg-military-800 text-white font-bold' : 'bg-white hover:bg-slate-200'}`}
                  >
                    {p}
                  </button>
                </React.Fragment>
              ))
            }
          </div>

          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="p-1 border border-slate-300 bg-white hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}