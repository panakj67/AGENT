import { useState, useCallback, useEffect, useRef } from 'react';
import { Menu, X } from 'lucide-react';
import { authHeaders, clearAuthToken, getApiBaseUrl } from '@/lib/auth';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatArea from '@/components/chat/ChatArea';
import ChatInput from '@/components/chat/ChatInput';

const API_BASE_URL = getApiBaseUrl();

function createUiMessage(role, content, createdAt = new Date().toISOString()) {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        content,
        createdAt,
    };
}

function mapServerMessages(messages = []) {
    return messages.map((message, index) => ({
        id: message.id || message._id || `${message.createdAt || Date.now()}-${index}`,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt || message.timestamp || null,
    }));
}

async function consumeSseStream(response, handlers) {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Streaming response body is not available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let boundaryIndex = buffer.indexOf('\n\n');
        while (boundaryIndex !== -1) {
            const rawEvent = buffer.slice(0, boundaryIndex).trim();
            buffer = buffer.slice(boundaryIndex + 2);
            boundaryIndex = buffer.indexOf('\n\n');

            if (!rawEvent) continue;

            const dataLine = rawEvent
                .split('\n')
                .find((line) => line.startsWith('data: '));

            if (!dataLine) continue;

            let payload;
            try {
                payload = JSON.parse(dataLine.slice(6));
            } catch {
                continue;
            }

            if (payload?.type === 'token') {
                handlers.onToken?.(payload.token || '');
                continue;
            }

            if (payload?.type === 'done') {
                handlers.onDone?.(payload);
                continue;
            }

            if (payload?.type === 'error') {
                handlers.onError?.(payload);
            }
        }
    }
}

