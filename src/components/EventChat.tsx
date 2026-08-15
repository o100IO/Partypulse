import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, Pin, Trash2, Loader2, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  event_id: string;
  user_id: string | null;
  guest_name: string;
  message: string;
  is_pinned: boolean;
  created_at: string;
  _optimistic?: boolean;
}

interface EventChatProps {
  eventId: string;
  userId: string | null;
  displayName: string;
  isModerator?: boolean;
  /** @deprecated Use isModerator instead */
  isDJ?: boolean;
  djId?: string;
  venueOwnerId?: string;
  onUnreadCount?: (count: number) => void;
}

export function EventChat({ eventId, userId, displayName, isModerator, isDJ, djId, venueOwnerId, onUnreadCount }: EventChatProps) {
  const canModerate = isModerator ?? isDJ ?? false;
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const unreadRef = useRef(0);
  const isMountedRef = useRef(true);

  // Check if user is near bottom of scroll
  const checkNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 80;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (isNearBottomRef.current && unreadRef.current > 0) {
      unreadRef.current = 0;
      onUnreadCount?.(0);
    }
  }, [onUnreadCount]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('event_chat_messages')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (isMountedRef.current) {
        setMessages((data as ChatMessage[]) || []);
        setTimeout(() => scrollToBottom(false), 50);
      }
    };
    fetchMessages();
    return () => { isMountedRef.current = false; };
  }, [eventId, scrollToBottom]);

  // True realtime — handle INSERT/UPDATE/DELETE individually
  useEffect(() => {
    const channel = supabase
      .channel(`chat-rt-${eventId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'event_chat_messages',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        setMessages(prev => {
          // Replace optimistic message if it matches
          const withoutOptimistic = prev.filter(m =>
            !(m._optimistic && m.user_id === newMsg.user_id && m.message === newMsg.message)
          );
          // Avoid duplicates
          if (withoutOptimistic.some(m => m.id === newMsg.id)) return withoutOptimistic;
          return [...withoutOptimistic, newMsg];
        });
        // Track unread if not near bottom and not own message
        if (!isNearBottomRef.current && newMsg.user_id !== userId) {
          unreadRef.current += 1;
          onUnreadCount?.(unreadRef.current);
        } else {
          setTimeout(() => scrollToBottom(), 50);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'event_chat_messages',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        const updated = payload.new as ChatMessage;
        setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'event_chat_messages',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        const deletedId = (payload.old as { id: string }).id;
        setMessages(prev => prev.filter(m => m.id !== deletedId));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, userId, onUnreadCount, scrollToBottom]);

  // Auto-scroll when messages change and near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      setTimeout(() => scrollToBottom(), 50);
    }
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text) return;

    // Optimistic insert
    const optimisticMsg: ChatMessage = {
      id: `opt-${Date.now()}`,
      event_id: eventId,
      user_id: userId,
      guest_name: displayName || 'Anonymous',
      message: text,
      is_pinned: false,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');
    isNearBottomRef.current = true;
    setTimeout(() => scrollToBottom(), 20);

    setSending(true);
    try {
      const { error } = await supabase.from('event_chat_messages').insert({
        event_id: eventId,
        user_id: userId,
        guest_name: displayName || 'Anonymous',
        message: text,
      });
      if (error) {
        // Roll back optimistic
        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        throw error;
      }
    } catch {
      toast({ variant: 'destructive', title: 'Failed to send message' });
    } finally {
      setSending(false);
    }
  };

  const togglePin = async (id: string, currentlyPinned: boolean) => {
    // Optimistic
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_pinned: !currentlyPinned } : m));
    const { error } = await supabase.from('event_chat_messages').update({ is_pinned: !currentlyPinned }).eq('id', id);
    if (error) {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, is_pinned: currentlyPinned } : m));
      toast({ variant: 'destructive', title: 'Failed to pin message' });
    }
    setSelectedMessageId(null);
  };

  const deleteMessage = async (id: string) => {
    const original = messages.find(m => m.id === id);
    setMessages(prev => prev.filter(m => m.id !== id));
    const { error } = await supabase.from('event_chat_messages').delete().eq('id', id);
    if (error && original) {
      setMessages(prev => [...prev, original].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      toast({ variant: 'destructive', title: 'Failed to delete message' });
    }
    setSelectedMessageId(null);
  };

  const getRoleBadge = (msgUserId: string | null) => {
    if (!msgUserId) return null;
    if (djId && msgUserId === djId) return <Badge variant="default" className="text-[9px] px-1 py-0 ml-1">🎧 DJ</Badge>;
    if (venueOwnerId && msgUserId === venueOwnerId) return <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1">🏠 Host</Badge>;
    return null;
  };

  // Message grouping — collapse header if same user within 2 minutes
  const shouldShowHeader = (msg: ChatMessage, idx: number) => {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    if (prev.user_id !== msg.user_id || prev.guest_name !== msg.guest_name) return true;
    const diff = new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime();
    return diff > 120000; // 2 min
  };

  const pinnedMessages = messages.filter(m => m.is_pinned);
  const formatTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full">
      {/* Pinned messages */}
      {pinnedMessages.length > 0 && (
        <div className="border-b border-primary/20 bg-primary/5 px-3 py-2 space-y-1">
          {pinnedMessages.map(m => (
            <div key={m.id} className="flex items-center gap-2 text-xs">
              <Pin className="h-3 w-3 text-primary shrink-0" />
              <span className="font-semibold text-primary">{m.guest_name}:</span>
              <span className="truncate">{m.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={checkNearBottom}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 max-h-[400px] min-h-[200px]"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <MessageCircle className="h-8 w-8 opacity-40" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs opacity-60">Start the conversation! 💬</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isOwn = m.user_id === userId;
            const showHeader = shouldShowHeader(m, i);
            const isSelected = selectedMessageId === m.id;

            return (
              <div key={m.id} className={cn('flex gap-2', isOwn && 'flex-row-reverse', !showHeader && 'mt-0.5')}>
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 transition-all',
                    showHeader ? 'pt-1.5 pb-1.5' : 'py-0.5',
                    isOwn ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm',
                    m.is_pinned && 'ring-1 ring-primary/30',
                    m._optimistic && 'opacity-60'
                  )}
                  onClick={() => canModerate && setSelectedMessageId(isSelected ? null : m.id)}
                >
                  {showHeader && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn('text-[10px] font-bold', isOwn ? 'text-primary-foreground/70' : 'text-foreground/70')}>
                        {m.guest_name}
                      </span>
                      {getRoleBadge(m.user_id)}
                      <span className={cn('text-[9px]', isOwn ? 'text-primary-foreground/50' : 'text-muted-foreground')}>
                        {formatTime(m.created_at)}
                      </span>
                      {m.is_pinned && <Pin className="h-2.5 w-2.5 text-primary" />}
                    </div>
                  )}
                  <p className="text-sm break-words">{m.message}</p>
                </div>

                {/* Tap-to-reveal moderation controls (mobile-friendly) */}
                {canModerate && isSelected && !m._optimistic && (
                  <div className="flex items-center gap-1 animate-scale-in">
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(m.id, m.is_pinned); }}
                      className={cn('p-1.5 rounded-lg transition-colors', m.is_pinned ? 'bg-primary/20 text-primary' : 'bg-muted hover:bg-muted/80')}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMessage(m.id); }}
                      className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Unread indicator */}
      {!isNearBottomRef.current && unreadRef.current > 0 && (
        <button
          onClick={() => { scrollToBottom(); unreadRef.current = 0; onUnreadCount?.(0); }}
          className="mx-auto -mt-8 relative z-10 rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs shadow-lg animate-bounce"
        >
          ↓ {unreadRef.current} new message{unreadRef.current > 1 ? 's' : ''}
        </button>
      )}

      {/* Input */}
      <div className="border-t p-2 flex gap-2">
        <Input
          placeholder="Type a message..."
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          className="rounded-full text-sm h-9"
        />
        <Button size="icon" className="rounded-full h-9 w-9 shrink-0" onClick={sendMessage} disabled={sending || !newMessage.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
