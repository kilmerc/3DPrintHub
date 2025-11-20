
import React, { useState, useMemo } from 'react';
import { Calendar, Check, ArrowRight, Activity, AlertTriangle, Clock, Lock, Shuffle } from 'lucide-react';
import { Job, Printer, AppSettings, JobStatus, AvailabilityRange } from '../types';

interface AutoScheduleModalProps {
  jobs: Job[]; // Passing ALL jobs now
  printers: Printer[];
  settings: AppSettings;
  onClose: () => void;
  onApply: (scheduledJobs: Job[]) => void;
}

interface ProposedSchedule {
  jobId: string;
  jobName: string;
  printerId: string;
  printerName: string;
  startTime: Date;
  endTime: Date;
  isDelayedForAvailability: boolean;
}

const AutoScheduleModal: React.FC<AutoScheduleModalProps> = ({ jobs, printers, settings, onClose, onApply }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  // Step 1 State
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set(jobs.filter(j => j.status === JobStatus.Queued).map(j => j.id)));
  const [selectedPrinterIds, setSelectedPrinterIds] = useState<Set<string>>(new Set(printers.filter(p => p.status !== 'Maintenance').map(p => p.id)));
  const [planStartTime, setPlanStartTime] = useState<string>(new Date().toISOString().slice(0, 16)); 
  const [strategy, setStrategy] = useState<'lock' | 'shuffle'>('lock');

  // Step 2/3 State (Results)
  const [proposedPlan, setProposedPlan] = useState<ProposedSchedule[]>([]);

  // -- Helpers --

  const getNextAvailabilityStart = (date: Date, ranges: AvailabilityRange[]): Date => {
    if (!ranges || ranges.length === 0) return date;

    const sortedRanges = [...ranges].sort((a, b) => parseInt(a.start.replace(':', '')) - parseInt(b.start.replace(':', '')));
    const checkDate = new Date(date);
    
    for (let i = 0; i < 7; i++) { // Lookahead 7 days max
      for (const range of sortedRanges) {
        const [h, m] = range.start.split(':').map(Number);
        const rangeStart = new Date(checkDate);
        rangeStart.setHours(h, m, 0, 0);

        if (rangeStart >= date) {
          return rangeStart;
        }
      }
      checkDate.setDate(checkDate.getDate() + 1);
      checkDate.setHours(0, 0, 0, 0);
    }
    return date;
  };

  const isTimeInAvailability = (date: Date, ranges: AvailabilityRange[]): boolean => {
    if (!ranges || ranges.length === 0) return true;
    const minutes = date.getHours() * 60 + date.getMinutes();
    return ranges.some(range => {
      const [sh, sm] = range.start.split(':').map(Number);
      const [eh, em] = range.end.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      return minutes >= startMin && minutes <= endMin;
    });
  };

  // -- Algorithm --

  const runAutoSchedule = () => {
    const startBase = new Date(planStartTime);
    
    // 1. Prepare Jobs Pool based on strategy
    let fixedJobs: Job[] = [];
    let jobsToSchedule: Job[] = [];

    if (strategy === 'lock') {
        fixedJobs = jobs.filter(j => j.status === JobStatus.Scheduled && j.scheduledPrinterId && j.scheduledStartTime);
        jobsToSchedule = jobs.filter(j => selectedJobIds.has(j.id));
    } else {
        // Shuffle: Include ALL previously scheduled + selected queued
        fixedJobs = []; // Ignore existing schedule
        const previouslyScheduled = jobs.filter(j => j.status === JobStatus.Scheduled);
        const selectedQueued = jobs.filter(j => selectedJobIds.has(j.id));
        jobsToSchedule = [...previouslyScheduled, ...selectedQueued];
    }

    const availablePrinters = printers.filter(p => selectedPrinterIds.has(p.id));

    if (jobsToSchedule.length === 0 || availablePrinters.length === 0) {
      alert("Invalid configuration. Ensure jobs and printers are selected.");
      return;
    }

    // 2. Sort Jobs (LPT - Longest Processing Time First)
    jobsToSchedule.sort((a, b) => b.printTimeMinutes - a.printTimeMinutes);

    // 3. Build Busy Intervals for "Lock" strategy
    const busyIntervals: Record<string, {start: number, end: number}[]> = {};
    availablePrinters.forEach(p => busyIntervals[p.id] = []);

    fixedJobs.forEach(j => {
        if (j.scheduledPrinterId && j.scheduledStartTime && busyIntervals[j.scheduledPrinterId]) {
            const s = new Date(j.scheduledStartTime).getTime();
            const e = s + j.printTimeMinutes * 60000;
            busyIntervals[j.scheduledPrinterId].push({ start: s, end: e });
        }
    });
    
    // Sort intervals by time
    Object.values(busyIntervals).forEach(intervals => intervals.sort((a, b) => a.start - b.start));

    const schedule: ProposedSchedule[] = [];

    // 4. Allocation Loop (Best Fit Gap)
    for (const job of jobsToSchedule) {
      let bestPrinterId: string | null = null;
      let bestFinishTime: number = Infinity;
      let bestStartTime: Date | null = null;
      let isDelayed = false;

      const durationMs = job.printTimeMinutes * 60 * 1000;

      for (const printer of availablePrinters) {
        if (job.requiresAMS && !printer.hasAMS) continue;
        if (job.compatiblePrinterIds && job.compatiblePrinterIds.length > 0 && !job.compatiblePrinterIds.includes(printer.id)) continue;

        // Search for gap in this printer's schedule
        const intervals = busyIntervals[printer.id];
        let searchStart = startBase.getTime();
        
        // Iterate through intervals (and the space after the last interval)
        // We treat the infinite space after the last interval as a virtual interval starting at Infinity
        const checkPoints = [...intervals, { start: Infinity, end: Infinity }];

        for (const interval of checkPoints) {
             const gapDuration = interval.start - searchStart;

             if (gapDuration >= durationMs) {
                 // Found a physical gap large enough
                 let candidateStart = new Date(searchStart);
                 let candidateFinish = new Date(candidateStart.getTime() + durationMs);
                 let delayedHere = false;

                 // Check Availability Constraint
                 if (!isTimeInAvailability(candidateFinish, settings.availabilityRanges)) {
                     const nextValidWindowStart = getNextAvailabilityStart(candidateFinish, settings.availabilityRanges);
                     
                     // Shift to align finish with next window start
                     candidateFinish = nextValidWindowStart;
                     candidateStart = new Date(candidateFinish.getTime() - durationMs);
                     delayedHere = true;
                 }

                 // After shifting, does it still fit in this gap?
                 // (candidateStart must be >= searchStart AND candidateFinish <= interval.start)
                 if (candidateStart.getTime() >= searchStart && candidateFinish.getTime() <= interval.start) {
                     // Valid Placement!
                     if (candidateFinish.getTime() < bestFinishTime) {
                         bestFinishTime = candidateFinish.getTime();
                         bestStartTime = candidateStart;
                         bestPrinterId = printer.id;
                         isDelayed = delayedHere;
                     }
                     // Once we find a valid spot in this printer (earliest possible), break to check next printer
                     break; 
                 }
             }

             // Advance search to end of this busy block
             searchStart = Math.max(searchStart, interval.end);
        }
      }

      if (bestPrinterId && bestStartTime) {
        const printer = availablePrinters.find(p => p.id === bestPrinterId)!;
        const endTime = new Date(bestFinishTime);
        
        schedule.push({
          jobId: job.id,
          jobName: job.name,
          printerId: bestPrinterId,
          printerName: printer.name,
          startTime: bestStartTime,
          endTime: endTime,
          isDelayedForAvailability: isDelayed
        });

        // Mark this time as busy for subsequent jobs in this loop
        busyIntervals[bestPrinterId].push({ 
            start: bestStartTime.getTime(), 
            end: bestFinishTime 
        });
        // Re-sort intervals to keep order for next job check
        busyIntervals[bestPrinterId].sort((a, b) => a.start - b.start);
      }
    }

    setProposedPlan(schedule);
    setStep(3);
  };

  const handleApply = () => {
    // Convert ProposedSchedule back to Jobs
    const updatedJobs: Job[] = [];
    
    // 1. Add newly scheduled jobs
    proposedPlan.forEach(plan => {
      const originalJob = jobs.find(j => j.id === plan.jobId);
      if (originalJob) {
        updatedJobs.push({
          ...originalJob,
          status: JobStatus.Scheduled,
          scheduledPrinterId: plan.printerId,
          scheduledStartTime: plan.startTime.toISOString()
        });
      }
    });

    // 2. If Shuffle was used, some jobs might not have fit. 
    // We must ensure jobs that were previously scheduled but NOT in the new plan are reverted to Queued.
    if (strategy === 'shuffle') {
        const allInPlanIds = new Set(proposedPlan.map(p => p.jobId));
        // Find jobs that were scheduled but are now unscheduled (didn't fit)
        const formerlyScheduled = jobs.filter(j => j.status === JobStatus.Scheduled);
        formerlyScheduled.forEach(job => {
            if (!allInPlanIds.has(job.id)) {
                updatedJobs.push({
                    ...job,
                    status: JobStatus.Queued,
                    scheduledPrinterId: undefined,
                    scheduledStartTime: undefined
                });
            }
        });
    }

    onApply(updatedJobs);
    onClose();
  };

  // -- Render --

  const queuedJobs = jobs.filter(j => j.status === JobStatus.Queued);
  const scheduledJobs = jobs.filter(j => j.status === JobStatus.Scheduled);

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Job Selection */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 h-96 flex flex-col">
          <h3 className="font-semibold mb-2 flex items-center justify-between dark:text-white">
            <span>Queued Jobs</span>
            <button 
              onClick={() => setSelectedJobIds(new Set(queuedJobs.map(j => j.id)))}
              className="text-xs text-blue-600 hover:underline"
            >Select All</button>
          </h3>
          <div className="overflow-y-auto flex-1 space-y-2 pr-2">
            {queuedJobs.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No jobs in queue.</p>}
            {queuedJobs.map(job => (
              <label key={job.id} className="flex items-start space-x-3 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  className="mt-1 rounded text-blue-600 dark:bg-gray-700 dark:border-gray-600"
                  checked={selectedJobIds.has(job.id)}
                  onChange={(e) => {
                    const next = new Set(selectedJobIds);
                    if (e.target.checked) next.add(job.id);
                    else next.delete(job.id);
                    setSelectedJobIds(next);
                  }}
                />
                <div className="text-sm">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{job.name}</div>
                  <div className="text-xs text-gray-500 flex gap-2">
                    <span>{Math.floor(job.printTimeMinutes / 60)}h {job.printTimeMinutes % 60}m</span>
                    {job.requiresAMS && <span className="text-indigo-600 dark:text-indigo-400 font-bold">AMS</span>}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Config */}
        <div className="space-y-4 flex flex-col">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex-shrink-0">
             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan Start Time</label>
             <input 
                type="datetime-local" 
                className="w-full rounded-md border border-gray-300 bg-white text-gray-900 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={planStartTime}
                onChange={(e) => setPlanStartTime(e.target.value)}
             />
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex-shrink-0">
             <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Conflict Strategy</h3>
             <div className="space-y-2">
                <label className={`flex items-start p-2 rounded border cursor-pointer transition-colors ${strategy === 'lock' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'border-gray-200 dark:border-gray-700'}`}>
                   <input type="radio" name="strategy" className="mt-1 text-blue-600" checked={strategy === 'lock'} onChange={() => setStrategy('lock')} />
                   <div className="ml-2">
                      <div className="text-sm font-medium flex items-center gap-1 dark:text-gray-200"><Lock size={14}/> Keep Existing (Fill Gaps)</div>
                      <div className="text-xs text-gray-500">Keeps the {scheduledJobs.length} currently scheduled jobs where they are. New jobs fill empty slots.</div>
                   </div>
                </label>
                <label className={`flex items-start p-2 rounded border cursor-pointer transition-colors ${strategy === 'shuffle' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'border-gray-200 dark:border-gray-700'}`}>
                   <input type="radio" name="strategy" className="mt-1 text-blue-600" checked={strategy === 'shuffle'} onChange={() => setStrategy('shuffle')} />
                   <div className="ml-2">
                      <div className="text-sm font-medium flex items-center gap-1 dark:text-gray-200"><Shuffle size={14}/> Reschedule Everything</div>
                      <div className="text-xs text-gray-500">Un-schedules the {scheduledJobs.length} active jobs and re-optimizes the entire timeline from scratch.</div>
                   </div>
                </label>
             </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex-1 flex flex-col overflow-hidden">
            <h3 className="font-semibold mb-2 dark:text-white">Printers</h3>
            <div className="overflow-y-auto flex-1 space-y-2 pr-2">
              {printers.map(printer => (
                <label key={printer.id} className="flex items-center space-x-3 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer">
                   <input 
                    type="checkbox" 
                    className="rounded text-blue-600 dark:bg-gray-700 dark:border-gray-600"
                    checked={selectedPrinterIds.has(printer.id)}
                    onChange={(e) => {
                      const next = new Set(selectedPrinterIds);
                      if (e.target.checked) next.add(printer.id);
                      else next.delete(printer.id);
                      setSelectedPrinterIds(next);
                    }}
                  />
                  <div className="text-sm dark:text-gray-200">{printer.name} <span className="text-xs text-gray-500">({printer.hasAMS ? 'AMS' : 'Std'})</span></div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => {
    const totalJobs = proposedPlan.length;
    if (totalJobs === 0) return <div className="text-center py-10 text-gray-500">Could not fit any jobs.</div>;

    // Calculate makespan
    const minStart = Math.min(...proposedPlan.map(p => p.startTime.getTime()));
    const maxEnd = Math.max(...proposedPlan.map(p => p.endTime.getTime()));
    const durationHrs = (maxEnd - minStart) / (1000 * 60 * 60);

    // Group by printer for display
    const byPrinter: Record<string, ProposedSchedule[]> = {};
    proposedPlan.forEach(p => {
      if (!byPrinter[p.printerName]) byPrinter[p.printerName] = [];
      byPrinter[p.printerName].push(p);
    });

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
           <div>
             <div className="text-sm text-blue-800 dark:text-blue-200 font-bold">Smart Plan Generated</div>
             <div className="text-xs text-blue-600 dark:text-blue-300">Scheduled {totalJobs} jobs over {durationHrs.toFixed(1)} hours.</div>
           </div>
           <Activity className="text-blue-500" size={24} />
        </div>

        <div className="max-h-96 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
           {Object.entries(byPrinter).map(([printerName, pJobs]) => (
             <div key={printerName} className="p-4 border-b last:border-0 border-gray-100 dark:border-gray-800">
               <div className="font-semibold text-sm text-gray-900 dark:text-gray-200 mb-2 sticky left-0">{printerName}</div>
               <div className="relative h-16 bg-gray-50 dark:bg-gray-800 rounded-md overflow-hidden flex items-center">
                 {/* Mini Timeline Visualization */}
                 {pJobs.sort((a,b) => a.startTime.getTime() - b.startTime.getTime()).map((job, idx) => {
                    // Calculate relative width/position for this mini view
                    // We normalize based on the total plan duration
                    const startOffset = (job.startTime.getTime() - minStart) / (maxEnd - minStart);
                    const widthPct = ((job.endTime.getTime() - job.startTime.getTime()) / (maxEnd - minStart));
                    
                    return (
                      <div 
                        key={idx}
                        className={`absolute h-12 top-2 rounded px-2 flex flex-col justify-center text-[10px] overflow-hidden border-l-2 border-white dark:border-gray-700 shadow-sm
                          ${job.isDelayedForAvailability ? 'bg-yellow-100 text-yellow-900' : 'bg-blue-100 text-blue-900'}
                        `}
                        style={{ 
                          left: `${startOffset * 95 + 1}%`, // Add small padding
                          width: `${widthPct * 95}%` 
                        }}
                        title={`${job.jobName}: ${job.startTime.toLocaleTimeString()} - ${job.endTime.toLocaleTimeString()}`}
                      >
                         <div className="font-bold truncate">{job.jobName}</div>
                         {job.isDelayedForAvailability && <div className="flex items-center gap-1 text-[9px] font-bold"><Clock size={8}/> Delayed</div>}
                      </div>
                    );
                 })}
               </div>
               <div className="mt-1 flex justify-between text-xs text-gray-400">
                  <span>{new Date(minStart).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}</span>
                  <span>{new Date(maxEnd).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}</span>
               </div>
             </div>
           ))}
        </div>
        <div className="text-xs text-gray-500 italic text-center">
           * Yellow blocks indicate jobs delayed to align finish times with your availability windows.
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
             <Calendar className="text-blue-500" size={20}/>
             Auto-Schedule Assistant
          </h3>
          <div className="flex items-center gap-2">
             <span className={`h-2 w-2 rounded-full ${step === 1 ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}></span>
             <span className={`h-2 w-2 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}></span>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
           {step === 1 && renderStep1()}
           {step === 3 && renderStep3()}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
           <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">Cancel</button>
           
           {step === 1 && (
             <button 
              onClick={runAutoSchedule}
              disabled={selectedJobIds.size === 0 && strategy !== 'shuffle'}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
             >
               Generate Plan <ArrowRight size={16} className="ml-2" />
             </button>
           )}

           {step === 3 && (
             <button 
              onClick={handleApply}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center shadow-sm"
             >
               <Check size={16} className="mr-2" /> Apply Plan
             </button>
           )}
        </div>
      </div>
    </div>
  );
};

export default AutoScheduleModal;
