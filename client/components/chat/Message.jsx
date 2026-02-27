import { ThumbsUp, ThumbsDown, Copy, MoreVertical } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '@/components/providers/ThemeProvider';

const themeMessageClasses = {
    default: {
        userBubble: 'bg-indigo-600',
        userAvatar: 'from-indigo-400 to-purple-500',
        aiAvatar: 'from-indigo-500 to-purple-600',
    },
    ocean: {
        userBubble: 'bg-gradient-to-r from-cyan-500 to-blue-600',
        userAvatar: 'from-cyan-400 to-blue-500',
        aiAvatar: 'from-cyan-500 to-blue-600',
    },
    forest: {
        userBubble: 'bg-gradient-to-r from-emerald-600 to-green-700',
        userAvatar: 'from-emerald-500 to-green-600',
        aiAvatar: 'from-emerald-600 to-green-700',
    },
    sunset: {
        userBubble: 'bg-gradient-to-r from-orange-500 to-red-600',
        userAvatar: 'from-orange-400 to-red-500',
        aiAvatar: 'from-orange-500 to-red-600',
    },
    midnight: {
        userBubble: 'bg-gradient-to-r from-violet-600 to-indigo-700',
        userAvatar: 'from-violet-500 to-indigo-600',
        aiAvatar: 'from-violet-600 to-indigo-700',
    },
};

function formatMessageTimestamp(value) {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((startOfToday - startOfMessageDay) / (1000 * 60 * 60 * 24));
    const currentDayOfWeek = (now.getDay() + 6) % 7;
    const startOfCurrentWeek = new Date(startOfToday);
    startOfCurrentWeek.setDate(startOfToday.getDate() - currentDayOfWeek);
    const isInCurrentWeek = startOfMessageDay >= startOfCurrentWeek && diffDays >= 0;
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (diffDays === 0) return `Today, ${time}`;
    if (diffDays === 1) return `Yesterday, ${time}`;
    if (isInCurrentWeek) {
        const weekday = date.toLocaleDateString([], { weekday: 'short' });
        return `${weekday}, ${time}`;
    }

    const fullDate = date.toLocaleDateString([], {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    return `${fullDate}, ${time}`;
}

export default function Message({
    role,
    content,
    createdAt,
    avatar,
    isLastMessage,
    user
}) {
    const [copied, setCopied] = useState(false);
    const { theme } = useTheme();
    const isUser = role === 'user';
    const timestamp = formatMessageTimestamp(createdAt);
    const messageClass = themeMessageClasses[theme] || themeMessageClasses.default;

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`flex gap-2 sm:gap-3 mb-4 sm:mb-6 group ${isUser ? 'justify-end' : 'justify-start'}`}>

            {!isUser && (
                <div className={`w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-gradient-to-br ${messageClass.aiAvatar} flex-shrink-0 flex items-center justify-center text-white text-xs sm:text-sm font-semibold`}>
                    Ai
                </div>
            )}

            <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-xs sm:max-w-2xl`}>

                {!isUser && (
                    <div className="flex items-center gap-2 mb-1 px-2">
                        <span className="text-xs sm:text-sm font-semibold text-gray-900">CHAT A.I</span>
                        {timestamp && <span className="text-xs text-gray-500">{timestamp}</span>}
                    </div>
                )}

                {/* ⭐ MESSAGE BODY */}
                <div
                    className={`px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm leading-relaxed prose prose-sm max-w-none
                    ${isUser
                        ? `${messageClass.userBubble} text-white rounded-br-none break-words prose-invert`
                        : 'bg-gray-100 text-gray-900 rounded-bl-none break-words'}`}
                >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {content}
                    </ReactMarkdown>
                </div>

                {/* ⭐ ACTIONS */}
                {!isUser && isLastMessage && (
                    <div className="flex items-center gap-1 sm:gap-2 mt-2 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700">
                            <ThumbsUp size={14} />
                        </button>
                        <button className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700">
                            <ThumbsDown size={14} />
                        </button>
                        <button onClick={handleCopy} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700">
                            <Copy size={14} />
                        </button>
                        <button className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700">
                            <MoreVertical size={14} />
                        </button>
                    </div>
                )}

                {isUser && (
                    timestamp && <span className="text-xs text-gray-500 mt-1 px-2">{timestamp}</span>
                )}
            </div>

            {isUser && (
                <div className={`w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-gradient-to-br ${messageClass.userAvatar} flex-shrink-0 flex items-center justify-center text-white text-xs sm:text-sm font-semibold`}>
                    {user}
                </div>
            )}
        </div>
    );
}
