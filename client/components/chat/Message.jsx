import { ThumbsUp, ThumbsDown, Copy, MoreVertical, RotateCcw } from 'lucide-react';
import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '@/components/providers/ThemeProvider';
import { remarkHighlight } from '@/src/lib/remarkHighlight';
// At top of Message.jsx

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
    if (isInCurrentWeek) return `${date.toLocaleDateString([], { weekday: 'short' })}, ${time}`;
    return `${date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${time}`;
}

// ─── CodeBlock — Claude-style dark card with language label + copy ─────────
function CodeBlock({ lang, code }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="my-3 rounded-xl overflow-hidden border border-gray-700 shadow-md text-[12px] font-mono">
            {/* Header bar */}
            <div className="flex items-center justify-between bg-gray-800 px-3 py-1.5">
                <span className="text-gray-400 text-[11px] tracking-wide">
                    {lang || 'code'}
                </span>
                <button
                    onClick={copy}
                    className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-[11px]"
                >
                    <Copy size={11} />
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            {/* Code body */}
            <pre className="bg-[#1a1b26] text-gray-200 p-4 overflow-x-auto leading-relaxed whitespace-pre">
                <code>{code}</code>
            </pre>
        </div>
    );
}

// ─── Markdown component map ────────────────────────────────────────────────
// Explicitly styled so bold, lists, code all render correctly regardless of
// Tailwind's prose reset. This is the core of what Image 2 looks like.
const markdownComponents = {
    p: ({ children }) => (
        <p className="mb-3 last:mb-0 leading-relaxed text-[14px] sm:text-[15px] text-gray-900">{children}</p>
    ),
    strong: ({ children }) => (
        <strong className="font-semibold text-gray-900">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,

    // Numbered list — matches Image 2 step layout
    ol: ({ children }) => (
        <ol className="list-decimal list-outside ml-5 mb-3 space-y-2.5 text-[14px] sm:text-[15px]">{children}</ol>
    ),
    // Bullet list
    ul: ({ children }) => (
        <ul className="list-disc list-outside ml-5 mb-3 space-y-1.5 text-[14px] sm:text-[15px]">{children}</ul>
    ),
    li: ({ children }) => (
        <li className="leading-relaxed pl-1 text-gray-800">{children}</li>
    ),

    h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-4 text-gray-900">{children}</h1>,
    h2: ({ children }) => <h2 className="text-sm font-bold mb-2 mt-3 text-gray-900">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold mb-1.5 mt-2 text-gray-900">{children}</h3>,

    // ── Table elements ─────────────────────────────────────────────────────
    // Tailwind resets all table styles to nothing — every element needs
    // explicit classes or you get the borderless/spaceless look you saw.
    table: ({ children }) => (
        <div className="overflow-x-auto my-4 rounded-xl border-1 border-gray-300 bg-white">
            <table className="w-full text-[13px] sm:text-[14px] border-collapse">
                {children}
            </table>
        </div>
    ),
    thead: ({ children }) => (
        <thead className="bg-gray-100 border-b-1 border-gray-300">
            {children}
        </thead>
    ),
    tbody: ({ children }) => (
        <tbody className="divide-y divide-gray-200">
            {children}
        </tbody>
    ),
    tr: ({ children }) => (
        <tr className="odd:bg-white even:bg-gray-50/70 transition-colors">
            {children}
        </tr>
    ),
    th: ({ children }) => (
        <th className="px-3 sm:px-4 py-2.5 text-left text-[11px] sm:text-[12px] font-bold text-gray-800 uppercase tracking-wide whitespace-nowrap border-r border-gray-300 last:border-r-0">
            {children}
        </th>
    ),
    td: ({ children }) => (
        <td className="px-3 sm:px-4 py-2.5 text-gray-900 font-medium border-r border-gray-200 last:border-r-0 align-top">
            {children}
        </td>
    ),

    // ── Code blocks ───────────────────────────────────────────────────────
    // Claude-style: dark header bar with language name + copy button,
    // dark body with syntax-colored text.
    code: ({ node, className, children, ...props }) => {
        const isInline = !className && !String(children).includes('\n');
        if (isInline) {
            return (
                <code className="bg-gray-100 border border-gray-200 text-orange-600 px-1.5 py-0.5 rounded text-[11px] font-mono" {...props}>
                    {children}
                </code>
            );
        }
        const lang = className?.replace('language-', '') || '';
        return (
            <CodeBlock lang={lang} code={String(children).replace(/\n$/, '')} />
        );
    },
    pre: ({ children }) => <>{children}</>,
    blockquote: ({ children }) => (
        <blockquote className="border-l-[3px] border-orange-400 pl-4 italic text-gray-500 my-3 bg-orange-50/40 py-1 rounded-r-sm">
            {children}
        </blockquote>
    ),
    hr: () => <hr className="border-gray-200 my-4" />,
    a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer"
            className="text-orange-600 underline decoration-orange-300 underline-offset-2 hover:text-orange-800 transition-colors">
            {children}
        </a>
    ),
    h4: ({ children }) => <h4 className="text-sm font-semibold mb-1 mt-2 text-gray-800">{children}</h4>,
    h5: ({ children }) => <h5 className="text-xs font-semibold mb-1 mt-2 text-gray-700 uppercase tracking-wide">{children}</h5>,
    mark: ({ children }) => (
      <mark className="bg-[#f0e6d3] text-[#cc785c] px-1 py-0.5 rounded font-medium not-italic"
        style={{ backgroundColor: 'rgba(218, 119, 86, 0.12)', color: '#cc785c' }}>
        {children}
      </mark>
    ),
};

