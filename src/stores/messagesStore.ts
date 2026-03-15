import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { fetchConversations, fetchMessages, sendMessage, markConversationAsRead, type Conversation, type Message } from '../lib/queries/messages';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface MessagesState {
  conversations: Conversation[];
  activeChatMessages: Message[];
  activeConversationId: string | null;
  isLoading: boolean;
  channel: RealtimeChannel | null;
  hasMoreMessages: boolean;
  isLoadingMore: boolean;

  fetchMyConversations: (userId: string) => Promise<void>;
  openConversation: (conversationId: string, userId: string) => Promise<void>;
  loadEarlierMessages: () => Promise<void>;
  closeConversation: () => void;
  unreadMessagesCount: () => number;
  sendChatMessage: (conversationId: string, senderId: string, content: string) => Promise<void>;
  reset: () => void;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  conversations: [],
  activeChatMessages: [],
  activeConversationId: null,
  isLoading: false,
  channel: null,
  hasMoreMessages: true,
  isLoadingMore: false,

  fetchMyConversations: async (userId: string) => {
    set({ isLoading: true });
    const convs = await fetchConversations(userId);
    set({ conversations: convs, isLoading: false });
  },

  openConversation: async (conversationId: string, userId: string) => {
    // 1. Pre-clear
    get().closeConversation();
    set({ activeConversationId: conversationId, isLoading: true, hasMoreMessages: true });

    // 2. Fetch latest 30 messages
    const history = await fetchMessages(conversationId, 30);
    set({ 
      activeChatMessages: history, 
      isLoading: false,
      hasMoreMessages: history.length === 30
    });

    // 3. Mark read
    const activeConv = get().conversations.find(c => c.id === conversationId);
    if (activeConv) {
      const isP1 = activeConv.participant1_id === userId;
      await markConversationAsRead(conversationId, userId, isP1);
      
      // Optimitically update the list so unread disappears
      set(state => ({
        conversations: state.conversations.map(c => {
          if (c.id === conversationId) {
            return {
              ...c,
              unread_count_p1: isP1 ? 0 : c.unread_count_p1,
              unread_count_p2: !isP1 ? 0 : c.unread_count_p2,
            };
          }
          return c;
        })
      }));
    }

    // 4. Setup Realtime Subscription for new messages in this conversation
    const channel = supabase
      .channel(`chat_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          set(state => {
            // Deduplicate — ignore if this exact ID already exists
            const alreadyExists = state.activeChatMessages.some(m => m.id === newMsg.id);
            if (alreadyExists) return state;
            return { activeChatMessages: [...state.activeChatMessages, newMsg] };
          });
        }
      )
      .subscribe();

    set({ channel });
  },

  loadEarlierMessages: async () => {
    const { activeConversationId, activeChatMessages, isLoadingMore, hasMoreMessages } = get();
    
    if (!activeConversationId || isLoadingMore || !hasMoreMessages) return;
    if (activeChatMessages.length === 0) return;

    set({ isLoadingMore: true });

    const oldestMessage = activeChatMessages[0];
    const olderMessages = await fetchMessages(activeConversationId, 30, oldestMessage.created_at);

    set(state => ({
      activeChatMessages: [...olderMessages, ...state.activeChatMessages],
      hasMoreMessages: olderMessages.length === 30,
      isLoadingMore: false
    }));
  },

  closeConversation: () => {
    const { channel } = get();
    if (channel) {
      supabase.removeChannel(channel);
    }
    set({ activeChatMessages: [], activeConversationId: null, channel: null });
  },

  unreadMessagesCount: () => {
    const state = get();
    const userId = (globalThis as any).__currentUserId; // Set by App.tsx on mount
    if (!userId) return 0;
    
    return state.conversations.reduce((total, conv) => {
      const isP1 = conv.participant1_id === userId;
      const unread = isP1 ? conv.unread_count_p1 : conv.unread_count_p2;
      return total + unread;
    }, 0);
  },

  sendChatMessage: async (conversationId: string, senderId: string, content: string) => {
    // Just fire the DB insert — the Realtime channel will receive the
    // INSERT event and append the confirmed message with its real server ID.
    // No optimistic update needed to avoid duplicates.
    await sendMessage(conversationId, senderId, content);
  },

  reset: () => {
    const { channel } = get();
    if (channel) {
      supabase.removeChannel(channel);
    }
    set({
      conversations: [],
      activeChatMessages: [],
      activeConversationId: null,
      channel: null,
      isLoading: false,
      hasMoreMessages: true,
      isLoadingMore: false
    });
  }
}));
