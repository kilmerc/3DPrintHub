
import { AppData, JobStatus, SpoolStatus, Urgency } from './types';

export const APP_VERSION = "1.2";

export const PRESET_COLORS = [
  "#000000", "#FFFFFF", "#808080", "#FF0000", "#00FF00", "#0000FF",
  "#FFFF00", "#00FFFF", "#FF00FF", "#FFA500", "#800080", "#A52A2A",
  "#FFC0CB", "#FFD700", "#C0C0C0", "#F5F5DC", "#4B0082", "#40E0D0",
  "#006400", "#32CD32", "#87CEEB", "#000080", "#800000", "#800000",
  "#7FFFD4", "#FF7F50", "#FA8072", "#F0E68C", "#DDA0DD", "#6A5ACD",
  "#A0522D", "#D2B48C", "#708090", "#2F4F4F", "#FF4500", "#2E8B57"
];

export const EMPTY_DATA: AppData = {
  version: APP_VERSION,
  spools: [],
  printers: [],
  jobs: [],
  shoppingList: [],
  settings: {
    theme: 'light',
    availabilityRanges: [
      { start: "09:00", end: "17:00" }
    ]
  },
  savedBrands: [],
  savedMaterials: [],
  savedColorNames: []
};

export const SAMPLE_DATA: AppData = {
  version: APP_VERSION,
  settings: {
    theme: 'light',
    availabilityRanges: [
      { start: "08:00", end: "12:00" },
      { start: "13:00", end: "18:00" }
    ]
  },
  printers: [
    { id: 'p1', name: 'Bambu X1C', bedSize: '256x256x256', hasAMS: true, status: 'Idle' },
    { id: 'p2', name: 'Prusa MK4', bedSize: '250x210x210', hasAMS: false, status: 'Idle' },
  ],
  spools: [
    { 
      id: 's1', brand: 'Bambu Lab', material: 'PLA Basic', colorName: 'Jade White', colorHex: '#F5F5DC', 
      initialWeight: 1250, emptySpoolWeight: 250, currentWeight: 1100, status: SpoolStatus.Active, dateAdded: new Date().toISOString() 
    },
    { 
      id: 's2', brand: 'Polymaker', material: 'PETG', colorName: 'Space Blue', colorHex: '#000080', 
      initialWeight: 1200, emptySpoolWeight: 200, currentWeight: 400, status: SpoolStatus.Active, dateAdded: new Date().toISOString() 
    },
    { 
      id: 's3', brand: 'Sunlu', material: 'PLA', colorName: 'Red', colorHex: '#FF0000', 
      initialWeight: 1150, emptySpoolWeight: 150, currentWeight: 160, status: SpoolStatus.Active, dateAdded: new Date().toISOString() 
    },
  ],
  jobs: [
    { 
      id: 'j1', name: 'Benchy', printTimeMinutes: 45, gramsRequired: 12, requiresAMS: false, urgency: Urgency.Low, 
      status: JobStatus.Queued, compatiblePrinterIds: [], assignedSpoolId: 's3', nozzleSize: 0.4 
    },
    { 
      id: 'j2', name: 'Helmet Prototype', printTimeMinutes: 1400, gramsRequired: 600, requiresAMS: true, urgency: Urgency.High, 
      status: JobStatus.Queued, compatiblePrinterIds: ['p1'], assignedSpoolId: 's1', nozzleSize: 0.6
    },
    { 
      id: 'j3', name: 'Cable Clip', printTimeMinutes: 20, gramsRequired: 5, requiresAMS: false, urgency: Urgency.Normal, 
      status: JobStatus.Queued, compatiblePrinterIds: [], assignedSpoolId: 's2', nozzleSize: 0.4 
    },
  ],
  shoppingList: [
    {
      id: 'sl1', name: '0.4mm Hardened Steel Nozzle', category: 'Part', quantity: 1, isPurchased: false, addedDate: new Date().toISOString(), price: 14.99
    },
    {
      id: 'sl2', name: 'Sunlu PLA - Black', category: 'Filament', quantity: 2, isPurchased: false, addedDate: new Date().toISOString(), price: 18.00
    }
  ],
  savedBrands: ['Bambu Lab', 'Polymaker', 'Sunlu', 'Esun', 'Overture', 'Prusament'],
  savedMaterials: ['PLA', 'PLA Basic', 'PETG', 'ABS', 'ASA', 'TPU', 'Nylon'],
  savedColorNames: ['Jade White', 'Space Blue', 'Red', 'Black', 'Orange', 'Green', 'Purple', 'Generic']
};
