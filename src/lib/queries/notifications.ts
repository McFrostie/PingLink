import { supabase } from '../supabase';

export type NotificationType =
  | 'connection_request'
  | 'connection_accepted'
  | 'match_request'
  | 'match_confirmed'
  | 'match_cancelled'
  | 'message'
  | 'venue_approved'
  | 'achievement_earned'
  | 'check_in';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any>;
  related_user_id: string | null;
  related_match_id: string | null;
  related_venue_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationTarget {
  screen: 'playerProfile' | 'matchDetail' | 'venueDetail' | 'chat' | 'profile';
  params?: Record<string, any>;
}

export function getNotificationTarget(notification: Notification): NotificationTarget | null {
  switch (notification.type) {
    case 'connection_request':
    case 'connection_accepted': {
      const userId = notification.related_user_id ?? notification.data?.requester_id ?? notification.data?.addressee_id ?? null;
      return userId ? { screen: 'playerProfile', params: { id: userId } } : null;
    }
    case 'match_request':
    case 'match_confirmed':
    case 'match_cancelled': {
      const matchId = notification.related_match_id ?? notification.data?.match_id ?? null;
      return matchId ? { screen: 'matchDetail', params: { id: matchId } } : null;
    }
    case 'venue_approved':
    case 'check_in': {
      const venueId = notification.related_venue_id ?? notification.data?.venue_id ?? null;
      return venueId ? { screen: 'venueDetail', params: { id: venueId } } : null;
    }
    case 'message': {
      const conversationId = notification.data?.conversation_id ?? null;
      return conversationId ? { screen: 'chat', params: { id: conversationId } } : null;
    }
    case 'achievement_earned':
      return { screen: 'profile' };
    default:
      return null;
  }
}

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, body, data, related_user_id, related_match_id, related_venue_id, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Notification[];
}

export async function markNotificationAsRead(notificationId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  return !error;
}

export async function markAllNotificationsAsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return !error;
}
