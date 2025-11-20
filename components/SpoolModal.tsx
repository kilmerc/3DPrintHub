import React, { useState } from 'react';
import { X, Scale } from 'lucide-react';
import { useAppContext } from '../App';
import { Spool, SpoolStatus } from '../types';
import { PRESET_COLORS } from '../constants';
import Combobox from './Combobox';

const SpoolModal: React.FC<{ initialData: Spool | null, onClose: () => void, onSave: (s: Spool) => void }> = ({ initialData, onClose, onSave }) => {
  const { data, updateSavedLists } = useAppContext();
  const [formData, setFormData] = useState<Partial<Spool>>(initialData || {
    brand: '', material: '', colorName: '', colorHex: '#808080', 
    initialWeight: 1200, emptySpoolWeight: 200, currentWeight: 1200, status: SpoolStatus.Active
  });
  const [weighMode, setWeighMode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(!formData.brand || !formData.material || !formData.colorName) {
      alert("Please fill in all required fields.");
      return;
    }
    onSave({
      ...formData,
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      dateAdded: initialData?.dateAdded || new Date().toISOString(),
    } as Spool);
  };

  const handleDeleteOption = (type: 'brand' | 'material' | 'color', value: string) => {
    if(window.confirm(`Remove "${value}" from history?`)) {
       if (type === 'brand') updateSavedLists(data.savedBrands.filter(i => i !== value), data.savedMaterials, data.savedColorNames);
       if (type === 'material') updateSavedLists(data.savedBrands, data.savedMaterials.filter(i => i !== value), data.savedColorNames);
       if (type === 'color') updateSavedLists(data.savedBrands, data.savedMaterials, data.savedColorNames.filter(i => i !== value));
    }
  };

  const inputClass = "w-full rounded-md border border-gray-300 bg-white text-gray-900 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{initialData ? 'Edit Spool' : 'Add New Spool'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Combobox 
              label="Brand" 
              value={formData.brand || ''} 
              onChange={v => setFormData({...formData, brand: v})} 
              options={data.savedBrands}
              onDeleteOption={v => handleDeleteOption('brand', v)}
              required
              placeholder="e.g. Polymaker"
            />
            <Combobox 
              label="Material" 
              value={formData.material || ''} 
              onChange={v => setFormData({...formData, material: v})} 
              options={data.savedMaterials}
              onDeleteOption={v => handleDeleteOption('material', v)}
              required
              placeholder="e.g. PLA"
            />
          </div>

          <div>
            <div className="flex gap-4 items-end">
               <div className="flex-1">
                 <Combobox 
                    label="Color Name" 
                    value={formData.colorName || ''} 
                    onChange={v => setFormData({...formData, colorName: v})} 
                    options={data.savedColorNames}
                    onDeleteOption={v => handleDeleteOption('color', v)}
                    required
                    placeholder="e.g. Jungle Green"
                  />
               </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hex</label>
                 <input type="color" className="h-[38px] w-12 rounded cursor-pointer border border-gray-300 dark:border-gray-600 p-1 bg-white dark:bg-gray-700" 
                  value={formData.colorHex} onChange={e => setFormData({...formData, colorHex: e.target.value})} />
               </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-2 max-h-24 overflow-y-auto">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" 
                  className={`w-5 h-5 rounded-full border ${formData.colorHex === c ? 'ring-2 ring-offset-1 ring-blue-500' : 'border-gray-200'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setFormData({...formData, colorHex: c})}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Empty Weight (g)</label>
              <input type="number" className={inputClass} 
                value={formData.emptySpoolWeight} onChange={e => setFormData({...formData, emptySpoolWeight: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Gross (g)</label>
               <div className="flex gap-2">
                <input type="number" className={inputClass} 
                  value={formData.currentWeight} onChange={e => setFormData({...formData, currentWeight: Number(e.target.value)})} />
                 <button type="button" onClick={() => setWeighMode(!weighMode)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"><Scale size={16}/></button>
               </div>
            </div>
          </div>
          
          {weighMode && (
             <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
               Place spool on scale. Enter the total displayed weight.
             </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Save Spool</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SpoolModal;