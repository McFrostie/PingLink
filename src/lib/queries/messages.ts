import { supabase } from '../supabase';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant1_id: string;
  participant2_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender_id: string | null;
  unread_count_p1: number;
  unread_count_p2: number;
  created_at: string;
  other_profile?: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string | null;
    skill_level: string | null;
    is_online: boolean;
    city: string | null;
  };
}

export async function getOrCreateConversation(userId: string, otherId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    user_a: userId,
    user_b: otherId
  });
  
  if (error || !data) {
    console.error("Error get_or_create_conversation:", error);
    return null;
  }
  return data;
}

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      p1:participant1_id(id, full_name, username, avatar_url, skill_level, is_online, city),
      p2:participant2_id(id, full_name, username, avatar_url, skill_level, is_online, city)
    `)
    .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error || !data) return [];

  // Map to figure out who the "other" person is easily
  return data.map((conv: any) => {
    const isP1 = conv.participant1_id === userId;
    return {
      ...conv,
      other_profile: isP1 ? conv.p2 : conv.p1
    };
  }) as Conversation[];
}

export async function fetchMessages(conversationId: string, limit?: number, before?: string): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false }); // Reverse chronological for pagination

  if (limit) {
    query = query.limit(limit);
  }

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;

  if (error || !data) return [];
  
  // Return in chronological order for display
  return (data as Message[]).reverse();
}

export async function sendMessage(conversationId: string, senderId: string, content: string): Promise<boolean> {
  const { error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
    });
    
  return !error;
}

export async function markConversationAsRead(conversationId: string, userId: string, isParticipant1: boolean) {
  const updatePayload = isParticipant1 ? { unread_count_p1: 0 } : { unread_count_p2: 0 };
  
  await supabase
    .from('conversations')
    .update(updatePayload)
    .eq('id', conversationId);
}
