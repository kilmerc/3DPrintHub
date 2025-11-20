
import React, { useState, useRef } from 'react';
import { useAppContext } from '../App';
import { Download, Upload, Trash2, Plus, Moon, Sun, X, Edit, Clock } from 'lucide-react';
import { Printer, JobStatus } from '../types';

const SettingsPage: React.FC = () => {
  const { data, updateSettings, updatePrinters, updateJobs, resetData, importData } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Printer Modal State
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `3dprinthub_export_${new Date().toISOString().slice(0,16).replace(':','')}.json`;
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const res = importData(ev.target?.result as string);
        alert(res.message);
      };
      reader.readAsText(file);
    }
  };

  // Printer Handlers
  const openAddPrinter = () => {
    setEditingPrinter(null);
    setIsPrinterModalOpen(true);
  };

  const openEditPrinter = (printer: Printer) => {
    setEditingPrinter(printer);
    setIsPrinterModalOpen(true);
  };

  const handleSavePrinter = (printer: Printer) => {
    if (editingPrinter) {
      updatePrinters(data.printers.map(p => p.id === printer.id ? printer : p));
    } else {
      updatePrinters([...data.printers, printer]);
    }
    setIsPrinterModalOpen(false);
    setEditingPrinter(null);
  };

  const handleDeletePrinter = (id: string) => {
     if(confirm("Delete printer? Scheduled jobs will move back to queue.")) {
         // 1. Delete printer
         updatePrinters(data.printers.filter(p => p.id !== id));
         
         // 2. Find jobs scheduled on this printer and move them back to queue
         const updatedJobs = data.jobs.map(j => {
             if (j.scheduledPrinterId === id && j.status === JobStatus.Scheduled) {
                 return { 
                    ...j, 
                    status: JobStatus.Queued, 
                    scheduledPrinterId: undefined, 
                    scheduledStartTime: undefined 
                 };
             }
             return j;
         });
         updateJobs(updatedJobs);
     }
  };

  // Availability Handlers
  const addAvailabilityRange = () => {
    const newRange = { start: "09:00", end: "17:00" };
    updateSettings({
      ...data.settings,
      availabilityRanges: [...(data.settings.availabilityRanges || []), newRange]
    });
  };

  const updateAvailabilityRange = (index: number, field: 'start' | 'end', value: string) => {
    const newRanges = [...(data.settings.availabilityRanges || [])];
    newRanges[index] = { ...newRanges[index], [field]: value };
    updateSettings({ ...data.settings, availabilityRanges: newRanges });
  };

  const deleteAvailabilityRange = (index: number) => {
    const newRanges = [...(data.settings.availabilityRanges || [])];
    newRanges.splice(index, 1);
    updateSettings({ ...data.settings, availabilityRanges: newRanges });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      {/* Theme */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4 dark:text-white">Appearance</h2>
        <div className="flex items-center justify-between">
          <span className="text-gray-700 dark:text-gray-300">App Theme</span>
          <button 
            onClick={() => updateSettings({ ...data.settings, theme: data.settings.theme === 'dark' ? 'light' : 'dark' })}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            {data.settings.theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}
          </button>
        </div>
      </section>

      {/* Availability */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold dark:text-white">Availability Hours</h2>
          <button onClick={addAvailabilityRange} className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center">
            <Plus size={16} className="mr-1"/> Add Time Range
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Define when you are available to interact with printers (e.g., clear beds, start jobs). These zones will be highlighted in the scheduler.</p>
        
        <div className="space-y-3">
          {(data.settings.availabilityRanges || []).map((range, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
              <Clock size={18} className="text-gray-400" />
              <div className="flex-1 grid grid-cols-2 gap-4">
                 <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 uppercase font-bold">Start</label>
                    <input 
                      type="time" 
                      value={range.start} 
                      onChange={(e) => updateAvailabilityRange(idx, 'start', e.target.value)}
                      className="p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                 </div>
                 <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 uppercase font-bold">End</label>
                    <input 
                      type="time" 
                      value={range.end} 
                      onChange={(e) => updateAvailabilityRange(idx, 'end', e.target.value)}
                      className="p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                 </div>
              </div>
              <button onClick={() => deleteAvailabilityRange(idx)} className="text-red-500 hover:text-red-700 p-1">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {(data.settings.availabilityRanges || []).length === 0 && (
            <div className="text-center text-gray-500 text-sm italic">No availability times set.</div>
          )}
        </div>
      </section>

      {/* Printers */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
           <h2 className="text-lg font-semibold dark:text-white">Printer Management</h2>
           <button onClick={openAddPrinter} className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center"><Plus size={16} className="mr-1"/> Add Printer</button>
        </div>
        <div className="space-y-2">
           {data.printers.map(p => (
             <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                <div>
                  <div className="font-medium dark:text-white">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.bedSize} • {p.hasAMS ? 'AMS Ready' : 'No AMS'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditPrinter(p)} className="text-indigo-600 hover:text-indigo-800 p-1"><Edit size={18}/></button>
                  <button onClick={() => handleDeletePrinter(p.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={18}/></button>
                </div>
             </div>
           ))}
           {data.printers.length === 0 && (
             <div className="text-center text-gray-500 py-4">No printers added yet.</div>
           )}
        </div>
      </section>

      {/* Data */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4 dark:text-white">Data Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <button onClick={handleExport} className="flex items-center justify-center p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200">
             <Download className="mr-2" /> Export Backup
           </button>
           <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200">
             <Upload className="mr-2" /> Restore Backup
           </button>
           <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
           <h3 className="text-sm font-medium text-red-600 mb-2">Danger Zone</h3>
           <div className="flex gap-4">
              <button onClick={() => resetData('empty')} className="text-sm text-red-500 hover:underline">Clear All Data</button>
              <button onClick={() => resetData('sample')} className="text-sm text-blue-500 hover:underline">Reset to Sample Data</button>
           </div>
        </div>
      </section>

      {isPrinterModalOpen && (
        <PrinterModal 
          initialData={editingPrinter} 
          onClose={() => setIsPrinterModalOpen(false)} 
          onSave={handleSavePrinter} 
        />
      )}
    </div>
  );
};

const PrinterModal: React.FC<{ 
  initialData: Printer | null, 
  onClose: () => void, 
  onSave: (p: Printer) => void 
}> = ({ initialData, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Printer>>(initialData || {
    name: '', bedSize: '220x220x250', hasAMS: false, status: 'Idle'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
    } as Printer);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{initialData ? 'Edit Printer' : 'Add Printer'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Printer Name</label>
            <input 
              required 
              type="text" 
              className="w-full rounded-md border border-gray-300 bg-white text-gray-900 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bed Size (mm)</label>
            <input 
              required 
              type="text" 
              placeholder="e.g. 256x256x256" 
              className="w-full rounded-md border border-gray-300 bg-white text-gray-900 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" 
              value={formData.bedSize} 
              onChange={e => setFormData({...formData, bedSize: e.target.value})} 
            />
          </div>
           <div className="flex items-center space-x-2 pt-2">
              <input 
                type="checkbox" 
                id="hasAMS" 
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                checked={formData.hasAMS} 
                onChange={e => setFormData({...formData, hasAMS: e.target.checked})} 
              />
              <label htmlFor="hasAMS" className="text-sm font-medium text-gray-700 dark:text-gray-300">Has AMS / Multi-Material</label>
           </div>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Save Printer</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
