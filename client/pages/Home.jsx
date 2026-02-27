import { useState, useCallback, useEffect } from 'react';
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

export default function Home({ user, onLogout }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [conversationId, setConversationId] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

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

    
    

    const handleSendMessage = useCallback(async (message) => {
        const userMessage = createUiMessage('user', message);
        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    ...authHeaders(),
                },
                body: JSON.stringify({
                    conversationId,
                    message,
                }),
            });

            const data = await response.json();
            if (response.status === 401) {
                clearAuthToken();
                onLogout?.();
                return;
            }
            if (!response.ok) {
                throw new Error(data?.details || data?.error || 'Failed to send message');
            }

            const nextConversationId = data?.conversationId || data?.conversation?.id || null;
            if (nextConversationId) {
                setConversationId(nextConversationId);
            }

            if (Array.isArray(data?.conversation?.messages)) {
                setMessages(mapServerMessages(data.conversation.messages));
            } else {
                setMessages((prev) => [...prev, createUiMessage('assistant', data.reply || 'No response received.')]);
            }
        } catch (error) {
            setMessages((prev) => [
                ...prev,
                createUiMessage('assistant', `Unable to reach server: ${error.message}`),
            ]);
        } finally {
            setIsLoading(false);
            loadConversations();
        }
    }, [conversationId, loadConversations, onLogout]);

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

        <ChatArea messages={messages} user={user?.name ? user.name.charAt(0).toUpperCase() : 'U'} isLoading={isLoading}/>
        <div className="sticky bottom-0 z-20">
          <ChatInput onSend={handleSendMessage} disabled={isLoading}/>
        </div>
      </div>
    </div>);
}
