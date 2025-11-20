
import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { Package, List, Calendar, Settings, Upload, Menu, X, Database, FileText, Play, RotateCcw, HardDrive, ShoppingCart } from 'lucide-react';
import { AppData, Spool, Printer, Job, AppSettings, ShoppingItem } from './types';
import { SAMPLE_DATA, EMPTY_DATA, APP_VERSION } from './constants';
import InventoryPage from './pages/InventoryPage';
import QueuePage from './pages/QueuePage';
import SchedulerPage from './pages/SchedulerPage';
import SettingsPage from './pages/SettingsPage';
import ShoppingPage from './pages/ShoppingPage';

// --- Context ---
interface AppContextType {
  data: AppData;
  updateSpools: (spools: Spool[]) => void;
  updatePrinters: (printers: Printer[]) => void;
  updateJobs: (jobs: Job[]) => void;
  updateShoppingList: (items: ShoppingItem[]) => void;
  updateSettings: (settings: AppSettings) => void;
  updateSavedLists: (brands: string[], materials: string[], colors: string[]) => void;
  resetData: (type: 'empty' | 'sample') => void;
  importData: (json: string) => { success: boolean; message: string };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};

// --- Main App Component ---

const App: React.FC = () => {
  // Initialize with EMPTY_DATA to avoid flashing sample data before user choice
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [isInitialized, setIsInitialized] = useState(false);

  // Auto-save Effect
  useEffect(() => {
    // Only save to local storage if the user has initialized the app (made a choice)
    if (isInitialized) {
      localStorage.setItem('3dprinthub_data', JSON.stringify(data));
    }
    
    // Apply theme
    if (data.settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [data, isInitialized]);

  const updateSpools = (spools: Spool[]) => setData(prev => ({ ...prev, spools }));
  const updatePrinters = (printers: Printer[]) => setData(prev => ({ ...prev, printers }));
  const updateJobs = (jobs: Job[]) => setData(prev => ({ ...prev, jobs }));
  const updateShoppingList = (shoppingList: ShoppingItem[]) => setData(prev => ({ ...prev, shoppingList }));
  const updateSettings = (settings: AppSettings) => setData(prev => ({ ...prev, settings }));
  
  const updateSavedLists = (brands: string[], materials: string[], colors: string[]) => {
    setData(prev => ({
      ...prev,
      savedBrands: brands,
      savedMaterials: materials,
      savedColorNames: colors
    }));
  };

  const resetData = (type: 'empty' | 'sample') => {
    if (confirm(`Are you sure you want to load ${type} data? Unsaved changes will be lost.`)) {
      setData(type === 'sample' ? SAMPLE_DATA : EMPTY_DATA);
    }
  };

  const parseAndValidate = (jsonString: string): AppData | null => {
    try {
      const parsed = JSON.parse(jsonString);
      // Basic validation/migration
      if (!parsed.version) parsed.version = "1.0";
      if (!parsed.savedBrands) parsed.savedBrands = [...new Set(parsed.spools?.map((s: any) => s.brand) || [])];
      if (!parsed.savedMaterials) parsed.savedMaterials = [...new Set(parsed.spools?.map((s: any) => s.material) || [])];
      if (!parsed.savedColorNames) parsed.savedColorNames = [...new Set(parsed.spools?.map((s: any) => s.colorName) || [])];
      
      // Ensure all required arrays exist
      if (!parsed.spools) parsed.spools = [];
      if (!parsed.printers) parsed.printers = [];
      if (!parsed.jobs) parsed.jobs = [];
      if (!parsed.shoppingList) parsed.shoppingList = [];
      if (!parsed.settings) parsed.settings = { theme: 'light', interventionTimes: [] };

      return parsed;
    } catch (e) {
      console.error("Data parsing failed", e);
      return null;
    }
  };

  const importData = (json: string) => {
    const parsed = parseAndValidate(json);
    if (parsed) {
      // Simple version check
      if (parsed.version > APP_VERSION) {
        alert("Warning: File version is newer than app version. Some features may break.");
      }
      setData(parsed);
      return { success: true, message: "Data loaded successfully" };
    }
    return { success: false, message: "Failed to parse JSON or invalid format" };
  };

  return (
    <AppContext.Provider value={{ data, updateSpools, updatePrinters, updateJobs, updateShoppingList, updateSettings, updateSavedLists, resetData, importData }}>
      {!isInitialized ? (
        <WelcomeModal 
          onInitialize={(mode, json) => {
            if (mode === 'local') {
              const saved = localStorage.getItem('3dprinthub_data');
              if (saved) {
                const parsed = parseAndValidate(saved);
                if (parsed) setData(parsed);
              }
            } else if (mode === 'sample') {
              setData(SAMPLE_DATA);
            } else if (mode === 'empty') {
              setData(EMPTY_DATA);
            } else if (mode === 'import' && json) {
              importData(json);
            }
            setIsInitialized(true);
          }}
        />
      ) : (
        <HashRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/inventory" replace />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/queue" element={<QueuePage />} />
              <Route path="/scheduler" element={<SchedulerPage />} />
              <Route path="/shopping" element={<ShoppingPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Layout>
        </HashRouter>
      )}
    </AppContext.Provider>
  );
};

// --- Welcome / Startup Modal ---

interface WelcomeModalProps {
  onInitialize: (mode: 'local' | 'sample' | 'empty' | 'import', json?: string) => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ onInitialize }) => {
  const [hasLocalData, setHasLocalData] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('3dprinthub_data');
    if (saved) {
      try {
        JSON.parse(saved);
        setHasLocalData(true);
      } catch (e) {
        setHasLocalData(false);
      }
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        onInitialize('import', ev.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8 text-center border-b border-gray-200 dark:border-gray-700">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg">
            <Package className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome to 3D Print Hub</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your filament, print queue, and schedules efficiently.</p>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={() => onInitialize('local')}
            disabled={!hasLocalData}
            className={`group p-6 border-2 rounded-xl text-left transition-all ${
              hasLocalData 
                ? 'border-blue-200 dark:border-blue-800 hover:border-blue-500 dark:hover:border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:shadow-md cursor-pointer' 
                : 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center mb-3 text-blue-600 dark:text-blue-400">
              <HardDrive size={24} className="mr-3" />
              <span className="font-semibold text-lg">Continue Session</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Load data found in your browser's local storage.
            </p>
          </button>

          <button 
            onClick={() => onInitialize('sample')}
            className="group p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-left hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:shadow-md transition-all"
          >
            <div className="flex items-center mb-3 text-purple-600 dark:text-purple-400">
              <Play size={24} className="mr-3" />
              <span className="font-semibold text-lg">Sample Data</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Explore the app with pre-loaded example data.
            </p>
          </button>

          <button 
            onClick={() => onInitialize('empty')}
            className="group p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-left hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 hover:shadow-md transition-all"
          >
            <div className="flex items-center mb-3 text-green-600 dark:text-green-400">
              <FileText size={24} className="mr-3" />
              <span className="font-semibold text-lg">Start Fresh</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Begin with an empty inventory and queue.
            </p>
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="group p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-left hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:shadow-md transition-all"
          >
            <div className="flex items-center mb-3 text-orange-600 dark:text-orange-400">
              <Upload size={24} className="mr-3" />
              <span className="font-semibold text-lg">Import Backup</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Restore data from a previously exported JSON file.
            </p>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileUpload} />
          </button>
        </div>
        
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 text-center text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700">
          v{APP_VERSION} • All data is stored locally in your browser.
        </div>
      </div>
    </div>
  );
};

// --- Layout Component ---

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/inventory', label: 'Inventory', icon: Package },
    { path: '/queue', label: 'Queue', icon: List },
    { path: '/scheduler', label: 'Scheduler', icon: Calendar },
    { path: '/shopping', label: 'Shopping', icon: ShoppingCart },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Navbar */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <span className="ml-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
                3D Print Hub
              </span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon size={18} className="mr-2" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center px-3 py-4 rounded-md text-base font-medium ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon size={20} className="mr-3" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
};

export default App;
