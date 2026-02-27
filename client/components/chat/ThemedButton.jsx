var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/providers/ThemeProvider';
const themeButtonClasses = {
    default: 'bg-indigo-600 hover:bg-indigo-700',
    ocean: 'bg-blue-500 hover:bg-blue-600',
    forest: 'bg-green-600 hover:bg-green-700',
    sunset: 'bg-orange-500 hover:bg-orange-600',
    midnight: 'bg-purple-700 hover:bg-purple-800',
};
export default function ThemedButton(_a) {
    var { children, variant = 'primary', className } = _a, props = __rest(_a, ["children", "variant", "className"]);
    const { theme } = useTheme();
    const buttonClass = themeButtonClasses[theme] || themeButtonClasses.default;
    if (variant === 'outline') {
        return (<Button {...props} variant="outline" className={className}>
        {children}
      </Button>);
    }
    return (<Button {...props} className={`w-full ${buttonClass} text-white flex items-center justify-center gap-2 rounded-lg text-sm md:text-base py-2 ${className || ''}`}>
      {children}
    </Button>);
}
