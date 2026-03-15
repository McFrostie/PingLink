import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useMessagesStore } from '../stores/messagesStore';
import { MessageCircle, PenLine } from 'lucide-react';

// Smart relative timestamp like WhatsApp
function formatInboxTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === today.getTime()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (msgDay.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }
  // Within this week — show day name
  const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ConversationSkeleton() {
  return (
    <div className="px-4 py-3.5 flex items-center gap-3.5 animate-pulse">
      <div className="w-12 h-12 rounded-full bg-gray-100 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex justify-between items-center gap-2">
          <div className="h-3.5 w-28 bg-gray-100 rounded-full" />
          <div className="h-3 w-10 bg-gray-100 rounded-full" />
        </div>
        <div className="h-3 w-44 bg-gray-100 rounded-full" />
      </div>
    </div>
  );
}

export default function MessagesScreen({ onNavigate }: { onNavigate: (screen: string, params?: any) => void }) {
  const { profile } = useAuthStore();
  const { conversations, fetchMyConversations, isLoading } = useMessagesStore();
  const [filter, setFilter] = useState<'all' | 'unread' | 'online'>('all');

  useEffect(() => {
    if (profile?.id) {
      fetchMyConversations(profile.id);
    }
  }, [profile?.id]);

  const unreadTotal = conversations.filter(conv => {
    const isP1 = conv.participant1_id === profile?.id;
    return (isP1 ? conv.unread_count_p1 : conv.unread_count_p2) > 0;
  }).length;

  const onlineCount = conversations.filter(conv => conv.other_profile?.is_online).length;

  const filtered = conversations.filter(conv => {
    if (filter === 'unread') {
      const isP1 = conv.participant1_id === profile?.id;
      return (isP1 ? conv.unread_count_p1 : conv.unread_count_p2) > 0;
    }
    if (filter === 'online') return conv.other_profile?.is_online;
    return true;
  });

  return (
    <div className="min-h-full bg-gray-50 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom)+100px)]">
      {/* Header */}
      <div className="px-5 mb-4 flex items-center justify-between">
        <h1 className="font-semibold text-2xl text-gray-900">Messages</h1>
        <button
          onClick={() => onNavigate('connectionsList')}
          className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-700 transition-colors hover:bg-gray-50 active:scale-95"
        >
          <PenLine size={18} />
        </button>
      </div>

      {/* Filter chips */}
      <div className="px-5 mb-5 flex gap-2">
        <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterChip label="Unread" count={unreadTotal} active={filter === 'unread'} onClick={() => setFilter('unread')} />
        <FilterChip label="Online" count={onlineCount} active={filter === 'online'} onClick={() => setFilter('online')} />
      </div>

      {/* List */}
      <div className="px-5">
        {isLoading && conversations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
            <ConversationSkeleton />
            <ConversationSkeleton />
            <ConversationSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={22} className="text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 text-base mb-1">
              {filter === 'all' ? 'No messages yet' : filter === 'unread' ? 'All caught up' : 'No one online'}
            </h3>
            <p className="text-sm text-gray-500 max-w-[220px] mx-auto leading-relaxed">
              {filter === 'all'
                ? 'Tap the compose button above to start a conversation.'
                : filter === 'unread'
                ? 'You have no unread messages right now.'
                : 'None of your contacts are online right now.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
            {filtered.map(conv => {
              const other = conv.other_profile;
              const isP1 = conv.participant1_id === profile?.id;
              const unreadCount = isP1 ? conv.unread_count_p1 : conv.unread_count_p2;
              const isUnread = unreadCount > 0;
              const isLastMine = conv.last_message_sender_id === profile?.id;
              const preview = conv.last_message_preview
                ? (isLastMine ? `You: ${conv.last_message_preview}` : conv.last_message_preview)
                : 'Start a conversation!';

              return (
                <div
                  key={conv.id}
                  onClick={() => onNavigate('chat', { id: conv.id, participant: other })}
                  className="px-4 py-3.5 flex items-center gap-3.5 active:bg-gray-50 transition-colors cursor-pointer"
                >
                  {/* Avatar with online dot only */}
                  <div className="relative shrink-0">
                    {other?.avatar_url ? (
                      <img src={other.avatar_url} alt={other.full_name} className="w-12 h-12 rounded-full object-cover bg-gray-100" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-lg">
                        {other?.full_name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    {other?.is_online && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2 mb-0.5">
                      <h3 className={`truncate text-[15px] ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
                        {other?.full_name ?? 'Unknown User'}
                      </h3>
                      <span className={`shrink-0 text-[11px] tabular-nums ${isUnread ? 'font-semibold text-gray-700' : 'text-gray-400'}`}>
                        {conv.last_message_at ? formatInboxTime(conv.last_message_at) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-[13px] truncate ${isUnread ? 'font-medium text-gray-700' : 'text-gray-500'}`}>
                        {preview}
                      </p>
                      {isUnread && (
                        <span className="shrink-0 min-w-[20px] h-5 bg-gray-900 text-white rounded-full flex items-center justify-center px-1.5 text-[10px] font-bold">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-colors border ${
        active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold leading-none ${
          active ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
        }`}>
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}