export default function Home({ user, onLogout }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [conversationId, setConversationId] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [streamingMessageId, setStreamingMessageId] = useState(null);
    const streamTokenBufferRef = useRef('');
    const streamRafRef = useRef(null);

    const loadConversations = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/conversations`, {
                headers: authHeaders(),
            });
            if (response.status === 401) {
                clearAuthToken();
                onLogout?.();
                return;
            }
            if (!response.ok) {
                return;
            }
            const data = await response.json();
            
            if (Array.isArray(data)) {
                setChatHistory(data);
            }
        } catch (error) {
            console.error('Failed to load conversations', error);
        }
    }, [onLogout]);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    const flushBufferedTokens = useCallback((assistantMessageId) => {
        if (!assistantMessageId) return;
        if (!streamTokenBufferRef.current) return;

        const chunk = streamTokenBufferRef.current;
        streamTokenBufferRef.current = '';
        setMessages((prev) =>
            prev.map((item) =>
                item.id === assistantMessageId
                    ? { ...item, content: `${item.content || ''}${chunk}` }
                    : item,
            ),
        );
    }, []);

    useEffect(() => () => {
        if (streamRafRef.current) {
            cancelAnimationFrame(streamRafRef.current);
        }
    }, []);

    const handleSendMessage = useCallback(async (message) => {
        const assistantMessageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-assistant`;
        const userMessage = createUiMessage('user', message);
        const assistantPlaceholder = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
        setIsLoading(true);
        setStreamingMessageId(assistantMessageId);
        streamTokenBufferRef.current = '';

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat?stream=1`, {
                method: 'POST',
                headers: {
                    ...authHeaders({ Accept: 'text/event-stream' }),
                },
                body: JSON.stringify({
                    conversationId,
                    message,
                }),
            });

            if (response.status === 401) {
                clearAuthToken();
                onLogout?.();
                return;
            }

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.details || data?.error || 'Failed to send message');
            }

            let streamedText = '';
            let donePayload = null;

            await consumeSseStream(response, {
                onToken: (token) => {
                    streamedText += token;
                    streamTokenBufferRef.current += token;
                    if (!streamRafRef.current) {
                        streamRafRef.current = requestAnimationFrame(() => {
                            streamRafRef.current = null;
                            flushBufferedTokens(assistantMessageId);
                        });
                    }
                },
                onDone: (payload) => {
                    donePayload = payload;
                },
                onError: (payload) => {
                    throw new Error(payload?.details || payload?.error || 'Stream failed');
                },
            });
            flushBufferedTokens(assistantMessageId);

            if (!donePayload) {
                throw new Error('Chat stream ended unexpectedly');
            }

            const nextConversationId = donePayload?.conversationId || donePayload?.conversation?.id || null;
            if (nextConversationId) {
                setConversationId(nextConversationId);
            }

            if (Array.isArray(donePayload?.conversation?.messages)) {
                setMessages(mapServerMessages(donePayload.conversation.messages));
            } else {
                const finalReply = donePayload?.reply || streamedText || 'No response received.';
                setMessages((prev) =>
                    prev.map((item) =>
                        item.id === assistantMessageId
                            ? { ...item, content: finalReply }
                            : item,
                    ),
                );
            }
            setStreamingMessageId(null);
        } catch (error) {
            flushBufferedTokens(assistantMessageId);
            setMessages((prev) =>
                prev.map((item) =>
                    item.id === assistantMessageId
                        ? { ...item, content: `Unable to reach server: ${error.message}` }
                        : item,
                ),
            );
            setStreamingMessageId(null);
        } finally {
            if (streamRafRef.current) {
                cancelAnimationFrame(streamRafRef.current);
                streamRafRef.current = null;
            }
            streamTokenBufferRef.current = '';
            setIsLoading(false);
            loadConversations();
        }
    }, [conversationId, flushBufferedTokens, loadConversations, onLogout]);

    const handleNewChat = () => {
        setMessages([]);
        setConversationId(null);
    };

    const handleSelectChat = useCallback(async (id) => {
        if (!id || id === conversationId) {
            setSidebarOpen(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
                headers: authHeaders(),
            });
            const data = await response.json();
            if (response.status === 401) {
                clearAuthToken();
                onLogout?.();
                return;
            }
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to load conversation');
            }

            setConversationId(data.id || id);
            setMessages(mapServerMessages(data.messages || []));
        } catch (error) {
            console.error('Failed to load conversation', error);
        } finally {
            setSidebarOpen(false);
        }
    }, [conversationId, onLogout]);

    const handleDeleteChat = useCallback(async (id) => {
        if (!id) return;

        const confirmed = window.confirm('Delete this conversation?');
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
            const data = await response.json().catch(() => ({}));

            if (response.status === 401) {
                clearAuthToken();
                onLogout?.();
                return;
            }

            if (!response.ok) {
                throw new Error(data?.error || 'Failed to delete conversation');
            }

            setChatHistory((prev) => prev.filter((chat) => chat.id !== id));

            if (conversationId === id) {
                setConversationId(null);
                setMessages([]);
            }
        } catch (error) {
            console.error('Failed to delete conversation', error);
        }
    }, [conversationId, onLogout]);

    const handleLogout = () => {
        setMessages([]);
        setConversationId(null);
        setChatHistory([]);
        setSidebarOpen(false);
        onLogout?.();
    };

    return (<div className="flex h-screen bg-white relative">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (<div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)}/>)}

      {/* Sidebar - Hidden on mobile, visible on tablet and up */}
      <div className={`fixed md:static inset-y-0 left-0 w-64 bg-white transition-transform duration-300 ease-in-out z-50 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <ChatSidebar
          onNewChat={handleNewChat}
          onLogout={handleLogout}
          user={user}
          chatHistory={chatHistory}
          activeConversationId={conversationId}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header with Toggle */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Toggle sidebar" title="Toggle sidebar">
            {sidebarOpen ? (<X size={24} className="text-gray-700"/>) : (<Menu size={24} className="text-gray-700"/>)}
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-gray-900">CHAT A.I+</h1>
          </div>
        </div>

        <ChatArea
          messages={messages}
          user={user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          isLoading={isLoading}
          streamingMessageId={streamingMessageId}
        />
        <div className="sticky bottom-0 z-20">
          <ChatInput onSend={handleSendMessage} disabled={isLoading}/>
        </div>
      </div>
    </div>);
}
