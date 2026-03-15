import { supabase } from '../supabase';

export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface Connection {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
  other_profile: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string | null;
    skill_level: string | null;
    city: string | null;
  };
}

export async function fetchConnections(userId: string): Promise<Connection[]> {
  const { data, error } = await supabase
    .from('connections')
    .select(`
      id, requester_id, addressee_id, status, created_at,
      requester:profiles!connections_requester_id_fkey(id, full_name, username, avatar_url, skill_level, city),
      addressee:profiles!connections_addressee_id_fkey(id, full_name, username, avatar_url, skill_level, city)
    `)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error || !data) return [];
  return (data as any[]).map((row) => ({
    id: row.id,
    requester_id: row.requester_id,
    addressee_id: row.addressee_id,
    status: row.status as ConnectionStatus,
    created_at: row.created_at,
    other_profile: row.requester_id === userId ? row.addressee : row.requester,
  }));
}

export async function fetchPendingRequests(userId: string) {
  // Incoming: addressee = me, status = pending
  const { data, error } = await supabase
    .from('connections')
    .select(`
      id, requester_id, created_at,
      requester:profiles!connections_requester_id_fkey(id, full_name, username, avatar_url, skill_level, city)
    `)
    .eq('addressee_id', userId)
    .eq('status', 'pending');
    
  if (error || !data) return [];
  return (data as any[]).map((row) => ({ ...row, other_profile: row.requester }));
}

export async function fetchSentRequests(userId: string) {
  const { data, error } = await supabase
    .from('connections')
    .select(`
      id, addressee_id, created_at,
      addressee:profiles!connections_addressee_id_fkey(id, full_name, username, avatar_url, skill_level, city)
    `)
    .eq('requester_id', userId)
    .eq('status', 'pending');
    
  if (error || !data) return [];
  return (data as any[]).map((row) => ({ ...row, other_profile: row.addressee }));
}

export async function sendConnectionRequest(requesterId: string, addresseeId: string) {
  // Check if a connection already exists to prevent duplicate requests/errors
  const { data: existing } = await supabase
    .from('connections')
    .select('id, status')
    .or(`and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`)
    .single();

  if (existing) {
     if (existing.status === 'pending') return false; // Already pending
     if (existing.status === 'accepted') return false; // Already connected
     // If declined, maybe we want to update it to pending again, but simple insert might fail on constraint.
     // For now, if it exists but declined/blocked, simply update status to pending.
     const { error: updateErr } = await supabase
       .from('connections')
       .update({ status: 'pending', requester_id: requesterId, addressee_id: addresseeId })
       .eq('id', existing.id);
     return !updateErr;
  }

  const { error } = await supabase
    .from('connections')
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' });
  return !error;
}

export async function respondToRequest(connectionId: string, accept: boolean) {
  const { error } = await supabase
    .from('connections')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', connectionId);
  return !error;
}