// White-text variant for user bubbles
const markdownComponentsInvert = {
    ...markdownComponents,
    p: ({ children }) => (
        <p className="mb-2 last:mb-0 leading-relaxed text-[14px] sm:text-[15px] text-white">{children}</p>
    ),
    strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
    li: ({ children }) => <li className="leading-relaxed pl-1 text-white/90">{children}</li>,
    h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 text-white">{children}</h1>,
    h2: ({ children }) => <h2 className="text-sm font-bold mb-2 mt-2 text-white">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold mb-1.5 mt-2 text-white">{children}</h3>,
    a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer"
            className="text-white underline opacity-90 hover:opacity-100">
            {children}
        </a>
    ),
    code: ({ node, className, children, ...props }) => {
        const isInline = !className && !String(children).includes('\n');
        if (isInline) {
            return (
                <code className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[11px] font-mono" {...props}>
                    {children}
                </code>
            );
        }
        const lang = className?.replace('language-', '') || '';
        return <CodeBlock lang={lang} code={String(children).replace(/\n$/, '')} />;
    },
};

// ─── StreamingMarkdown ────────────────────────────────────────────────────
// Renders full Markdown WHILE tokens arrive — no plain-text flash.
// The blinking cursor is appended outside the markdown parser so it
// doesn't interfere with list/bold rendering.
function StreamingMarkdown({ content }) {
    return (
        <div
            className="text-[14px] sm:text-[15px] leading-relaxed break-words whitespace-pre-wrap min-h-[1.25rem]"
        >
            {content || (
                <span className="inline-flex gap-1 py-1" aria-label="Thinking">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                </span>
            )}
        </div>
    );
}
// ─── Message ──────────────────────────────────────────────────────────────
const Message = memo(function Message({
    role,
    content,
    createdAt,
    isLastMessage,
    user,
    isStreaming = false,
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
            
            {/* AI avatar — aligned to top of bubble */}
            {!isUser && (
                <div className={`w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-gradient-to-br ${messageClass.aiAvatar}
                    flex-shrink-0 flex items-center justify-center text-white text-xs sm:text-sm font-semibold mt-5`}>
                    Ai
                </div>
            )}

            <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} min-w-0 ${
                isUser
                    ? 'max-w-[88%] sm:max-w-2xl'
                    : 'max-w-[95%] sm:max-w-4xl lg:max-w-5xl'
            }`}>

                {/* AI header */}
                {!isUser && (
                    <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-xs sm:text-sm font-semibold text-gray-900">CHAT A.I</span>
                        {timestamp && <span className="text-xs text-gray-400">{timestamp}</span>}
                    </div>
                )}

                {/* ── Bubble ───────────────────────────────────────────── */}
                <div
                    className={`w-full min-w-0 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl
                        ${isUser
                            // User: coloured pill, tight rounding on send corner
                            ? `${messageClass.userBubble} text-white rounded-tr-sm shadow-sm`
                            // AI: light card with subtle border — matches Image 2 white bg
                            : 'bg-white/95 backdrop-blur-sm border border-gray-200 text-gray-900 rounded-tl-sm shadow-sm sm:shadow-md'
                        }`}
                >
                    {isUser ? (
                        <div className="text-[14px] sm:text-[15px] leading-relaxed break-words">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkHighlight]} components={markdownComponentsInvert}>
                                {content}
                            </ReactMarkdown>
                        </div>
                    ) : isStreaming ? (
                        // ReactMarkdown runs on every content update while streaming
                        <StreamingMarkdown content={content} />
                    ) : (
                        <div className="text-[14px] sm:text-[15px] leading-relaxed break-words min-w-0">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkHighlight]} components={markdownComponents}>
                                {content}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>

                {/* ── Actions — Image 2 layout: icons | separator | Regenerate ── */}
                {!isUser && isLastMessage && !isStreaming && (
                    <div className="flex items-center justify-between w-full mt-2 px-1
                        opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <div className="flex items-center gap-0.5 text-gray-400">
                            <button onClick={() => {}} title="Like"
                                className="p-1.5 hover:bg-gray-100 rounded-lg hover:text-gray-700 transition-colors">
                                <ThumbsUp size={13} />
                            </button>
                            <span className="text-gray-200 select-none">|</span>
                            <button onClick={() => {}} title="Dislike"
                                className="p-1.5 hover:bg-gray-100 rounded-lg hover:text-gray-700 transition-colors">
                                <ThumbsDown size={13} />
                            </button>
                            <span className="text-gray-200 select-none">|</span>
                            <button onClick={handleCopy} title={copied ? 'Copied!' : 'Copy'}
                                className="p-1.5 hover:bg-gray-100 rounded-lg hover:text-gray-700 transition-colors">
                                <Copy size={13} />
                            </button>
                            <span className="text-gray-200 select-none">|</span>
                            <button onClick={() => {}} title="More"
                                className="p-1.5 hover:bg-gray-100 rounded-lg hover:text-gray-700 transition-colors">
                                <MoreVertical size={13} />
                            </button>
                        </div>

                        {/* Regenerate — right side, matches Image 2 */}
                        <button onClick={() => {}} title="Regenerate"
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-500
                                hover:text-gray-700 hover:bg-gray-100 transition-colors border border-transparent
                                hover:border-gray-200">
                            <RotateCcw size={11} />
                            <span>Regenerate</span>
                        </button>
                    </div>
                )}

                {/* User timestamp */}
                {isUser && timestamp && (
                    <span className="text-xs text-gray-400 mt-1 px-1">{timestamp}</span>
                )}
            </div>

            {/* User avatar */}
            {isUser && (
                <div className={`w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-gradient-to-br ${messageClass.userAvatar}
                    flex-shrink-0 flex items-center justify-center text-white text-xs sm:text-sm font-semibold`}>
                    {user}
                </div>
            )}
        </div>
    );
}, (prev, next) => (
    prev.role          === next.role
    && prev.content       === next.content
    && prev.createdAt     === next.createdAt
    && prev.isLastMessage === next.isLastMessage
    && prev.user          === next.user
    && prev.isStreaming    === next.isStreaming
));

export default Message;
