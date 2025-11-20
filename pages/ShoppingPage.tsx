import React, { useState } from 'react';
import { useAppContext } from '../App';
import { Plus, Trash2, ExternalLink, CheckSquare, Square, ShoppingCart, Edit, X, Search, ArrowUp, ArrowDown, ArrowUpDown, Link as LinkIcon, PackagePlus } from 'lucide-react';
import { ShoppingItem, Spool, SpoolStatus } from '../types';
import SpoolModal from '../components/SpoolModal';

type SortField = 'name' | 'category' | 'price' | 'total' | 'isPurchased' | 'quantity';
type SortDirection = 'asc' | 'desc';

const ShoppingPage: React.FC = () => {
  const { data, updateShoppingList, updateSpools, updateSavedLists } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [showPurchased, setShowPurchased] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('isPurchased');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Move to Inventory State
  const [isSpoolModalOpen, setIsSpoolModalOpen] = useState(false);
  const [itemBeingMoved, setItemBeingMoved] = useState<ShoppingItem | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const togglePurchased = (id: string) => {
    updateShoppingList(data.shoppingList.map(item => 
      item.id === id ? { ...item, isPurchased: !item.isPurchased } : item
    ));
  };

  const deleteItem = (id: string) => {
    if (window.confirm("Remove this item from your list?")) {
      updateShoppingList(data.shoppingList.filter(item => item.id !== id));
    }
  };

  const handleSave = (item: ShoppingItem) => {
    if (editingItem) {
      updateShoppingList(data.shoppingList.map(i => i.id === item.id ? item : i));
    } else {
      updateShoppingList([...data.shoppingList, item]);
    }
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const deriveSpoolFromItem = (item: ShoppingItem): Partial<Spool> => {
    const parts = item.name.split(/[\s-]+/).filter(Boolean);
    // Very naive heuristic
    let brand = '';
    let material = '';
    let colorName = '';

    if (parts.length >= 3) {
        brand = parts[0];
        material = parts[1];
        colorName = parts.slice(2).join(' ');
    } else if (parts.length === 2) {
        brand = parts[0];
        material = parts[1];
    } else {
        brand = item.name;
    }
    
    return {
        brand,
        material,
        colorName,
        initialWeight: 1200, // Default
        currentWeight: 1200,
        emptySpoolWeight: 200,
        status: SpoolStatus.Active,
        colorHex: '#808080'
    };
  };

  const handleMoveToInventory = (item: ShoppingItem) => {
    setItemBeingMoved(item);
    setIsSpoolModalOpen(true);
  };

  const handleSaveSpool = (spool: Spool) => {
    // Add spool
    updateSpools([...data.spools, spool]);
    
    // Update saved lists
    const newBrands = Array.from(new Set([...data.savedBrands, spool.brand]));
    const newMaterials = Array.from(new Set([...data.savedMaterials, spool.material]));
    const newColors = Array.from(new Set([...data.savedColorNames, spool.colorName]));
    updateSavedLists(newBrands, newMaterials, newColors);

    // Handle shopping item
    if (itemBeingMoved) {
        if (window.confirm("Item added to inventory. Mark shopping list item as purchased?")) {
             updateShoppingList(data.shoppingList.map(i => i.id === itemBeingMoved.id ? { ...i, isPurchased: true } : i));
        }
    }
    setIsSpoolModalOpen(false);
    setItemBeingMoved(null);
  };

  // Filter and Sort Logic
  const processedItems = data.shoppingList
    .filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.category.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = showPurchased ? true : !item.isPurchased;
        return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'total') {
        valA = (a.price || 0) * a.quantity;
        valB = (b.price || 0) * b.quantity;
      } else if (sortField === 'name' || sortField === 'category') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      // Boolean sort (Purchased status)
      if (sortField === 'isPurchased') {
         valA = a.isPurchased ? 1 : 0;
         valB = b.isPurchased ? 1 : 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
  const totalCost = processedItems.reduce((sum, i) => sum + ((i.price || 0) * i.quantity), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shopping List</h1>
        <button 
          onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition-all"
        >
          <Plus size={20} className="mr-2" />
          Add Item
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex-1 flex items-center space-x-2">
          <Search size={20} className="text-gray-400" />
          <input 
            type="text" 
            placeholder="Search items..." 
            className="bg-transparent border-none focus:ring-0 text-sm w-full text-gray-800 dark:text-gray-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden md:block"></div>
        
        <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
          <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none whitespace-nowrap">
            <input 
              type="checkbox" 
              checked={showPurchased} 
              onChange={e => setShowPurchased(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700"
            />
            <span>Show Purchased</span>
          </label>

          <div className="text-sm px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full whitespace-nowrap">
             Est. Total: <span className="font-bold text-gray-900 dark:text-white">${totalCost.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="w-10 px-4 py-3"></th>
              <SortableHeader label="Item Details" field="name" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="Category" field="category" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="Qty" field="quantity" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="Price" field="price" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              <SortableHeader label="Total" field="total" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {processedItems.map(item => (
              <ShoppingRow 
                key={item.id} 
                item={item} 
                onToggle={() => togglePurchased(item.id)}
                onEdit={() => { setEditingItem(item); setIsModalOpen(true); }}
                onDelete={() => deleteItem(item.id)}
                onMove={() => handleMoveToInventory(item)}
              />
            ))}
            {processedItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden grid grid-cols-1 gap-4">
        {processedItems.map(item => (
          <ShoppingCard 
            key={item.id} 
            item={item} 
            onToggle={() => togglePurchased(item.id)}
            onEdit={() => { setEditingItem(item); setIsModalOpen(true); }}
            onDelete={() => deleteItem(item.id)}
            onMove={() => handleMoveToInventory(item)}
          />
        ))}
        
        {processedItems.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
            <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Your shopping list is empty.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <ShoppingItemModal 
          initialData={editingItem} 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSave} 
        />
      )}

      {isSpoolModalOpen && itemBeingMoved && (
        <SpoolModal 
          initialData={deriveSpoolFromItem(itemBeingMoved) as Spool}
          onClose={() => { setIsSpoolModalOpen(false); setItemBeingMoved(null); }} 
          onSave={handleSaveSpool} 
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

const ShoppingRow: React.FC<{ 
  item: ShoppingItem, 
  onToggle: () => void, 
  onEdit: () => void, 
  onDelete: () => void,
  onMove: () => void
}> = ({ item, onToggle, onEdit, onDelete, onMove }) => {
  return (
    <tr className={`${item.isPurchased ? 'bg-gray-50 dark:bg-gray-900/50 opacity-60' : ''} hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}>
      <td className="px-4 py-4 whitespace-nowrap">
        <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }} className="text-gray-400 hover:text-green-500 transition-colors focus:outline-none">
           {item.isPurchased ? <CheckSquare size={20} className="text-green-600" /> : <Square size={20} />}
        </button>
      </td>
      <td className="px-6 py-4">
         <div className="flex items-center gap-2">
           <span className={`text-sm font-medium text-gray-900 dark:text-white ${item.isPurchased ? 'line-through text-gray-500' : ''}`}>
             {item.name}
           </span>
           {item.url && (
             <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700" title="View Link" onClick={(e) => e.stopPropagation()}>
               <ExternalLink size={14} />
             </a>
           )}
         </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
         <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${
            item.category === 'Filament' ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-800' :
            item.category === 'Part' ? 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-800' :
            'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
          }`}>
            {item.category}
          </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {item.quantity}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {item.price && item.price > 0 ? `$${item.price.toFixed(2)}` : '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
        {item.price && item.price > 0 ? `$${(item.price * item.quantity).toFixed(2)}` : '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end gap-3">
          {item.category === 'Filament' && !item.isPurchased && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onMove(); }} className="text-green-600 dark:text-green-400 hover:text-green-800" title="Add to Inventory">
                <PackagePlus size={18} />
            </button>
          )}
          <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900">Edit</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-600 dark:text-red-400 hover:text-red-900">Delete</button>
        </div>
      </td>
    </tr>
  );
};

const ShoppingCard: React.FC<{ 
  item: ShoppingItem, 
  onToggle: () => void, 
  onEdit: () => void, 
  onDelete: () => void,
  onMove: () => void
}> = ({ item, onToggle, onEdit, onDelete, onMove }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-3 ${item.isPurchased ? 'opacity-75' : ''}`}>
      <div className="flex justify-between items-start">
         <div className="flex items-start gap-3">
            <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }} className="mt-1 text-gray-400 hover:text-green-500 transition-colors focus:outline-none">
               {item.isPurchased ? <CheckSquare size={24} className="text-green-600" /> : <Square size={24} />}
            </button>
            <div>
               <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`text-lg font-semibold text-gray-900 dark:text-white ${item.isPurchased ? 'line-through text-gray-500' : ''}`}>
                    {item.name}
                  </h3>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink size={16} />
                    </a>
                  )}
               </div>
               <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                 {item.category}
               </span>
            </div>
         </div>
         <div className="text-right">
           <div className="font-bold text-gray-900 dark:text-white">
             {item.price && item.price > 0 ? `$${(item.price * item.quantity).toFixed(2)}` : '-'}
           </div>
           {item.price && item.quantity > 1 && (
             <div className="text-xs text-gray-500">
               {item.quantity} x ${item.price.toFixed(2)}
             </div>
           )}
         </div>
      </div>

      <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-4">
        {item.category === 'Filament' && !item.isPurchased && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onMove(); }} className="text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-800 flex items-center">
                <PackagePlus size={16} className="mr-1" /> Inventory
            </button>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center">
           <Edit size={16} className="mr-1"/> Edit
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 flex items-center">
           <Trash2 size={16} className="mr-1"/> Delete
        </button>
      </div>
    </div>
  );
};

const ShoppingItemModal: React.FC<{ 
  initialData: ShoppingItem | null, 
  onClose: () => void, 
  onSave: (item: ShoppingItem) => void 
}> = ({ initialData, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<ShoppingItem>>(initialData || {
    name: '', category: 'Filament', quantity: 1, isPurchased: false, price: 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      addedDate: initialData?.addedDate || new Date().toISOString(),
    } as ShoppingItem);
  };

  const inputClass = "w-full rounded-md border border-gray-300 bg-white text-gray-900 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{initialData ? 'Edit Item' : 'Add Item'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item Name</label>
            <input required type="text" className={inputClass} 
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
               <select className={inputClass} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                 <option value="Filament">Filament</option>
                 <option value="Part">Part</option>
                 <option value="Accessory">Accessory</option>
                 <option value="Other">Other</option>
               </select>
            </div>
            <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
               <input required type="number" min="1" className={inputClass} 
                value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (Each)</label>
               <input type="number" step="0.01" className={inputClass} 
                value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL / Link (Optional)</label>
            <div className="flex items-center gap-2">
               <div className="flex-1 relative">
                 <LinkIcon size={16} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                 <input type="url" className={`${inputClass} pl-8`} placeholder="https://..."
                  value={formData.url || ''} onChange={e => setFormData({...formData, url: e.target.value})} />
               </div>
               {formData.url && (
                 <a href={formData.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                   <ExternalLink size={18} className="text-blue-600 dark:text-blue-400" />
                 </a>
               )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Save Item</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShoppingPage;