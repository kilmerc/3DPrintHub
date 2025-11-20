
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../App';
import { Job, JobStatus, Printer, Spool } from '../types';
import { Check, X, ArrowLeft, Wand2 } from 'lucide-react';
import AutoScheduleModal from '../components/AutoScheduleModal';

const SCALE = 2; // pixels per minute

const SchedulerPage: React.FC = () => {
  const { data, updateJobs, updateSpools } = useAppContext();
  const [completionModal, setCompletionModal] = useState<{ job: Job, printer: Printer } | null>(null);
  const [isAutoScheduleOpen, setIsAutoScheduleOpen] = useState(false);
  
  // Start time for the view: Beginning of current hour
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const timelineStart = now.getTime();
  const timelineDurationHours = 24;
  const timelineWidth = (timelineDurationHours * 60) * SCALE;

  const formatDuration = (min: number) => {
      if (min < 60) return `${min}m`;
      return `${(min / 60).toFixed(1)}h`;
  };

  const formatTime12h = (date: Date) => {
      return date.toLocaleTimeString([], { hour: 'numeric', hour12: true }).toLowerCase().replace(' ', '');
  };

  const handleDropTimeline = (e: React.DragEvent, printerId: string) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("jobId");
    
    const job = data.jobs.find(j => j.id === jobId);
    const printer = data.printers.find(p => p.id === printerId);

    if (!job || !printer) return;

    // Validations
    if (job.requiresAMS && !printer.hasAMS) {
      alert("This job requires AMS but the selected printer does not have it.");
      return;
    }

    // Calculate Time
    // e.currentTarget is the lane div (timelineWidth)
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left; 
    const minutesOffset = offsetX / SCALE;
    const startTime = timelineStart + (minutesOffset * 60 * 1000);

    // Check Overlaps
    const jobStart = startTime;
    const jobEnd = startTime + (job.printTimeMinutes * 60 * 1000);
    
    const hasOverlap = data.jobs.some(j => {
      if (j.scheduledPrinterId !== printerId || j.id === jobId || j.status === JobStatus.Completed) return false;
      if (!j.scheduledStartTime) return false;
      const s = new Date(j.scheduledStartTime).getTime();
      const e = s + (j.printTimeMinutes * 60 * 1000);
      return (jobStart < e && jobEnd > s);
    });

    if (hasOverlap) {
      alert("Cannot schedule: Overlaps with an existing job.");
      return;
    }

    updateJobs(data.jobs.map(j => j.id === jobId ? {
      ...j,
      status: JobStatus.Scheduled,
      scheduledPrinterId: printerId,
      scheduledStartTime: new Date(startTime).toISOString()
    } : j));
  };

  const handleDropSidebar = (e: React.DragEvent) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("jobId");
    const source = e.dataTransfer.getData("source");
    
    if (source === 'timeline') {
       // Unschedule
       updateJobs(data.jobs.map(j => j.id === jobId ? {
         ...j,
         status: JobStatus.Queued,
         scheduledPrinterId: undefined,
         scheduledStartTime: undefined
       } : j));
    }
  };

  const handleDragStart = (e: React.DragEvent, job: Job, source: 'sidebar' | 'timeline') => {
      e.dataTransfer.setData("jobId", job.id);
      e.dataTransfer.setData("source", source);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Allow drop
  };

  const handleJobClick = (job: Job, printer: Printer) => {
    setCompletionModal({ job, printer });
  };

  const handleCompleteJob = (result: 'success' | 'failed', deduction: number) => {
    if (!completionModal) return;
    const { job } = completionModal;
    
    // Update Job
    const updatedJob: Job = {
      ...job,
      status: result === 'success' ? JobStatus.Completed : JobStatus.Failed,
      completedDate: new Date().toISOString()
    };

    // Update Inventory
    let newSpools = [...data.spools];
    if (deduction > 0 && job.assignedSpoolId) {
      newSpools = newSpools.map(s => {
         if (s.id === job.assignedSpoolId) {
           return { ...s, currentWeight: Math.max(s.emptySpoolWeight, s.currentWeight - deduction) };
         }
         return s;
      });
    }

    updateJobs(data.jobs.map(j => j.id === job.id ? updatedJob : j));
    updateSpools(newSpools);
    setCompletionModal(null);
  };

  // Calculate Availability Zones
  const availabilityZones = useMemo(() => {
      const zones: { left: number, width: number }[] = [];
      const ranges = data.settings.availabilityRanges || [];
      
      // Iterate over 2 days (today and tomorrow) to cover the 24h timeline
      for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
          const baseDate = new Date(timelineStart);
          baseDate.setDate(baseDate.getDate() + dayOffset);
          baseDate.setHours(0,0,0,0);

          ranges.forEach(range => {
             const [startH, startM] = range.start.split(':').map(Number);
             const [endH, endM] = range.end.split(':').map(Number);
             
             const rangeStart = new Date(baseDate);
             rangeStart.setHours(startH, startM, 0, 0);
             
             const rangeEnd = new Date(baseDate);
             rangeEnd.setHours(endH, endM, 0, 0);

             // Intersect with timeline window
             const timelineEnd = timelineStart + (timelineDurationHours * 60 * 60 * 1000);
             
             const validStart = Math.max(rangeStart.getTime(), timelineStart);
             const validEnd = Math.min(rangeEnd.getTime(), timelineEnd);

             if (validEnd > validStart) {
                 const offsetMs = validStart - timelineStart;
                 const durationMs = validEnd - validStart;
                 zones.push({
                     left: (offsetMs / 1000 / 60) * SCALE,
                     width: (durationMs / 1000 / 60) * SCALE
                 });
             }
          });
      }
      return zones;
  }, [data.settings.availabilityRanges, timelineStart]);


  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-4">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
         <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Print Scheduler</h1>
            <div className="text-sm text-gray-500">Drag to schedule. Drag back to queue to unschedule.</div>
         </div>
         <button 
           onClick={() => setIsAutoScheduleOpen(true)}
           className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm transition-all text-sm font-medium"
         >
           <Wand2 size={18} className="mr-2" /> Auto-Schedule
         </button>
       </div>

       <div className="flex flex-1 overflow-hidden gap-4">
          {/* Sidebar - Unscheduled Jobs */}
          <div 
            className="w-64 flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
            onDragOver={handleDragOver}
            onDrop={handleDropSidebar}
          >
            <div className="p-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 font-medium flex justify-between items-center">
              <span>Unscheduled Queue</span>
              <ArrowLeft size={16} className="text-gray-400" />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {data.jobs.filter(j => j.status === JobStatus.Queued).map(job => (
                <div 
                  key={job.id} 
                  draggable 
                  onDragStart={(e) => handleDragStart(e, job, 'sidebar')}
                  className="p-2 bg-white dark:bg-gray-700 rounded shadow-sm border border-gray-200 dark:border-gray-600 cursor-move hover:ring-2 ring-blue-400"
                >
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{job.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex justify-between">
                    <span>{formatDuration(job.printTimeMinutes)}</span>
                    {job.requiresAMS && <span className="text-indigo-500 font-bold">AMS</span>}
                  </div>
                </div>
              ))}
              {data.jobs.filter(j => j.status === JobStatus.Queued).length === 0 && (
                  <div className="text-center text-xs text-gray-400 py-4">Queue empty</div>
              )}
            </div>
          </div>

          {/* Timeline Area */}
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
            {/* Single Scroll Container */}
            <div className="flex-1 overflow-auto relative scroll-smooth">
                
                {/* Header Row (Sticky Top) */}
                <div className="sticky top-0 z-30 flex h-8 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 min-w-max">
                    {/* Top Left Corner (Sticky Left) */}
                    <div className="sticky left-0 z-40 w-40 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-shrink-0"></div>
                    
                    {/* Times Track */}
                    <div className="relative h-full" style={{ width: timelineWidth }}>
                      {Array.from({ length: timelineDurationHours }).map((_, i) => {
                          const d = new Date(timelineStart + i * 3600000);
                          return (
                            <div key={i} className="absolute text-xs text-gray-400 border-l border-gray-200 dark:border-gray-700 pl-1 h-full flex items-center" 
                              style={{ left: i * 60 * SCALE, width: 60 * SCALE }}>
                              {formatTime12h(d)}
                            </div>
                          );
                      })}
                    </div>
                </div>

                {/* Printer Rows Container */}
                <div className="min-w-max">
                    {data.printers.map(printer => (
                        <div key={printer.id} className="flex h-32 border-b border-gray-100 dark:border-gray-700 group relative">
                            {/* Printer Label (Sticky Left) */}
                            <div className="sticky left-0 z-20 w-40 bg-white/95 dark:bg-gray-800/95 border-r border-gray-100 dark:border-gray-700 flex-shrink-0 flex flex-col justify-center p-3 backdrop-blur-sm shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                <div className="font-medium text-gray-900 dark:text-white truncate" title={printer.name}>{printer.name}</div>
                                <div className="text-xs text-gray-500">{printer.hasAMS ? 'AMS Ready' : 'No AMS'}</div>
                            </div>

                            {/* Timeline Lane Content */}
                            <div 
                                className="relative h-full bg-gray-50/30 dark:bg-gray-900/30"
                                style={{ width: timelineWidth }}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDropTimeline(e, printer.id)}
                            >
                                {/* Availability Zones Background */}
                                {availabilityZones.map((zone, idx) => (
                                    <div key={idx} 
                                        className="absolute top-0 bottom-0 bg-green-50 dark:bg-green-900/20 pointer-events-none border-x border-green-100 dark:border-green-900/30"
                                        style={{ left: zone.left, width: zone.width }}
                                    ></div>
                                ))}

                                {/* Grid Lines */}
                                {Array.from({ length: timelineDurationHours }).map((_, i) => (
                                    <div key={`grid-${i}`} className="absolute top-0 bottom-0 border-l border-dashed border-gray-100 dark:border-gray-700 pointer-events-none"
                                        style={{ left: i * 60 * SCALE }}></div>
                                ))}

                                {/* Jobs */}
                                {data.jobs
                                .filter(j => j.scheduledPrinterId === printer.id && j.status === JobStatus.Scheduled)
                                .map(job => {
                                    if (!job.scheduledStartTime) return null;
                                    const start = new Date(job.scheduledStartTime).getTime();
                                    const diff = (start - timelineStart) / 1000 / 60; // minutes from start
                                    const left = diff * SCALE;
                                    const width = job.printTimeMinutes * SCALE;
                                    
                                    return (
                                    <div key={job.id} 
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, job, 'timeline')}
                                        onClick={() => handleJobClick(job, printer)}
                                        className="absolute top-4 h-24 rounded-md bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-500 p-2 text-xs overflow-hidden cursor-pointer hover:brightness-95 transition-all shadow-sm z-10"
                                        style={{ left: `${left}px`, width: `${width}px` }}>
                                        <div className="font-bold text-blue-800 dark:text-blue-100 truncate">{job.name}</div>
                                        <div className="text-blue-600 dark:text-blue-300">{formatDuration(job.printTimeMinutes)}</div>
                                    </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
       </div>

       {/* Completion Modal */}
       {completionModal && (
          <CompletionModal 
            job={completionModal.job}
            printer={completionModal.printer} 
            spools={data.spools}
            onClose={() => setCompletionModal(null)}
            onComplete={handleCompleteJob}
          />
       )}

       {/* Auto Schedule Modal */}
       {isAutoScheduleOpen && (
         <AutoScheduleModal 
           jobs={data.jobs} // Pass ALL jobs
           printers={data.printers}
           settings={data.settings}
           onClose={() => setIsAutoScheduleOpen(false)}
           onApply={(updatedJobs) => {
             // Merge updated jobs into state
             const newJobList = data.jobs.map(j => {
                const update = updatedJobs.find(u => u.id === j.id);
                return update || j;
             });
             updateJobs(newJobList);
           }}
         />
       )}
    </div>
  );
};

const CompletionModal: React.FC<{ 
  job: Job, 
  printer: Printer, 
  spools: Spool[],
  onClose: () => void, 
  onComplete: (status: 'success' | 'failed', weight: number) => void 
}> = ({ job, printer, spools, onClose, onComplete }) => {
   const [status, setStatus] = useState<'success' | 'failed'>('success');
   const [updateMode, setUpdateMode] = useState<'auto' | 'manual' | 'skip'>('auto');
   const [manualWeight, setManualWeight] = useState(0);

   const handleFinish = () => {
      let deduction = 0;
      if (updateMode === 'auto') deduction = job.gramsRequired;
      if (updateMode === 'manual') {
         const spool = spools.find(s => s.id === job.assignedSpoolId);
         if (spool) {
            deduction = Math.max(0, spool.currentWeight - manualWeight);
         }
      }
      onComplete(status, deduction);
   };

   const inputClass = "w-full rounded-md border border-gray-300 bg-white text-gray-900 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500";

   return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <h2 className="text-xl font-bold dark:text-white">Job Completion</h2>
        <p className="text-sm text-gray-500">Mark <strong>{job.name}</strong> as finished on <strong>{printer.name}</strong>.</p>
        
        <div className="grid grid-cols-2 gap-4">
           <button onClick={() => setStatus('success')} className={`p-4 rounded-lg border flex flex-col items-center gap-2 ${status === 'success' ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 dark:border-gray-600'}`}>
             <Check size={24} /> <span className="font-medium">Success</span>
           </button>
           <button onClick={() => setStatus('failed')} className={`p-4 rounded-lg border flex flex-col items-center gap-2 ${status === 'failed' ? 'bg-red-50 border-red-500 text-red-700' : 'border-gray-200 dark:border-gray-600'}`}>
             <X size={24} /> <span className="font-medium">Failed</span>
           </button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Inventory Update</label>
          <select className={inputClass} value={updateMode} onChange={(e: any) => setUpdateMode(e.target.value)}>
            <option value="auto">Auto-Deduct ({job.gramsRequired}g)</option>
            <option value="manual">Weigh Spool Now</option>
            <option value="skip">Do Not Update</option>
          </select>
        </div>

        {updateMode === 'manual' && (
           <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Gross Weight (g)</label>
              <input type="number" className={inputClass} value={manualWeight} onChange={e => setManualWeight(Number(e.target.value))} />
              <p className="text-xs text-gray-500 mt-1">Place spool on scale and enter value.</p>
           </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
           <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
           <button onClick={handleFinish} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Confirm</button>
        </div>
      </div>
    </div>
   );
};

export default SchedulerPage;
