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



export default function Home({ user, onLogout }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [conversationId, setConversationId] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSelectingChat, setIsSelectingChat] = useState(false);
    const latestSelectionRef = useRef(null);
    const conversationCacheRef = useRef(new Map());
    const selectAbortRef = useRef(null);

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

    // ─── handleSendMessage ────────────────────────────────────────────────────
    const handleSendMessage = useCallback(async (message) => {
        const userMessage = createUiMessage('user', message);
        const assistantMessageId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-assistant`;

        // Add user message + assistant placeholder
        setMessages((prev) => [
            ...prev,
            userMessage,
            { id: assistantMessageId, role: 'assistant', content: '', createdAt: new Date().toISOString() },
        ]);
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ conversationId, message }),
            });

            if (response.status === 401) { clearAuthToken(); onLogout?.(); return; }
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.details || data?.error || 'Failed to send message');
            }

            const data = await response.json();
            const nextConversationId = data?.conversationId || data?.conversation?.id || null;
            if (nextConversationId) setConversationId(String(nextConversationId));

            const finalReply = data?.reply || 'No response received.';
            const serverConversation = data?.conversation;

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

            const summarySource = serverConversation || {};
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

        } catch (error) {
            setMessages((prev) =>
                prev.map((item) =>
                    item.id === assistantMessageId
                        ? { ...item, content: `Unable to reach server: ${error.message}` }
                        : item,
                ),
            );
        } finally {
            setIsLoading(false);
        }
    }, [conversationId, onLogout]);

    // ─── Other handlers ───────────────────────────────────────────────────────
    const handleNewChat = useCallback(() => {
        if (selectAbortRef.current) {
            selectAbortRef.current.abort();
            selectAbortRef.current = null;
        }
        setIsSelectingChat(false);
        latestSelectionRef.current = null;
        setMessages([]);
        setConversationId(null);
        setIsLoading(false);
    }, []);

    const handleSelectChat = useCallback(async (id) => {
        if (!id) { setSidebarOpen(false); return; }
        
        // If clicking the same chat that's already active, just close sidebar
        if (conversationId === id && !isSelectingChat) { 
            setSidebarOpen(false); 
            return; 
        }

        setSidebarOpen(false);
        setIsSelectingChat(true);
        latestSelectionRef.current = id;
        setConversationId(id);
        setIsLoading(false);

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
        setMessages([]);
        setConversationId(null);
        setChatHistory([]);
        setSidebarOpen(false);
        onLogout?.();
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
                />
                <div className="sticky bottom-0 z-20">
                    <ChatInput onSend={handleSendMessage} disabled={isLoading} />
                </div>
            </div>
        </div>
    );
}
