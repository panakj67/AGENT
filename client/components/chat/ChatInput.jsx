
import { Send, Brain } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';

const themeBrainIcons = {
    default: 'from-pink-200 to-pink-300',
    ocean: 'from-cyan-200 to-blue-300',
    forest: 'from-emerald-200 to-green-300',
    sunset: 'from-orange-200 to-red-300',
    midnight: 'from-purple-300 to-indigo-400',
};

const themeButtonClasses = {
    default: 'bg-blue-600 hover:bg-blue-700',
    ocean: 'bg-blue-500 hover:bg-blue-600',
    forest: 'bg-green-600 hover:bg-green-700',
    sunset: 'bg-orange-500 hover:bg-orange-600',
    midnight: 'bg-purple-700 hover:bg-purple-800',
};

export default function ChatInput({ onSend, disabled }) {
    const [input, setInput] = useState('');
    const { theme } = useTheme();
    const textareaRef = useRef(null);

    const handleSubmit = () => {
        if (input.trim() && !disabled) {
            onSend?.(input);
            setInput('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleChange = (e) => {
        setInput(e.target.value);

        // auto resize
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height =
                Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    };

    const buttonClass = themeButtonClasses[theme] || themeButtonClasses.default;
    const brainIconClass = themeBrainIcons[theme] || themeBrainIcons.default;

    return (
        <div className="relative">

            {/* ⭐ Fade overlay (ChatGPT effect) */}
            <div className="pointer-events-none absolute -top-10 left-0 right-0 h-10 bg-gradient-to-t from-white via-white/20 to-transparent" />

            {/* ⭐ Input area */}
            <div className="bg-gradient-to-b from-white via-white to-gray-50 pt-1 pb-4 sm:pb-6 md:pb-8">
                <div className="max-w-4xl mx-auto">
                    <div className="flex gap-2 sm:gap-4 items-end">

                        {/* Brain icon */}
                        <div className="flex-shrink-0 hidden sm:flex">
                            <div
                                className={`w-8 sm:w-10 h-8 sm:h-10 rounded-full bg-gradient-to-br ${brainIconClass} flex items-center justify-center shadow-md`}
                            >
                                <Brain size={18} className="sm:w-5 sm:h-5 text-opacity-70" />
                            </div>
                        </div>

                        {/* Input box */}
                        <div className="flex-1 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 focus-within:ring-1 focus-within:ring-opacity-20 transition-all duration-200 shadow-md hover:shadow-lg flex items-center px-4 sm:px-5 py-3 sm:py-4">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={handleChange}
                                onKeyDown={handleKeyDown}
                                placeholder="What's in your mind?..."
                                disabled={disabled}
                                rows={1}
                                style={{ maxHeight: '120px' }}
                                className="flex-1 bg-transparent focus:outline-none resize-none text-sm sm:text-base text-gray-900 placeholder-gray-400 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                        </div>

                        {/* Send button */}
                        <button
                            onClick={handleSubmit}
                            disabled={!input.trim() || disabled}
                            className={`w-10 sm:w-12 h-10 sm:h-12 rounded-full ${buttonClass} disabled:bg-gray-300 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all duration-200 flex-shrink-0 active:scale-95 shadow-lg hover:shadow-xl`}
                        >
                            <Send size={20} className="sm:w-6 sm:h-6" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
