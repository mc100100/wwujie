import React, { useState, useRef, useEffect } from 'react';

interface Option {
  label: string;
  value: string;
}

interface MD3SelectProps {
  label?: string;
  value: string | number;
  options: Option[];
  onChange: (value: any) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

const MD3Select: React.FC<MD3SelectProps> = ({ 
  label, 
  value, 
  options, 
  onChange, 
  className = "",
  placeholder = "Select",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    if (disabled) return;
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1.5 ml-1">{label}</label>
      )}
      
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          w-full bg-slate-100 dark:bg-slate-950/50 border 
          ${isOpen ? 'border-purple-500 ring-1 ring-purple-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'} 
          rounded-xl px-3 py-2.5 flex items-center justify-between cursor-pointer transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <span className={`text-xs truncate ${selectedOption ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
      </div>

      {/* Dropdown Menu */}
      <div 
        className={`
          absolute z-[100] mt-1 w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden
          origin-top transition-all duration-200 ease-out transform
          ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}
        `}
        style={{ maxHeight: '240px', overflowY: 'auto' }}
      >
        <div className="py-1">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <div
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`
                  px-3 py-2.5 text-xs cursor-pointer flex items-center justify-between transition-colors
                  ${isSelected ? 'bg-purple-100 dark:bg-purple-600/10 text-purple-600 dark:text-purple-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}
                `}
              >
                <span>{opt.label}</span>
                {isSelected && <i className="fa-solid fa-check text-purple-500 dark:text-purple-400 text-[10px]"></i>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MD3Select;