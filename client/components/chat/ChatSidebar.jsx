import { Plus, MessageCircle, Search, Trash2 } from 'lucide-react';
import ThemedButton from './ThemedButton';
import SettingsDropdown from './SettingsDropdown';
import { useTheme } from '@/components/providers/ThemeProvider';

const themeUserAvatarClasses = {
  default: 'from-indigo-400 to-purple-500',
  ocean: 'from-cyan-400 to-blue-500',
  forest: 'from-emerald-500 to-green-600',
  sunset: 'from-orange-400 to-red-500',
  midnight: 'from-violet-500 to-indigo-600',
};

function toDateKey(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return 'earlier';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfInput = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((startOfToday - startOfInput) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays <= 7) return 'last7';
  return 'earlier';
}

export default function ChatSidebar({
  onNewChat,
  onLogout,
  user,
  chatHistory = [],
  activeConversationId,
  onSelectChat,
  onDeleteChat,
}) {
    const { theme } = useTheme();
    const userAvatarClass = themeUserAvatarClasses[theme] || themeUserAvatarClasses.default;
    const groupedHistory = chatHistory.reduce((acc, chat) => {
      const bucket = toDateKey(chat.updatedAt || chat.createdAt);
      acc[bucket].push(chat);
      return acc;
    }, { today: [], last7: [], earlier: [] });

    return (<aside className="w-full h-screen bg-white border-r border-gray-200 flex flex-col overflow-visible">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-gray-200 flex-shrink-0">
        <div className="text-base md:text-lg font-bold text-black mb-3 md:mb-4">CHAT A.I+</div>
        <ThemedButton onClick={onNewChat}>
          <Plus size={16} className="md:w-5 md:h-5"/>
          <span>New chat</span>
        </ThemedButton>
      </div>

      {/* Search */}
      <div className="px-3 md:px-4 py-2 md:py-3 border-b border-gray-200 flex-shrink-0">
        <div className="relative">
          <Search size={14} className="md:w-4 md:h-4 absolute left-2 top-2.5 text-gray-400"/>
          <input type="text" placeholder="Search chats" className="w-full pl-8 pr-3 py-2 text-xs md:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"/>
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-1.5 md:p-2">
        <div className="mb-3 md:mb-4">
          <div className="text-xs uppercase text-gray-500 font-semibold px-3 py-2">Today</div>
          <div className="space-y-0.5">
            {groupedHistory.today.map((chat) => (
              <ChatHistoryItem
                key={chat.id}
                title={chat.title}
                isActive={activeConversationId === chat.id}
                onClick={() => onSelectChat?.(chat.id)}
                onDelete={() => onDeleteChat?.(chat.id)}
              />
            ))}
          </div>
        </div>

        <div className="mb-3 md:mb-4">
          <div className="text-xs uppercase text-gray-500 font-semibold px-3 py-2">Last 7 Days</div>
          <div className="space-y-0.5">
            {groupedHistory.last7.map((chat) => (
              <ChatHistoryItem
                key={chat.id}
                title={chat.title}
                isActive={activeConversationId === chat.id}
                onClick={() => onSelectChat?.(chat.id)}
                onDelete={() => onDeleteChat?.(chat.id)}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase text-gray-500 font-semibold px-3 py-2">Earlier</div>
          <div className="space-y-0.5">
            {groupedHistory.earlier.map((chat) => (
              <ChatHistoryItem
                key={chat.id}
                title={chat.title}
                isActive={activeConversationId === chat.id}
                onClick={() => onSelectChat?.(chat.id)}
                onDelete={() => onDeleteChat?.(chat.id)}
              />
            ))}
            {chatHistory.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">No chats yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Footer - Settings & Profile */}
      <div className="border-t border-gray-200 p-3 md:p-4 space-y-2 md:space-y-3 flex-shrink-0">
        <SettingsDropdown onLogout={onLogout}/>

        <div className="flex items-center gap-3 px-3 py-2">
          <div className={`w-8 h-8 flex items-center justify-center bg-gradient-to-br ${userAvatarClass} rounded-full flex-shrink-0`}>
            <span className="text-white text-md">{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs md:text-sm font-medium text-gray-900 truncate">{user?.name || "User"}</div>
            <div className="text-xs text-gray-500">User</div>
          </div>
        </div>
      </div>
    </aside>);
}
function ChatHistoryItem({ title, onClick, onDelete, isActive }) {
    return (<div className={`w-full text-left cursor-pointer px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm text-gray-700 transition-colors truncate flex items-center gap-2 group ${isActive ? 'bg-gray-100' : 'hover:bg-gray-100'}`}>
      <button onClick={onClick} className="flex-1 min-w-0 flex items-center gap-2 text-left">
        <MessageCircle size={14} className="md:w-4 md:h-4 text-gray-400 flex-shrink-0 group-hover:text-gray-500"/>
        <span className="truncate cursor-pointer">{title}</span>
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete?.();
        }}
        className="opacity-0 cursor-pointer group-hover:opacity-100 p-1 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
        aria-label="Delete chat"
        title="Delete chat"
      >
        <Trash2 size={14} className="md:w-4 md:h-4"/>
      </button>
    </div>);
}
