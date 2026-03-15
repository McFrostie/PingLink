import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, UserPlus, Trophy, MapPin, MessageSquare, Star } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { fetchNotifications, markAllNotificationsAsRead, type Notification } from '../lib/queries/notifications';

export default function Notifications({ onBack, onNavigate }: { onBack: () => void; onNavigate?: (notification: Notification) => void }) {
  const { profile } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    setIsLoading(true);
    fetchNotifications(profile.id).then(data => {
      setNotifications(data);
      setIsLoading(false);
      // Fire and forget: mark all as read automatically upon viewing
      markAllNotificationsAsRead(profile.id);
    });
  }, [profile?.id]);

  return (
    <div className="absolute inset-0 z-[100] bg-[#FAFAFA] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-white flex items-center justify-between shadow-sm shrink-0 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 border border-gray-100 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display font-bold text-xl text-gray-900">Notifications</h1>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {isLoading ? (
          <div className="text-center py-12 text-sm font-bold text-gray-400">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell size={24} className="text-gray-400" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-1">No notifications</h3>
            <p className="text-sm text-gray-500">You're all caught up.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notif => (
              <NotificationCard key={notif.id} notification={notif} onNavigate={onNavigate} onClose={onBack} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationCard({ notification, onNavigate, onClose }: { notification: Notification; onNavigate?: (notification: Notification) => void; onClose: () => void }) {
  const config = getNotificationConfig(notification);
  const Icon = config.icon;
  const isUnread = !notification.is_read;

  const handleClick = () => {
    if (onNavigate) {
      onNavigate(notification);
      onClose();
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`p-4 rounded-2xl border flex items-center gap-4 transition-colors ${onNavigate ? 'cursor-pointer hover:bg-gray-50' : ''} ${
      isUnread ? 'bg-white border-blue-100 shadow-sm' : 'bg-transparent border-gray-100 opacity-70 hover:opacity-100'
    }`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${config.bgClass}`}>
        <Icon size={20} className={config.iconClass} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
          {notification.title || config.text}
        </p>
        <p className="text-sm text-gray-600 mt-0.5">
          {notification.body || config.fallbackBody}
        </p>
        <p className="text-xs text-gray-400 font-medium mt-1">
          {new Date(notification.created_at).toLocaleDateString()}
        </p>
      </div>
      {isUnread && (
        <div className="w-2 h-2 rounded-full bg-ping shrink-0" />
      )}
    </div>
  );
}

function getNotificationConfig(notif: Notification) {
  switch (notif.type) {
    case 'connection_request':
      return {
        icon: UserPlus,
        bgClass: 'bg-blue-50',
        iconClass: 'text-blue-600',
        text: 'New connection request',
        fallbackBody: 'Someone wants to connect with you.'
      };
    case 'connection_accepted':
      return {
        icon: UserPlus,
        bgClass: 'bg-blue-50',
        iconClass: 'text-blue-600',
        text: 'Connection accepted',
        fallbackBody: 'Your connection request was accepted.'
      };
    case 'match_request':
      return {
        icon: Trophy,
        bgClass: 'bg-orange-50',
        iconClass: 'text-orange-600',
        text: 'Match request',
        fallbackBody: 'You were invited to a match.'
      };
    case 'match_confirmed':
      return {
        icon: Trophy,
        bgClass: 'bg-green-50',
        iconClass: 'text-green-600',
        text: 'Match confirmed',
        fallbackBody: 'A match has been confirmed.'
      };
    case 'match_cancelled':
      return {
        icon: Trophy,
        bgClass: 'bg-red-50',
        iconClass: 'text-red-600',
        text: 'Match cancelled',
        fallbackBody: 'A match was cancelled.'
      };
    case 'check_in':
      return {
        icon: MapPin,
        bgClass: 'bg-green-50',
        iconClass: 'text-green-600',
        text: 'Check-in update',
        fallbackBody: 'A player checked in at a venue.'
      };
    case 'message':
      return {
        icon: MessageSquare,
        bgClass: 'bg-blue-50',
        iconClass: 'text-blue-600',
        text: 'New message',
        fallbackBody: 'You received a new message.'
      };
    case 'venue_approved':
      return {
        icon: Star,
        bgClass: 'bg-yellow-50',
        iconClass: 'text-yellow-600',
        text: 'Venue approved',
        fallbackBody: 'A venue update is available.'
      };
    case 'achievement_earned':
      return {
        icon: Trophy,
        bgClass: 'bg-yellow-50',
        iconClass: 'text-yellow-600',
        text: 'Achievement earned',
        fallbackBody: 'You unlocked a new achievement.'
      };
    default:
      return {
        icon: Bell,
        bgClass: 'bg-gray-100',
        iconClass: 'text-gray-600',
        text: 'New notification',
        fallbackBody: 'Open to view details.'
      };
  }
}
