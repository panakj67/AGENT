import Message from './Message';
import { useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';

const themeAvatarClasses = {
    default:  { welcome: 'from-indigo-100 to-purple-100 text-indigo-600',   ai: 'from-indigo-500 to-purple-600'  },
    ocean:    { welcome: 'from-cyan-100 to-blue-100 text-blue-600',         ai: 'from-cyan-500 to-blue-600'      },
    forest:   { welcome: 'from-emerald-100 to-green-100 text-green-700',    ai: 'from-emerald-500 to-green-600'  },
    sunset:   { welcome: 'from-orange-100 to-red-100 text-orange-700',      ai: 'from-orange-500 to-red-600'     },
    midnight: { welcome: 'from-violet-100 to-indigo-100 text-indigo-700',   ai: 'from-violet-600 to-indigo-700'  },
};

export default function ChatArea({
    messages,
    user,
    isLoading,
    isSelectingChat = false,
    streamingMessageId,
    streamingContent = '',
}) {
    const { theme } = useTheme();
    const messagesEndRef = useRef(null);
    const lastMessageRef = useRef(null);
    const wasSelectingRef = useRef(false);

    // Only show the streaming placeholder once it has content — avoids a
    // blank flash before the first token arrives.
    const visibleMessages = useMemo(() => {
        return messages.filter((message) => {
            if (!isLoading) return true;
            if (!streamingMessageId) return true;
            if (message.id !== streamingMessageId) return true;
            return Boolean((message.content || '').trim());
        });
    }, [messages, isLoading, streamingMessageId]);

    useEffect(() => {
        const justFinishedSelecting = wasSelectingRef.current && !isSelectingChat;
        const behavior = (isLoading || isSelectingChat || justFinishedSelecting) ? 'auto' : 'smooth';

        // During chat switching, land on the start of the latest message (ChatGPT-like).
        if (isSelectingChat || justFinishedSelecting) {
            lastMessageRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else {
            messagesEndRef.current?.scrollIntoView({ behavior });
        }

        wasSelectingRef.current = isSelectingChat;
    }, [messages, isLoading, isSelectingChat]);

    const avatarClass = themeAvatarClasses[theme] || themeAvatarClasses.default;

    return (
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-white">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {isSelectingChat ? (
                    <div className="flex items-center justify-center min-h-[55vh] sm:min-h-[60vh]">
                        <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6">
                            <div className="flex items-center gap-3 mb-5">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                                <p className="text-sm sm:text-base font-semibold text-gray-800">Loading conversation...</p>
                            </div>
                            <div className="space-y-3 animate-pulse">
                                <div className="h-3 rounded bg-gray-200 w-11/12" />
                                <div className="h-3 rounded bg-gray-200 w-9/12" />
                                <div className="h-3 rounded bg-gray-200 w-10/12" />
                                <div className="h-3 rounded bg-gray-200 w-8/12" />
                            </div>
                        </div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-center py-12 sm:py-16">
                        <div className="w-full">
                            <div className={`w-12 sm:w-16 h-12 sm:h-16 bg-gradient-to-br ${avatarClass.welcome} rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center shadow-sm`}>
                                <span className="text-xl sm:text-2xl font-bold">A</span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-1 sm:mb-2 px-4">Start a new conversation</h2>
                            <p className="text-sm sm:text-base text-gray-600 px-4">Ask me anything to get started</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {visibleMessages.map((message, index) => {
                            const isStreaming = message.id === streamingMessageId;
                            const isLastVisibleMessage = index === visibleMessages.length - 1;
                            return (
                                <div key={message.id} ref={isLastVisibleMessage ? lastMessageRef : null}>
                                    <Message
                                        {...message}
                                        content={isStreaming ? (streamingContent || message.content || '') : message.content}
                                        isLastMessage={isLastVisibleMessage}
                                        user={user}
                                        isStreaming={isStreaming}
                                    />
                                </div>
                            );
                        })}

                        {/* Streaming placeholder shown before first token arrives */}
                        {isLoading && streamingMessageId && !visibleMessages.some((m) => m.id === streamingMessageId) && (
                            <Message
                                id={streamingMessageId}
                                role="assistant"
                                createdAt={new Date().toISOString()}
                                isLastMessage
                                user={user}
                                isStreaming
                                content={streamingContent}
                            />
                        )}

                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>
        </div>
    );
}
