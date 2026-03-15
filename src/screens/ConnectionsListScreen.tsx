import { useState, useEffect } from 'react';
import { Search, UserPlus, MessageSquare, X, Check } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useConnectionsStore } from '../stores/connectionsStore';
import { getOrCreateConversation } from '../lib/queries/messages';

const TABS = ['Connections', 'Requests', 'Sent'];

export default function ConnectionsListScreen({ 
  onNavigate, 
  onBack 
}: { 
  onNavigate: (screen: string, params?: any) => void, 
  onBack?: () => void 
}) {
  const [activeTab, setActiveTab] = useState('Connections');
  const { profile } = useAuthStore();
  const { accepted, pending, sent, fetchAll, respond, isLoading } = useConnectionsStore();

  useEffect(() => {
    if (profile?.id) {
      fetchAll(profile.id);
    }
  }, [profile?.id]);

  const handleRespond = async (e: React.MouseEvent, id: string, accept: boolean) => {
    e.stopPropagation();
    await respond(id, accept);
  };

  const handleMessage = async (e: React.MouseEvent, otherProfile: any) => {
    e.stopPropagation();
    if (!profile?.id || !otherProfile?.id) return;
    const convId = await getOrCreateConversation(profile.id, otherProfile.id);
    if (convId) {
      onNavigate('chat', { id: convId, participant: otherProfile });
    }
  };

  const renderContent = () => {
    if (isLoading) {
       return <div className="text-center py-12 text-sm font-bold text-gray-400">Loading connections...</div>;
    }

    if (activeTab === 'Connections') {
      if (accepted.length === 0) return <EmptyState type="connections" />;
      return accepted.map(conn => (
        <ConnectionCard 
          key={conn.id} 
          user={conn.other_profile} 
          type="connection" 
          onClick={() => onNavigate('playerProfile', { id: conn.other_profile.id })} 
          onMessage={(e) => handleMessage(e, conn.other_profile)}
        />
      ));
    }
    if (activeTab === 'Requests') {
      if (pending.length === 0) return <EmptyState type="requests" />;
      return pending.map(req => (
        <ConnectionCard 
          key={req.id} 
          user={req.other_profile} 
          type="request" 
          onClick={() => onNavigate('playerProfile', { id: req.other_profile.id })}
          onAccept={(e) => handleRespond(e, req.id, true)}
          onDecline={(e) => handleRespond(e, req.id, false)}
        />
      ));
    }
    if (activeTab === 'Sent') {
      if (sent.length === 0) return <EmptyState type="sent" />;
      return sent.map(req => (
        <ConnectionCard 
          key={req.id} 
          user={req.other_profile} 
          type="sent" 
          onClick={() => onNavigate('playerProfile', { id: req.other_profile.id })} 
        />
      ));
    }
  };

  return (
    <div className="min-h-full bg-[#FAFAFA] pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom)+100px)]">
      {/* Header */}
      <div className="px-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          {onBack && (
            <button 
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm hover:bg-gray-50 transition-colors shrink-0"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          )}
          <h1 className="font-display font-bold text-3xl text-gray-900 tracking-tight flex-1">My Network</h1>
          <button className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 shadow-sm hover:bg-gray-50 transition-colors shrink-0">
            <Search size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                activeTab === tab 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-5 space-y-3">
        {renderContent()}
      </div>
    </div>
  );
}

function ConnectionCard({ 
  user, 
  type, 
  onClick,
  onAccept,
  onDecline,
  onMessage
}: { 
  user: any, 
  type: 'connection' | 'request' | 'sent', 
  onClick: () => void,
  onAccept?: (e: React.MouseEvent) => void,
  onDecline?: (e: React.MouseEvent) => void,
  onMessage?: (e: React.MouseEvent) => void
}) {
  return (
    <div 
      onClick={onClick}
      className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 active:scale-[0.98] transition-transform cursor-pointer"
    >
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.full_name} className="w-14 h-14 rounded-full object-cover border border-gray-100 shrink-0 bg-white" />
      ) : (
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-xl shrink-0 border border-gray-100">
           {user.full_name[0]?.toUpperCase() ?? '?'}
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex flex-col justify-center h-full">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-bold text-gray-900 truncate">{user.full_name}</h3>
            {user.skill_level && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0">
                {user.skill_level}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 font-medium truncate">@{user.username}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {type === 'connection' && (
          <button 
            onClick={onMessage}
            className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200 active:scale-95"
          >
            <MessageSquare size={18} />
          </button>
        )}
        
        {type === 'request' && (
          <>
            <button 
              onClick={onDecline}
              className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
            >
              <X size={18} />
            </button>
            <button 
              onClick={onAccept}
              className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white hover:bg-gray-900 transition-colors shadow-md shadow-black/10"
            >
              <Check size={18} />
            </button>
          </>
        )}

        {type === 'sent' && (
          <button 
            onClick={(e) => { e.stopPropagation(); /* Cancel not strictly spec'd but could trigger decline/delete */ }}
            className="px-4 py-2 rounded-xl bg-gray-50 text-gray-400 text-xs font-bold transition-colors border border-gray-100 cursor-not-allowed"
          >
            Pending
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ type }: { type: string }) {
  const content = {
    connections: { icon: UserPlus, title: "No connections yet", desc: "Start connecting with players to build your network." },
    requests: { icon: UserPlus, title: "No pending requests", desc: "You don't have any incoming connection requests." },
    sent: { icon: UserPlus, title: "No sent requests", desc: "You haven't sent any connection requests recently." }
  }[type] || { icon: UserPlus, title: "Empty", desc: "Nothing to see here." };

  const Icon = content.icon;

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon size={24} className="text-gray-400" />
      </div>
      <h3 className="font-bold text-gray-900 text-lg mb-1">{content.title}</h3>
      <p className="text-sm text-gray-500">{content.desc}</p>
    </div>
  );
}
