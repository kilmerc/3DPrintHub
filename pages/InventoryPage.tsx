import React, { useState } from 'react';
import { Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight, ShoppingCart } from 'lucide-react';
import { useAppContext } from '../App';
import { Spool, SpoolStatus } from '../types';
import SpoolModal from '../components/SpoolModal';

// --- Types ---

type SortField = 'colorName' | 'brand' | 'currentWeight' | 'spoolCount';
type SortDirection = 'asc' | 'desc';

interface SpoolGroup {
  id: string; // composite key
  brand: string;
  material: string;
  colorName: string;
  colorHex: string;
  spools: Spool[];
  totalRemainingWeight: number;
  spoolCount: number;
}

// --- Components ---

const InventoryPage: React.FC = () => {
  const { data, updateSpools, updateSavedLists, updateShoppingList } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpool, setEditingSpool] = useState<Spool | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('brand');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 1. Filter individual spools first
  const filteredSpools = data.spools.filter(s => 
    s.status !== SpoolStatus.Archived &&
    (s.brand.toLowerCase().includes(search.toLowerCase()) || 
     s.colorName.toLowerCase().includes(search.toLowerCase()) ||
     s.material.toLowerCase().includes(search.toLowerCase()))
  );

  // 2. Group Spools
  const groups: SpoolGroup[] = Object.values(filteredSpools.reduce((acc, spool) => {
    const key = `${spool.brand}|${spool.material}|${spool.colorName}`;
    if (!acc[key]) {
      acc[key] = {
        id: key,
        brand: spool.brand,
        material: spool.material,
        colorName: spool.colorName,
        colorHex: spool.colorHex,
        spools: [],
        totalRemainingWeight: 0,
        spoolCount: 0
      };
    }
    acc[key].spools.push(spool);
    acc[key].totalRemainingWeight += (spool.currentWeight - spool.emptySpoolWeight);
    acc[key].spoolCount += 1;
    return acc;
  }, {} as Record<string, SpoolGroup>));

  // 3. Sort Groups
  const sortedGroups = groups.sort((a, b) => {
    let valA: any = a[sortField];
    let valB: any = b[sortField];

    if (sortField === 'currentWeight') {
      valA = a.totalRemainingWeight;
      valB = b.totalRemainingWeight;
    } else if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSave = (spool: Spool) => {
    if (editingSpool) {
      updateSpools(data.spools.map(s => s.id === spool.id ? spool : s));
    } else {
      updateSpools([...data.spools, spool]);
    }
    
    // Update Saved Lists
    const newBrands = Array.from(new Set([...data.savedBrands, spool.brand]));
    const newMaterials = Array.from(new Set([...data.savedMaterials, spool.material]));
    const newColors = Array.from(new Set([...data.savedColorNames, spool.colorName]));
    updateSavedLists(newBrands, newMaterials, newColors);

    setIsModalOpen(false);
    setEditingSpool(null);
  };

  const handleDelete = (id: string) => {
    const spool = data.spools.find(s => s.id === id);
    if (!spool) return;

    if (window.confirm(`Are you sure you want to delete this spool?`)) {
      updateSpools(data.spools.filter(s => s.id !== id));
    }
  };

  const handleDuplicate = (spool: Spool) => {
    const newSpool = {
      ...spool,
      id: Math.random().toString(36).substr(2, 9),
      dateAdded: new Date().toISOString(),
      currentWeight: spool.initialWeight // Reset weight for new spool
    };
    updateSpools([...data.spools, newSpool]);
  };

  const handleAddToShoppingList = (spool: Spool) => {
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: `${spool.brand} ${spool.material} - ${spool.colorName}`,
      category: 'Filament' as const,
      quantity: 1,
      isPurchased: false,
      addedDate: new Date().toISOString(),
    };
    updateShoppingList([...data.shoppingList, newItem]);
    alert(`Added ${newItem.name} to Shopping List`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Filament Inventory</h1>
        <button 
          onClick={() => { setEditingSpool(null); setIsModalOpen(true); }}
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition-all"
        >
          <Plus size={20} className="mr-2" />
          Add Spool
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
        <Search size={20} className="text-gray-400" />
        <input 
          type="text" 
          placeholder="Search brand, material, color..." 
          className="bg-transparent border-none focus:ring-0 text-sm w-full text-gray-800 dark:text-gray-200"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Desktop Hierarchical Table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="w-10 px-2"></th>
              <SortableHeader label="Color" field="colorName" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="Brand / Material" field="brand" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="Total Stock" field="currentWeight" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="Count" field="spoolCount" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedGroups.map(group => (
              <InventoryGroupRow 
                key={group.id} 
                group={group} 
                onEdit={(spool) => { setEditingSpool(spool); setIsModalOpen(true); }}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onRestock={handleAddToShoppingList}
              />
            ))}
            {sortedGroups.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No spools found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards (Accordion Style) */}
      <div className="md:hidden flex flex-col gap-4">
        {sortedGroups.map(group => (
          <InventoryGroupCard 
            key={group.id} 
            group={group}
            onEdit={(spool) => { setEditingSpool(spool); setIsModalOpen(true); }}
            onDelete={handleDelete}
            onRestock={handleAddToShoppingList}
          />
        ))}
      </div>

      {isModalOpen && (
        <SpoolModal 
          initialData={editingSpool} 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSave} 
        />
      )}
    </div>
  );
};

// --- Sub-components ---

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

