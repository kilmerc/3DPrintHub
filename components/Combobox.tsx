import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface ComboboxProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  onDeleteOption: (opt: string) => void;
  required?: boolean;
  placeholder?: string;
}

const Combobox: React.FC<ComboboxProps> = ({ label, value, onChange, options, onDeleteOption, required, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter(opt => opt.toLowerCase().includes(value.toLowerCase()));

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <div className="relative">
        <input 
          type="text" 
          required={required}
          className="w-full rounded-md border border-gray-300 bg-white text-gray-900 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          value={value}
          onChange={(e) => { onChange(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
        />
        <button 
          type="button"
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          onClick={() => setIsOpen(!isOpen)}
          tabIndex={-1}
        >
          <ChevronDown size={16} />
        </button>
      </div>
      
      {isOpen && (filtered.length > 0 || value === '') && (
        <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.length > 0 ? filtered.map(opt => (
            <li key={opt} className="flex justify-between items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer group">
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-200" onClick={() => { onChange(opt); setIsOpen(false); }}>
                {opt}
              </span>
              <button 
                type="button"
                onMouseDown={(e) => { 
                  e.preventDefault();
                  e.stopPropagation(); 
                  onDeleteOption(opt); 
                }}
                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                title="Delete from history"
              >
                <X size={14} />
              </button>
            </li>
          )) : (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
              No matching history
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default Combobox;