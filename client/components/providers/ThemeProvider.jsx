import React, { createContext, useContext, useEffect, useState } from 'react';
const ThemeContext = createContext(undefined);
const themeColors = {
    default: {
        primary: 'oklch(0.646 0.222 41.116)',
        accent: 'oklch(0.708 0 0)',
        button: 'bg-indigo-600 hover:bg-indigo-700',
        brainIcon: 'from-pink-200 to-pink-300',
    },
    ocean: {
        primary: 'oklch(0.578 0.211 253.45)',
        accent: 'oklch(0.65 0.15 260)',
        button: 'bg-blue-500 hover:bg-blue-600',
        brainIcon: 'from-cyan-200 to-blue-300',
    },
    forest: {
        primary: 'oklch(0.45 0.18 150)',
        accent: 'oklch(0.60 0.15 150)',
        button: 'bg-green-600 hover:bg-green-700',
        brainIcon: 'from-emerald-200 to-green-300',
    },
    sunset: {
        primary: 'oklch(0.62 0.22 35)',
        accent: 'oklch(0.70 0.18 40)',
        button: 'bg-orange-500 hover:bg-orange-600',
        brainIcon: 'from-orange-200 to-red-300',
    },
    midnight: {
        primary: 'oklch(0.35 0.12 290)',
        accent: 'oklch(0.50 0.15 290)',
        button: 'bg-purple-700 hover:bg-purple-800',
        brainIcon: 'from-purple-300 to-indigo-400',
    },
};
export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState('default');
    const [mounted, setMounted] = useState(false);
    const [isClient, setIsClient] = useState(false);
    useEffect(() => {
        setIsClient(true);
        setMounted(true);
        try {
            const savedTheme = localStorage.getItem('chat-theme');
            if (savedTheme && Object.keys(themeColors).includes(savedTheme)) {
                setTheme(savedTheme);
                applyTheme(savedTheme);
            }
            else {
                applyTheme('default');
            }
        }
        catch (e) {
            console.error('Failed to load theme from localStorage:', e);
            applyTheme('default');
        }
    }, []);
    const applyTheme = (newTheme) => {
        const colors = themeColors[newTheme];
        const root = document.documentElement;
        root.style.setProperty('--theme-primary', colors.primary);
        root.style.setProperty('--theme-accent', colors.accent);
        root.setAttribute('data-theme', newTheme);
        localStorage.setItem('chat-theme', newTheme);
    };
    const handleSetTheme = (newTheme) => {
        setTheme(newTheme);
        applyTheme(newTheme);
    };
    if (!isClient || !mounted) {
        return <>{children}</>;
    }
    return (<ThemeContext.Provider value={{ theme, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>);
}
export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}
export function getThemeButtonClass(theme) {
    return themeColors[theme].button;
}
export function getThemeBrainIconClass(theme) {
    return themeColors[theme].brainIcon;
}
