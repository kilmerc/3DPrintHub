
import React, { useState } from 'react';
import { Plus, CheckCircle, Copy, Search, ArrowUp, ArrowDown, ArrowUpDown, GripVertical, AlertTriangle, Check, X, Zap, Trash2 } from 'lucide-react';
import { useAppContext } from '../App';
import { Job, JobStatus, Urgency, Spool } from '../types';

type SortField = 'name' | 'urgency' | 'printTimeMinutes' | 'gramsRequired' | 'status' | 'nozzleSize';
type SortDirection = 'asc' | 'desc';

const QueuePage: React.FC = () => {
  const { data, updateJobs } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('urgency');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getUrgencyWeight = (u: Urgency) => {
    switch (u) {
      case Urgency.Critical: return 0;
      case Urgency.High: return 1;
      case Urgency.Normal: return 2;
      case Urgency.Low: return 3;
      default: return 4;
    }
  };

  const processedJobs = data.jobs
    .filter(j => {
      const matchesStatus = showCompleted ? true : (j.status === JobStatus.Queued || j.status === JobStatus.Scheduled);
      const matchesSearch = j.name.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'urgency') {
        valA = getUrgencyWeight(a.urgency);
        valB = getUrgencyWeight(b.urgency);
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      
      // Handle undefined nozzleSize for legacy data
      if (sortField === 'nozzleSize') {
          valA = a.nozzleSize || 0.4;
          valB = b.nozzleSize || 0.4;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSave = (job: Job) => {
    if (editingJob) {
      updateJobs(data.jobs.map(j => j.id === job.id ? job : j));
    } else {
      updateJobs([...data.jobs, job]);
    }
    setIsModalOpen(false);
    setEditingJob(null);
  };

  const handleDeleteJob = (id: string) => {
    if (window.confirm("Are you sure you want to delete this job?")) {
      updateJobs(data.jobs.filter(j => j.id !== id));
    }
  };

  const handleClone = (job: Job) => {
    const newJob = { 
      ...job, 
      id: Math.random().toString(36).substr(2, 9), 
      status: JobStatus.Queued,
      name: `${job.name} (Copy)`
    };
    updateJobs([...data.jobs, newJob]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Print Queue</h1>
        <button 
          onClick={() => { setEditingJob(null); setIsModalOpen(true); }}
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition-all"
        >
          <Plus size={20} className="mr-2" />
          Add Job
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex-1 flex items-center space-x-2">
          <Search size={20} className="text-gray-400" />
          <input 
            type="text" 
            placeholder="Search jobs..." 
            className="bg-transparent border-none focus:ring-0 text-sm w-full text-gray-800 dark:text-gray-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden md:block"></div>
        <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
          <input 
            type="checkbox" 
            checked={showCompleted} 
            onChange={e => setShowCompleted(e.target.checked)}
            className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700"
          />
          <span>Show History</span>
        </label>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <SortableHeader label="Job Name" field="name" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="Status" field="status" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="Priority" field="urgency" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="Nozzle" field="nozzleSize" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="Est. Time" field="printTimeMinutes" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="Weight" field="gramsRequired" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Spool</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {processedJobs.map(job => (
              <QueueRow 
                key={job.id} 
                job={job} 
                spools={data.spools}
                onEdit={() => { setEditingJob(job); setIsModalOpen(true); }}
                onClone={() => handleClone(job)}
                onDelete={() => handleDeleteJob(job.id)}
              />
            ))}
            {processedJobs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No jobs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden grid grid-cols-1 gap-4">
        {processedJobs.map(job => (
          <JobCard 
            key={job.id} 
            job={job} 
            spools={data.spools}
            onEdit={() => { setEditingJob(job); setIsModalOpen(true); }}
            onClone={() => handleClone(job)}
            onDelete={() => handleDeleteJob(job.id)}
          />
        ))}
        {processedJobs.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
            No jobs found.
          </div>
        )}
      </div>

      {isModalOpen && (
        <JobModal 
          initialData={editingJob} 
          printers={data.printers}
          spools={data.spools}
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSave} 
        />
      )}
    </div>
  );
};

const SortableHeader: React.FC<{ 
  label: string, 
  field: SortField, 
  currentSort: SortField, 
  direction: SortDirection, 
  onSort: (f: SortField) => void 
}> = ({ label, field, currentSort, direction, onSort }) => {
  return (
    <th 
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        {currentSort === field ? (
          direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>
        ) : (
          <ArrowUpDown size={14} className="text-gray-300"/>
        )}
      </div>
    </th>
  );
};

const QueueRow: React.FC<{ job: Job, spools: Spool[], onEdit: () => void, onClone: () => void, onDelete: () => void }> = ({ job, spools, onEdit, onClone, onDelete }) => {
  const assignedSpool = spools.find(s => s.id === job.assignedSpoolId);
  const isMissingResource = job.assignedSpoolId && !assignedSpool;

  const urgencyColors = {
    [Urgency.Low]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    [Urgency.Normal]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
    [Urgency.High]: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
    [Urgency.Critical]: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
  };

  return (
    <tr className={job.status === JobStatus.Completed ? 'opacity-60' : ''}>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{job.name}</div>
        {job.requiresAMS && <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">AMS Required</span>}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
           job.status === JobStatus.Completed ? 'bg-green-100 text-green-800' : 
           job.status === JobStatus.Scheduled ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {job.status}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
         <span className={`px-2 py-1 rounded text-xs font-medium ${urgencyColors[job.urgency]}`}>{job.urgency}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-800 dark:text-gray-300">
           {job.nozzleSize || 0.4}mm
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {Math.floor(job.printTimeMinutes / 60)}h {job.printTimeMinutes % 60}m
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {job.gramsRequired}g
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
         {isMissingResource ? (
            <div className="flex items-center text-red-500 text-sm font-medium">
              <AlertTriangle size={14} className="mr-1"/> Missing Spool
            </div>
          ) : assignedSpool ? (
            <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
               <div className="w-3 h-3 rounded-full mr-2 flex-shrink-0 border border-gray-200" style={{ backgroundColor: assignedSpool.colorHex }}></div>
               <span className="truncate max-w-[120px]">{assignedSpool.brand}</span>
            </div>
          ) : (
            <span className="text-sm text-yellow-600 dark:text-yellow-500 italic">Unassigned</span>
          )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end gap-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); onClone(); }} className="text-gray-400 hover:text-blue-500 p-1" title="Clone">
            <Copy size={18}/>
          </button>
          {job.status !== JobStatus.Completed && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 px-2">
              Edit
            </button>
          )}
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-500 hover:text-red-700 p-1" title="Delete">
            <Trash2 size={18}/>
          </button>
        </div>
      </td>
    </tr>
  );
};

const JobCard: React.FC<{ job: Job, spools: Spool[], onEdit: () => void, onClone: () => void, onDelete: () => void }> = ({ job, spools, onEdit, onClone, onDelete }) => {
  const assignedSpool = spools.find(s => s.id === job.assignedSpoolId);
  const isMissingResource = job.assignedSpoolId && !assignedSpool;
  
  const urgencyColors = {
    [Urgency.Low]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    [Urgency.Normal]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
    [Urgency.High]: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
    [Urgency.Critical]: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-3 ${job.status === JobStatus.Completed ? 'opacity-75' : ''}`}>
      
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
           <div className="flex items-center gap-2 mb-1">
             <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{job.name}</h3>
             {job.requiresAMS && <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800 px-1 rounded">AMS</span>}
           </div>
           <div className="flex flex-wrap gap-2">
             <span className={`px-2 py-0.5 rounded text-xs font-medium ${urgencyColors[job.urgency]}`}>{job.urgency}</span>
             {job.status === JobStatus.Scheduled && <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">Scheduled</span>}
             {job.status === JobStatus.Completed && <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Done</span>}
           </div>
        </div>
        <div className="flex items-center gap-1">
           <button type="button" onClick={(e) => { e.stopPropagation(); onClone(); }} className="text-gray-400 hover:text-blue-500 p-1"><Copy size={18}/></button>
           <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={18}/></button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm text-gray-500 dark:text-gray-400">
         <div className="flex items-center gap-1"><Zap size={14}/> {job.nozzleSize || 0.4}mm</div>
         <div>⏱ {Math.floor(job.printTimeMinutes / 60)}h {job.printTimeMinutes % 60}m</div>
         <div>⚖️ {job.gramsRequired}g</div>
      </div>

      {/* Filament Status */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
        {isMissingResource ? (
          <div className="flex items-center text-red-500 text-sm font-medium">
            <AlertTriangle size={16} className="mr-1"/> Missing Spool
          </div>
        ) : assignedSpool ? (
          <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
             <div className="w-3 h-3 rounded-full mr-2 border border-gray-200" style={{ backgroundColor: assignedSpool.colorHex }}></div>
             <span className="truncate max-w-[150px]">{assignedSpool.brand} {assignedSpool.material}</span>
          </div>
        ) : (
          <span className="text-sm text-yellow-600 dark:text-yellow-500 italic">No Spool Assigned</span>
        )}
        
        {job.status !== JobStatus.Completed && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors">Edit</button>
        )}
      </div>
    </div>
  );
};

const JobModal: React.FC<{ 
  initialData: Job | null, 
  printers: any[], 
  spools: Spool[], 
  onClose: () => void, 
  onSave: (j: Job) => void 
}> = ({ initialData, spools, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Job>>(initialData || {
    name: '', printTimeMinutes: 60, gramsRequired: 50, nozzleSize: 0.4, requiresAMS: false, urgency: Urgency.Normal, 
    status: JobStatus.Queued, compatiblePrinterIds: [], assignedSpoolId: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
    } as Job);
  };

  const inputClass = "w-full rounded-md border border-gray-300 bg-white text-gray-900 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{initialData ? 'Edit Job' : 'Add New Job'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><CheckCircle size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job Name</label>
            <input required type="text" className={inputClass} 
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nozzle</label>
               <select className={inputClass} value={formData.nozzleSize || 0.4} onChange={e => setFormData({...formData, nozzleSize: Number(e.target.value)})}>
                  <option value={0.2}>0.2 mm</option>
                  <option value={0.4}>0.4 mm</option>
                  <option value={0.6}>0.6 mm</option>
                  <option value={0.8}>0.8 mm</option>
               </select>
            </div>
            <div className="col-span-1">
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time (min)</label>
               <input required type="number" className={inputClass} 
                value={formData.printTimeMinutes} onChange={e => setFormData({...formData, printTimeMinutes: Number(e.target.value)})} />
            </div>
            <div className="col-span-1">
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight (g)</label>
               <input required type="number" className={inputClass} 
                value={formData.gramsRequired} onChange={e => setFormData({...formData, gramsRequired: Number(e.target.value)})} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assigned Spool</label>
            <select 
              className={inputClass}
              value={formData.assignedSpoolId || ''}
              onChange={e => setFormData({...formData, assignedSpoolId: e.target.value})}
            >
              <option value="">-- Select Filament --</option>
              {spools.filter(s => s.status === 'Active').map(s => (
                <option key={s.id} value={s.id}>
                  {s.brand} {s.material} - {s.colorName} ({s.currentWeight - s.emptySpoolWeight}g left)
                </option>
              ))}
            </select>
            {formData.assignedSpoolId && (() => {
               const s = spools.find(sp => sp.id === formData.assignedSpoolId);
               if (s && (s.currentWeight - s.emptySpoolWeight) < (formData.gramsRequired || 0)) {
                 return <p className="text-xs text-red-500 mt-1">Warning: Not enough filament on this spool.</p>;
               }
               return null;
            })()}
          </div>

          <div className="flex items-center justify-between pt-2">
             <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input type="checkbox" className="rounded text-blue-600" 
                  checked={formData.requiresAMS} onChange={e => setFormData({...formData, requiresAMS: e.target.checked})} />
                <span>Requires AMS</span>
             </label>

             <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Urgency:</label>
                <select className="rounded-md border border-gray-300 bg-white text-gray-900 p-1 text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  value={formData.urgency} onChange={e => setFormData({...formData, urgency: e.target.value as Urgency})}>
                  {Object.values(Urgency).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
             </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Save Job</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QueuePage;
