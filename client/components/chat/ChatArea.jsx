import Message from './Message';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';

const themeAvatarClasses = {
    default: {
        welcome: 'from-indigo-100 to-purple-100 text-indigo-600',
        ai: 'from-indigo-500 to-purple-600',
    },
    ocean: {
        welcome: 'from-cyan-100 to-blue-100 text-blue-600',
        ai: 'from-cyan-500 to-blue-600',
    },
    forest: {
        welcome: 'from-emerald-100 to-green-100 text-green-700',
        ai: 'from-emerald-500 to-green-600',
    },
    sunset: {
        welcome: 'from-orange-100 to-red-100 text-orange-700',
        ai: 'from-orange-500 to-red-600',
    },
    midnight: {
        welcome: 'from-violet-100 to-indigo-100 text-indigo-700',
        ai: 'from-violet-600 to-indigo-700',
    },
};

export default function ChatArea({ messages, user, isLoading }) {
    const { theme } = useTheme();
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const avatarClass = themeAvatarClasses[theme] || themeAvatarClasses.default;

    return (<div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {messages.length === 0 ? (<div className="flex items-center justify-center h-full text-center py-12 sm:py-16">
            <div className="w-full">
              <div className={`w-12 sm:w-16 h-12 sm:h-16 bg-gradient-to-br ${avatarClass.welcome} rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center`}>
                <span className="text-xl sm:text-2xl font-bold">A</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-1 sm:mb-2 px-4">Start a new conversation</h2>
              <p className="text-sm sm:text-base text-gray-600 px-4">Ask me anything to get started</p>
            </div>
          </div>) : (<>
            {messages.map((message, index) => (<Message key={message.id} {...message} isLastMessage={index === messages.length - 1} user={user}/>))}
            {isLoading && (<div className="flex gap-3 mb-4">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarClass.ai} flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold`}>
                  A
                </div>
                <div className="bg-gray-100 rounded-lg rounded-bl-none px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>)}
            <div ref={messagesEndRef}/>
          </>)}
      </div>
    </div>);
}