const InventoryGroupRow: React.FC<{ 
  group: SpoolGroup, 
  onEdit: (s: Spool) => void, 
  onDelete: (id: string) => void,
  onDuplicate: (s: Spool) => void,
  onRestock: (s: Spool) => void
}> = ({ group, onEdit, onDelete, onDuplicate, onRestock }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const toggle = () => setIsExpanded(!isExpanded);

  return (
    <>
      <tr className={`hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors ${isExpanded ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`} onClick={toggle}>
        <td className="px-2 py-4 text-center text-gray-400">
          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <div className="h-6 w-6 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: group.colorHex }}></div>
            <span className="ml-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{group.colorName}</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{group.brand}</div>
          <div className="text-sm text-gray-500">{group.material}</div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
          {group.totalRemainingWeight}g <span className="text-xs text-gray-500">total</span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {group.spoolCount} spool{group.spoolCount !== 1 ? 's' : ''}
          </span>
        </td>
      </tr>
      {isExpanded && group.spools.map((spool, idx) => (
        <InventoryChildRow 
          key={spool.id} 
          spool={spool} 
          isLast={idx === group.spools.length - 1}
          onEdit={() => onEdit(spool)}
          onDelete={() => onDelete(spool.id)}
          onDuplicate={() => onDuplicate(spool)}
          onRestock={() => onRestock(spool)}
        />
      ))}
    </>
  );
};

const InventoryChildRow: React.FC<{ 
  spool: Spool, 
  isLast: boolean, 
  onEdit: () => void, 
  onDelete: () => void,
  onDuplicate: () => void,
  onRestock: () => void
}> = ({ spool, isLast, onEdit, onDelete, onDuplicate, onRestock }) => {
  const remaining = spool.currentWeight - spool.emptySpoolWeight;
  const totalInitial = spool.initialWeight - spool.emptySpoolWeight;
  const pct = Math.max(0, Math.min(100, (remaining / totalInitial) * 100));
  const isLow = pct < 15;

  return (
    <tr className="bg-gray-50 dark:bg-gray-900/50">
      <td className="px-2"></td> {/* Indent */}
      <td colSpan={4} className="px-0 py-0">
        <div className={`flex items-center justify-between p-4 pl-12 border-l-4 ${isLast ? '' : 'border-b border-gray-200 dark:border-gray-700'} ${isLow ? 'border-l-red-400' : 'border-l-green-400 dark:border-l-green-600'}`}>
          
          {/* Info & Progress */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            
            {/* Status */}
            <div className="flex items-center gap-3">
               <div className="text-xs text-gray-400 font-mono">#{spool.id.slice(-4)}</div>
               <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                isLow ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              }`}>
                {isLow ? 'Low' : 'Good'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-xs mb-1 text-gray-600 dark:text-gray-400">
                <span>{remaining}g remaining</span>
                <span>{Math.round(pct)}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full ${isLow ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }}></div>
              </div>
            </div>
            
            {/* Meta */}
            <div className="text-xs text-gray-500 dark:text-gray-500 hidden sm:block">
               Added: {new Date(spool.dateAdded).toLocaleDateString()}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 ml-4">
             <button type="button" onClick={(e) => { e.stopPropagation(); onRestock(); }} className="text-gray-400 hover:text-green-600 dark:hover:text-green-400 text-xs font-medium flex items-center" title="Add to Shopping List">
                <ShoppingCart size={16} className="mr-1"/> Restock
             </button>
             <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-medium" title="Clone Spool">Clone</button>
             <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 text-sm font-medium">Edit</button>
             <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-600 dark:text-red-400 hover:text-red-900 text-sm font-medium">Delete</button>
          </div>
        </div>
      </td>
    </tr>
  );
};

const InventoryGroupCard: React.FC<{ 
  group: SpoolGroup, 
  onEdit: (s: Spool) => void, 
  onDelete: (id: string) => void,
  onRestock: (s: Spool) => void
}> = ({ group, onEdit, onDelete, onRestock }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
           <div className="h-10 w-10 rounded-full border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0" style={{ backgroundColor: group.colorHex }}>
             {/* Optional icon if color is too dark/light */}
           </div>
           <div>
             <h3 className="text-sm font-bold text-gray-900 dark:text-white">{group.brand}</h3>
             <div className="text-xs text-gray-500 dark:text-gray-400">{group.material} • {group.colorName}</div>
           </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-gray-900 dark:text-white">{group.spoolCount}</div>
          <div className="text-xs text-gray-500">spools</div>
        </div>
      </div>
      
      {expanded && (
        <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
           {group.spools.map(spool => {
             const remaining = spool.currentWeight - spool.emptySpoolWeight;
             const totalInitial = spool.initialWeight - spool.emptySpoolWeight;
             const pct = Math.max(0, Math.min(100, (remaining / totalInitial) * 100));
             const isLow = pct < 15;

             return (
               <div key={spool.id} className="p-4 pl-6 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                     <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isLow ? 'bg-red-500' : 'bg-green-500'}`}></span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">#{spool.id.slice(-4)}</span>
                     </div>
                     <div className="flex gap-3">
                        <button type="button" onClick={(e) => { e.stopPropagation(); onRestock(spool); }} className="text-xs font-medium text-green-600 dark:text-green-400">Restock</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(spool); }} className="text-xs font-medium text-blue-600 dark:text-blue-400">Edit</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(spool.id); }} className="text-xs font-medium text-red-600 dark:text-red-400">Delete</button>
                     </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                       <span>{remaining}g remaining</span>
                       <span>{Math.round(pct)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full ${isLow ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
               </div>
             );
           })}
        </div>
      )}
    </div>
  );
};

export default InventoryPage;