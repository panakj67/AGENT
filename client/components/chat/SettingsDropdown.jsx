import { useState, useRef, useEffect } from 'react';
import { Settings, LogOut, Palette, Check } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
const themeOptions = [
    { value: 'default', label: 'Default', description: 'Indigo & Pink' },
    { value: 'ocean', label: 'Ocean', description: 'Blue & Cyan' },
    { value: 'forest', label: 'Forest', description: 'Green & Emerald' },
    { value: 'sunset', label: 'Sunset', description: 'Orange & Red' },
    { value: 'midnight', label: 'Midnight', description: 'Purple & Indigo' },
];

export default function SettingsDropdown({ onLogout }) {
    const [isOpen, setIsOpen] = useState(false);
    const { theme, setTheme } = useTheme();
    const dropdownRef = useRef(null);
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);
    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        setIsOpen(false);
    };
    const handleLogout = () => {
        setIsOpen(false);
        onLogout === null || onLogout === void 0 ? void 0 : onLogout();
    };
    return (<div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-lg text-gray-700 text-sm transition-colors" aria-label="Settings" title="Settings">
        <Settings size={16} className="md:w-4.5 md:h-4.5"/>
        <span className="text-xs md:text-sm">Settings</span>
      </button>

      {isOpen && (<>
          {/* Mobile backdrop */}
          <div className="md:hidden fixed inset-0 z-40" onClick={() => setIsOpen(false)}/>
          
          {/* Dropdown Menu */}
          {/*
            On small screens the sidebar has overflow-hidden, which previously
            clipped the absolute dropdown. Switch to fixed positioning so the menu
            floats above the viewport. On medium+ screens keep the old absolute
            behavior (positioned above the button using bottom-full).
          */}
          <div className="fixed left-4 right-4 bottom-16 mb-1 max-w-sm md:inset-auto md:absolute md:left-0 md:bottom-full md:min-w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
            {/* Theme Selection */}
            <div className="border-b border-gray-200">
              <div className="px-4 py-3 flex items-center gap-2 text-gray-900 font-semibold text-sm">
                <Palette size={16}/>
                <span>Theme</span>
              </div>

              <div className="px-2 py-1 space-y-1">
                {themeOptions.map((option) => (<button key={option.value} onClick={() => handleThemeChange(option.value)} className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${theme === option.value
                    ? 'bg-indigo-50 text-indigo-900 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'}`}>
                    <div className="flex flex-col items-start">
                      <span>{option.label}</span>
                      <span className="text-xs text-gray-500">{option.description}</span>
                    </div>
                    {theme === option.value && <Check size={16} className="text-indigo-600"/>}
                  </button>))}
              </div>
            </div>

            {/* Logout Button */}
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors border-t border-gray-200 text-sm font-medium">
              <LogOut size={16}/>
              <span>Logout</span>
            </button>
          </div>
        </>)}
    </div>);
}
