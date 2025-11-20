
export enum SpoolStatus {
  Active = 'Active',
  Depleted = 'Depleted',
  Archived = 'Archived',
}

export enum JobStatus {
  Queued = 'Queued',
  Scheduled = 'Scheduled',
  Printing = 'Printing',
  Completed = 'Completed',
  Failed = 'Failed',
  Archived = 'Archived',
}

export enum Urgency {
  Low = 'Low',
  Normal = 'Normal',
  High = 'High',
  Critical = 'Critical',
}

export interface Spool {
  id: string;
  brand: string;
  material: string; // e.g., PLA, PETG
  colorName: string;
  colorHex: string;
  initialWeight: number; // grams (total including spool)
  emptySpoolWeight: number; // grams
  currentWeight: number; // grams (total)
  status: SpoolStatus;
  dateAdded: string;
}

export interface Printer {
  id: string;
  name: string;
  bedSize: string; // e.g., "256x256x256"
  hasAMS: boolean;
  status: 'Idle' | 'Printing' | 'Maintenance';
}

export interface Job {
  id: string;
  name: string;
  sourceUrl?: string;
  printTimeMinutes: number;
  gramsRequired: number;
  nozzleSize: number; // 0.2, 0.4, 0.6, 0.8
  requiresAMS: boolean;
  urgency: Urgency;
  status: JobStatus;
  assignedSpoolId?: string;
  compatiblePrinterIds: string[]; // If empty, all are compatible (logic)
  
  // Scheduling info
  scheduledPrinterId?: string;
  scheduledStartTime?: string; // ISO Date string
  
  completedDate?: string;
  notes?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: 'Filament' | 'Part' | 'Accessory' | 'Other';
  url?: string;
  price?: number;
  quantity: number;
  isPurchased: boolean;
  addedDate: string;
}

export interface AvailabilityRange {
  start: string; // "HH:MM" 24h format
  end: string;   // "HH:MM" 24h format
}

export interface AppData {
  version: string;
  spools: Spool[];
  printers: Printer[];
  jobs: Job[];
  shoppingList: ShoppingItem[];
  settings: AppSettings;
  // Saved lists for dropdowns
  savedBrands: string[];
  savedMaterials: string[];
  savedColorNames: string[];
}

export interface AppSettings {
  theme: 'light' | 'dark';
  availabilityRanges: AvailabilityRange[];
}
