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

function toHistoryItem(chat) {
    return {
        id: String(chat.id || chat._id || ''),
        title: chat.title || 'New conversation',
        updatedAt: chat.updatedAt || chat.createdAt || new Date().toISOString(),
        createdAt: chat.createdAt || chat.updatedAt || new Date().toISOString(),
    };
}

async function consumeSseStream(response, handlers) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Streaming response body is not available');

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

            const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data: '));
            if (!dataLine) continue;

            let payload;
            try {
                payload = JSON.parse(dataLine.slice(6));
            } catch {
                continue;
            }

            if (payload?.type === 'token') { handlers.onToken?.(payload.token || ''); continue; }
            if (payload?.type === 'reset') { handlers.onReset?.(); continue; }
            if (payload?.type === 'done')  { handlers.onDone?.(payload); continue; }
            if (payload?.type === 'error') { handlers.onError?.(payload); }
        }
    }
}

export default function Home({ user, onLogout }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [conversationId, setConversationId] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSelectingChat, setIsSelectingChat] = useState(false);
    const [streamingMessageId, setStreamingMessageId] = useState(null);
    const [streamingContent, setStreamingContent] = useState('');
    const latestSelectionRef = useRef(null);
    const conversationCacheRef = useRef(new Map());
    const selectAbortRef = useRef(null);

    // ─── Streaming refs ──────────────────────────────────────────────────────
    // We write tokens into a ref (zero re-renders) and push to the DOM
    // via a single rAF loop. This gives butter-smooth output without
    // hammering React's reconciler on every token.
    const streamingIdRef       = useRef(null);   // mirrors streamingMessageId without closure stale
    const accumulatedRef       = useRef('');      // full streamed text so far
    const pendingChunkRef      = useRef('');      // tokens queued since last rAF flush
    const rafRef               = useRef(null);    // rAF handle

    // ─── Load conversations ───────────────────────────────────────────────────
    const loadConversations = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/conversations`, { headers: authHeaders() });
            if (response.status === 401) { clearAuthToken(); onLogout?.(); return; }
            if (!response.ok) return;
            const data = await response.json();
            if (!Array.isArray(data)) return;

            const nextHistory = [];
            for (const chat of data) {
                const summary = toHistoryItem(chat);
                if (!summary.id) continue;

                if (Array.isArray(chat.messages)) {
                    conversationCacheRef.current.set(summary.id, mapServerMessages(chat.messages));
                }

                nextHistory.push(summary);
            }

            setChatHistory(nextHistory);
        } catch (error) {
            console.error('Failed to load conversations', error);
        }
    }, [onLogout]);

    useEffect(() => { loadConversations(); }, [loadConversations]);

    // ─── rAF flush loop ───────────────────────────────────────────────────────
    // Flush pending streamed chunks in one React update per frame.
    const scheduleFlush = useCallback(() => {
        if (rafRef.current) return; // already scheduled
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const chunk = pendingChunkRef.current;
            if (!chunk) return;
            pendingChunkRef.current = '';
            accumulatedRef.current += chunk;
            setStreamingContent(accumulatedRef.current);
        });
    }, []);

    // Cleanup rAF and in-flight selection request on unmount
    useEffect(() => () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (selectAbortRef.current) selectAbortRef.current.abort();
    }, []);

    // ─── handleSendMessage ────────────────────────────────────────────────────
    const handleSendMessage = useCallback(async (message) => {
        const assistantMessageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-assistant`;
        const userMessage = createUiMessage('user', message);

        // Add user message + an assistant placeholder with empty content.
        setMessages((prev) => [
            ...prev,
            userMessage,
            { id: assistantMessageId, role: 'assistant', content: '', createdAt: new Date().toISOString() },
        ]);
        setIsLoading(true);
        setStreamingMessageId(assistantMessageId);
        setStreamingContent('');

        // Reset streaming state
        streamingIdRef.current   = assistantMessageId;
        accumulatedRef.current   = '';
        pendingChunkRef.current  = '';

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat?stream=1`, {
                method: 'POST',
                headers: { ...authHeaders({ Accept: 'text/event-stream' }) },
                body: JSON.stringify({ conversationId, message }),
            });

            if (response.status === 401) { clearAuthToken(); onLogout?.(); return; }
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.details || data?.error || 'Failed to send message');
            }

            let donePayload = null;

            await consumeSseStream(response, {
                onToken: (token) => {
                    // Queue token and schedule a DOM flush — no setState
                    pendingChunkRef.current += token;
                    scheduleFlush();
                },
                onReset: () => {
                    accumulatedRef.current = '';
                    pendingChunkRef.current = '';
                    setStreamingContent('');
                },
                onDone: (payload) => { donePayload = payload; },
                onError: (payload) => { throw new Error(payload?.details || payload?.error || 'Stream failed'); },
            });

            // Flush any remaining tokens synchronously before committing to React state
            if (pendingChunkRef.current) {
                accumulatedRef.current += pendingChunkRef.current;
                pendingChunkRef.current = '';
            }
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            setStreamingContent(accumulatedRef.current);

            if (!donePayload) throw new Error('Chat stream ended unexpectedly');

            const nextConversationId = donePayload?.conversationId || donePayload?.conversation?.id || null;
            if (nextConversationId) setConversationId(String(nextConversationId));

            const finalReply = donePayload?.reply || accumulatedRef.current || 'No response received.';
            const serverConversation = donePayload?.conversation;
            if (Array.isArray(serverConversation?.messages)) {
                const mappedMessages = mapServerMessages(serverConversation.messages);
                setMessages(mappedMessages);
                if (serverConversation.id) {
                    conversationCacheRef.current.set(String(serverConversation.id), mappedMessages);
                }
            } else {
                setMessages((prev) =>
                    prev.map((item) =>
                        item.id === assistantMessageId ? { ...item, content: finalReply } : item,
                    ),
                );
            }

            const summarySource = donePayload?.conversation || {};
            const summary = toHistoryItem({
                id: String(summarySource.id || nextConversationId || ''),
                title: summarySource.title,
                updatedAt: summarySource.updatedAt || new Date().toISOString(),
                createdAt: summarySource.createdAt || new Date().toISOString(),
            });
            if (summary.id) {
                setChatHistory((prev) => {
                    const rest = prev.filter((item) => item.id !== summary.id);
                    return [summary, ...rest];
                });
            }

            setStreamingMessageId(null);
            streamingIdRef.current = null;
            setStreamingContent('');

        } catch (error) {
            // On error, commit whatever was streamed so the user doesn't lose it
            const partial = accumulatedRef.current || streamingContent || '';
            setMessages((prev) =>
                prev.map((item) =>
                    item.id === assistantMessageId
                        ? { ...item, content: partial || `Unable to reach server: ${error.message}` }
                        : item,
                ),
            );
            setStreamingMessageId(null);
            streamingIdRef.current = null;
            setStreamingContent('');
        } finally {
            if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
            accumulatedRef.current  = '';
            pendingChunkRef.current = '';
            setStreamingContent('');
            setIsLoading(false);
        }
    }, [conversationId, scheduleFlush, onLogout, streamingContent]);

    // ─── Other handlers ───────────────────────────────────────────────────────
    const handleNewChat = useCallback(() => {
        // Reset any in-progress streaming
        setStreamingMessageId(null);
        streamingIdRef.current = null;
        accumulatedRef.current = '';
        setStreamingContent('');
        setIsLoading(false);
        if (selectAbortRef.current) {
            selectAbortRef.current.abort();
            selectAbortRef.current = null;
        }
        setIsSelectingChat(false);
        latestSelectionRef.current = null;
        setMessages([]);
        setConversationId(null);
    }, []);

    const handleSelectChat = useCallback(async (id) => {
        if (!id) { setSidebarOpen(false); return; }
        
        // If clicking the same chat that's already active, just close sidebar
        if (conversationId === id && !isSelectingChat) { 
            setSidebarOpen(false); 
            return; 
        }

        // Reset any in-progress streaming immediately
        setStreamingMessageId(null);
        streamingIdRef.current = null;
        accumulatedRef.current = '';
        setStreamingContent('');
        setIsLoading(false);

        setSidebarOpen(false);
        setIsSelectingChat(true);
        latestSelectionRef.current = id;
        setConversationId(id);

        // Render from local cache immediately for snappy UX.
        const cachedMessages = conversationCacheRef.current.get(id);
        if (Array.isArray(cachedMessages) && cachedMessages.length > 0) {
            setMessages(cachedMessages);
        } else {
            setMessages([]);
        }

        if (selectAbortRef.current) {
            selectAbortRef.current.abort();
        }
        const controller = new AbortController();
        selectAbortRef.current = controller;

        try {
            const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
                headers: authHeaders(),
                signal: controller.signal,
            });
            const data = await response.json();
            if (response.status === 401) { clearAuthToken(); onLogout?.(); return; }
            if (!response.ok) throw new Error(data?.error || 'Failed to load conversation');

            // Ignore stale responses when user switches chats quickly.
            if (latestSelectionRef.current !== id) return;

            const nextId = String(data.id || id);
            const mappedMessages = mapServerMessages(data.messages || []);
            setConversationId(nextId);
            setMessages(mappedMessages);
            conversationCacheRef.current.set(nextId, mappedMessages);
        } catch (error) {
            if (error?.name === 'AbortError') return;
            console.error('Failed to load conversation', error);
            // On error, keep cached messages if available
        } finally {
            // Only clear selecting state if this is still the current selection
            if (latestSelectionRef.current === id) {
                setIsSelectingChat(false);
            }
        }
    }, [onLogout, isSelectingChat, conversationId]);

    const handleDeleteChat = useCallback(async (id) => {
        if (!id) return;
        if (!window.confirm('Delete this conversation?')) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
                method: 'DELETE', headers: authHeaders(),
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 401) { clearAuthToken(); onLogout?.(); return; }
            if (!response.ok) throw new Error(data?.error || 'Failed to delete conversation');
            setChatHistory((prev) => prev.filter((chat) => chat.id !== id));
            conversationCacheRef.current.delete(id);
            if (conversationId === id) { setConversationId(null); setMessages([]); }
        } catch (error) {
            console.error('Failed to delete conversation', error);
        }
    }, [conversationId, onLogout]);

    const handleLogout = () => {
        if (selectAbortRef.current) {
            selectAbortRef.current.abort();
            selectAbortRef.current = null;
        }
        conversationCacheRef.current.clear();
        latestSelectionRef.current = null;
        setMessages([]); setConversationId(null); setChatHistory([]); setSidebarOpen(false); onLogout?.();
    };

    return (
        <div className="flex h-screen bg-white relative">
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
            )}

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

            <div className="flex-1 flex flex-col min-w-0">
                <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Toggle sidebar">
                        {sidebarOpen ? <X size={24} className="text-gray-700" /> : <Menu size={24} className="text-gray-700" />}
                    </button>
                    <div className="flex-1">
                        <h1 className="text-sm font-semibold text-gray-900">CHAT A.I+</h1>
                    </div>
                </div>

                <ChatArea
                    messages={messages}
                    user={user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    isLoading={isLoading}
                    isSelectingChat={isSelectingChat}
                    streamingMessageId={streamingMessageId}
                    streamingContent={streamingContent}
                />
                <div className="sticky bottom-0 z-20">
                    <ChatInput onSend={handleSendMessage} disabled={isLoading} />
                </div>
            </div>
        </div>
    );
}
