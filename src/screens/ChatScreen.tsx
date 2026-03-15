import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '../stores/authStore';
import { useMessagesStore } from '../stores/messagesStore';

export default function ChatScreen({
  onBack,
  onNavigate,
  conversationId,
  participant
}: {
  onBack: () => void;
  onNavigate?: (screen: string, params?: any) => void;
  conversationId: string;
  participant: any;
}) {
  const { profile } = useAuthStore();
  const { 
    openConversation, 
    closeConversation, 
    loadEarlierMessages,
    sendChatMessage, 
    activeChatMessages, 
    isLoading,
    hasMoreMessages,
    isLoadingMore
  } = useMessagesStore();
  
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mount/Unmount logic
  useEffect(() => {
    if (profile?.id && conversationId) {
      openConversation(conversationId, profile.id);
    }
    return () => {
      closeConversation();
    };
  }, [conversationId, profile?.id]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatMessages]);

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`; // Max 120px
    }
  };

  const submitMessage = async () => {
    if (!inputText.trim() || !profile?.id || isSending) return;
    const messageToSend = inputText.trim();
    setInputText('');
    setIsSending(true);
    
    // Reset textarea height instantly
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }

    await sendChatMessage(conversationId, profile.id, messageToSend);
    setIsSending(false);
    // Realtime subscription will add the message — just ensure we're scrolled
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  };

  // Give a way to dismiss keyboard when clicking the message feed
  const dismissKeyboard = async () => {
    if (Capacitor.isNativePlatform()) {
      await Keyboard.hide().catch(() => {});
    }
    textareaRef.current?.blur();
  };

  return (
    <div className="absolute inset-0 z-[100] bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-lg flex items-center gap-4 shadow-sm shrink-0 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <button 
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 border border-gray-100 hover:bg-gray-100 transition-colors shrink-0 active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>
        <div 
          onClick={() => onNavigate && participant?.id && onNavigate('playerProfile', { id: participant.id })}
          className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-80 transition-opacity active:opacity-60 rounded-xl px-1 py-1 -ml-1"
        >
          {participant?.avatar_url ? (
            <img src={participant.avatar_url} alt={participant.full_name} className="w-10 h-10 rounded-full object-cover shrink-0 bg-gray-100 shadow-sm" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold shrink-0 border border-gray-200 shadow-sm">
              {participant?.full_name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-bold text-gray-900 truncate">{participant?.full_name || 'Chat'}</h1>
            <p className="text-xs text-gray-500 font-medium truncate tracking-tight">@{participant?.username || 'user'}</p>
          </div>
        </div>
      </div>

      {/* Messages Feed */}
      <div 
        className="flex-1 overflow-y-auto w-full bg-[#FAFAFA] p-5 space-y-4 no-scrollbar"
        onClick={dismissKeyboard}
      >
        {isLoading && activeChatMessages.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm font-bold">Loading messages...</div>
        ) : activeChatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center text-gray-400 px-8">
            <p className="font-bold mb-1 border border-gray-200 px-4 py-2 rounded-2xl bg-white shadow-sm text-sm">Say hello to {participant?.full_name?.split(' ')[0] || 'them'}!</p>
          </div>
        ) : (
          <>
            {hasMoreMessages && (
              <div className="flex justify-center pb-4">
                <button
                  onClick={loadEarlierMessages}
                  disabled={isLoadingMore}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-600 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isLoadingMore ? 'Loading...' : 'Load earlier messages'}
                </button>
              </div>
            )}
            {activeChatMessages.map((msg, idx) => {
            const isMe = msg.sender_id === profile?.id;
            const bubbleClasses = isMe
              ? 'bg-ping text-white rounded-2xl rounded-tr-sm shadow-[0_1px_2px_rgba(255,51,102,0.2)]'
              : 'bg-white border text-gray-900 border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] rounded-2xl rounded-tl-sm';
            const alignClasses = isMe ? 'justify-end' : 'justify-start';

            const msgDate = new Date(msg.created_at);
            const timeString = msgDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            
            // Logic for Date Dividers
            const prevMsg = activeChatMessages[idx - 1];
            let showDateDivider = false;
            let dateDividerText = '';

            if (!prevMsg) {
              showDateDivider = true;
            } else {
              const prevDate = new Date(prevMsg.created_at);
              if (
                msgDate.getDate() !== prevDate.getDate() ||
                msgDate.getMonth() !== prevDate.getMonth() ||
                msgDate.getFullYear() !== prevDate.getFullYear()
              ) {
                showDateDivider = true;
              }
            }

            if (showDateDivider) {
              const today = new Date();
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);

              if (msgDate.toDateString() === today.toDateString()) {
                dateDividerText = 'Today';
              } else if (msgDate.toDateString() === yesterday.toDateString()) {
                dateDividerText = 'Yesterday';
              } else {
                dateDividerText = msgDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: msgDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
              }
            }

            return (
              <div key={msg.id} className="w-full flex flex-col relative group">
                {showDateDivider && (
                  <div className="flex justify-center my-4">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {dateDividerText}
                    </span>
                  </div>
                )}
                
                <div className={`w-full flex ${alignClasses} group-first:mt-2`}>
                  <div className={`relative px-4 pt-2.5 pb-[1.125rem] max-w-[80%] text-[15px] leading-relaxed whitespace-pre-wrap font-medium inline-block min-w-[70px] ${bubbleClasses}`}>
                    {msg.content}
                    {/* Inline Timestamp */}
                    <span 
                      className={`absolute bottom-1 right-2.5 text-[10px] font-bold leading-none select-none
                        ${isMe ? 'text-white/80' : 'text-gray-400'}
                      `}
                    >
                      {timeString}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div className="shrink-0 bg-white border-t border-gray-100 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] px-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="relative flex items-end gap-2 max-w-lg mx-auto">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-ping/20 focus:border-ping transition-all font-medium text-gray-900 resize-none no-scrollbar leading-snug"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={submitMessage}
            disabled={!inputText.trim() || isSending}
            className={`shrink-0 w-11 h-11 mb-[2px] rounded-full bg-ping flex items-center justify-center text-white transition-all active:scale-95 shadow-sm
              disabled:opacity-40 disabled:bg-gray-200 disabled:text-gray-400
              ${isSending ? 'animate-pulse' : ''}
            `}
          >
            <Send size={18} className="ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
