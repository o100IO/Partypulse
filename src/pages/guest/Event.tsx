import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { VoteButton } from '@/components/VoteButton';
import { TipSection } from '@/components/TipSection';
import { TicketCard } from '@/components/TicketCard';
import { GuestTable } from '@/components/GuestTable';
import { GuestAnnouncementBanner } from '@/components/GuestAnnouncementBanner';
import { EventChat } from '@/components/EventChat';
import { EventLeaderboard } from '@/components/EventLeaderboard';
import { SkeletonRequestList } from '@/components/SkeletonCard';
import {
  Music, Search, Send, Coins, Youtube, MessageCircle, Clock, Loader2,
  Ticket, ShoppingCart, Mic2, X, ChevronUp, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Event {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  start_time: string;
  status: string;
  dj_id: string;
  venue_id: string | null;
  theme_color: string | null;
  theme_bg_image: string | null;
  theme_logo_url: string | null;
  join_policy?: string | null;
  join_code?: string | null;
}

interface SongRequest {
  id: string;
  song_title: string;
  artist: string | null;
  source: string | null;
  source_id: string | null;
  thumbnail_url: string | null;
  status: string;
  vote_count: number;
  guest_name: string | null;
  shoutout_message: string | null;
  created_at: string;
  is_pre_event: boolean;
}

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface EventTicket {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  quantity_available: number;
  quantity_sold: number;
  perk_drink_discount?: number;
  perk_priority_queue?: boolean;
  perk_bonus_votes?: number;
}

interface SearchResult {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  source: string;
  sourceId: string;
}

interface TicketPerks {
  drink_discount: number;
  priority_queue: boolean;
  bonus_votes: number;
}

const GUEST_SESSION_KEY = 'eventpulse_guest_session';
const GUEST_VOTES_KEY = 'eventpulse_guest_votes';
const MAX_GUEST_FREE_VOTES = 3;

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

function getGuestSessionId(): string {
  let sessionId = localStorage.getItem(GUEST_SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(GUEST_SESSION_KEY, sessionId);
  }
  return sessionId;
}

function getGuestVoteCount(eventId: string): number {
  const votes = JSON.parse(localStorage.getItem(GUEST_VOTES_KEY) || '{}');
  return votes[eventId] || 0;
}

function incrementGuestVoteCount(eventId: string): void {
  const votes = JSON.parse(localStorage.getItem(GUEST_VOTES_KEY) || '{}');
  votes[eventId] = (votes[eventId] || 0) + 1;
  localStorage.setItem(GUEST_VOTES_KEY, JSON.stringify(votes));
}

function getRankStyle(index: number, isPlaying: boolean) {
  if (isPlaying) return 'border-l-4 border-l-primary shadow-glow animate-breathing-glow';
  if (index === 0) return 'border-l-4 border-l-[hsl(var(--rank-gold))]';
  if (index === 1) return 'border-l-4 border-l-[hsl(var(--rank-silver))]';
  if (index === 2) return 'border-l-4 border-l-[hsl(var(--rank-bronze))]';
  return 'border-l-4 border-l-transparent';
}

function EqualizerBars({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-end gap-[2px] h-3', className)}>
      {[12, 16, 8, 14, 10].map((h, i) => (
        <span
          key={i}
          className="eq-bar"
          style={{
            '--eq-height': `${h}px`,
            '--eq-speed': `${0.4 + i * 0.1}s`,
            animationDelay: `${i * 0.08}s`,
          } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

function NowPlayingBar({ request }: { request: SongRequest | undefined }) {
  if (!request) return null;
  return (
    <div className="sticky top-0 z-30 glass border-b border-primary/20 px-4 py-2 flex items-center gap-3 animate-slide-up">
      <div className="h-6 w-6 rounded gradient-primary flex items-center justify-center">
        <Music className="h-3 w-3 text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{request.song_title}</p>
      </div>
      <EqualizerBars />
    </div>
  );
}

/* ─── Inline Search Panel ─── */
function InlineSearchPanel({
  isPreEvent,
  onSubmit,
  submitting,
}: {
  isPreEvent: boolean;
  onSubmit: (song: SearchResult, name: string, shoutout: string) => void;
  submitting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [guestName, setGuestName] = useState('');
  const [shoutout, setShoutout] = useState('');

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const mockResults: SearchResult[] = [
        { id: crypto.randomUUID(), title: `${query} - Official Video`, artist: 'Various Artists', thumbnail: `https://picsum.photos/seed/${query}1/120/90`, source: 'youtube', sourceId: `mock-${Date.now()}-1` },
        { id: crypto.randomUUID(), title: `${query} (Remix)`, artist: 'DJ Mix', thumbnail: `https://picsum.photos/seed/${query}2/120/90`, source: 'youtube', sourceId: `mock-${Date.now()}-2` },
        { id: crypto.randomUUID(), title: `${query} - Live Performance`, artist: 'Live Concert', thumbnail: `https://picsum.photos/seed/${query}3/120/90`, source: 'youtube', sourceId: `mock-${Date.now()}-3` },
      ];
      setResults(mockResults);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = () => {
    if (!selected) return;
    onSubmit(selected, guestName, shoutout);
    setSelected(null);
    setQuery('');
    setResults([]);
    setShoutout('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary font-medium hover:bg-primary/10 hover:border-primary/50 transition-all"
      >
        <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center shrink-0">
          <Mic2 className="h-4 w-4 text-primary-foreground" />
        </div>
        <span>{isPreEvent ? 'Pre-request a song...' : 'Request a song...'}</span>
        <Search className="h-4 w-4 ml-auto opacity-50" />
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-3 space-y-3 animate-scale-in">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search songs, artists..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            className="pl-9 rounded-xl h-10"
          />
        </div>
        <Button onClick={doSearch} disabled={searching} size="icon" className="rounded-xl h-10 w-10 shrink-0">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        <Button onClick={() => { setOpen(false); setResults([]); setSelected(null); }} size="icon" variant="ghost" className="rounded-xl h-10 w-10 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {results.length > 0 && !selected && (
        <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted/60 transition-all text-left animate-slide-up"
              style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
            >
              <img src={r.thumbnail} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.title}</p>
                <p className="text-[11px] text-muted-foreground">{r.artist}</p>
              </div>
              <Youtube className="h-4 w-4 text-destructive shrink-0 opacity-50" />
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-2.5 animate-tab-fade">
          <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 p-2.5">
            <img src={selected.thumbnail} alt="" className="w-11 h-11 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{selected.title}</p>
              <p className="text-[11px] text-muted-foreground">{selected.artist}</p>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setSelected(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Your name (optional)" value={guestName} onChange={e => setGuestName(e.target.value)} className="rounded-xl text-xs h-9" />
            <Input placeholder="Shoutout 🎉 (optional)" value={shoutout} onChange={e => setShoutout(e.target.value)} className="rounded-xl text-xs h-9" />
          </div>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full rounded-xl gap-2 h-10">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isPreEvent ? 'Submit Pre-Request' : 'Request Song'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function GuestEvent() {
  const { eventId } = useParams<{ eventId: string }>();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [djProfile, setDjProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [guestVotesUsed, setGuestVotesUsed] = useState(0);
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [activeTab, setActiveTab] = useState('queue');
  const [activeDiscounts, setActiveDiscounts] = useState<any[]>([]);
  const [ticketPerks, setTicketPerks] = useState<TicketPerks>({ drink_discount: 0, priority_queue: false, bonus_votes: 0 });
  const [venueOwnerId, setVenueOwnerId] = useState<string | undefined>(undefined);
  const [chatUnread, setChatUnread] = useState(0);
  const [hasTicket, setHasTicket] = useState(false);
  const [codeUnlocked, setCodeUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [checkingAccess, setCheckingAccess] = useState(false);

  const nowPlaying = requests.find((r) => r.status === 'playing');
  const showMiniBar = activeTab !== 'queue' && nowPlaying;

  useEffect(() => {
    if (eventId) {
      fetchEventData();
      const cleanup = subscribeToUpdates();
      return cleanup;
    }
  }, [eventId, user?.id]);

  useEffect(() => {
    if (profile) setUserBalance(profile.points_balance);
  }, [profile]);

  useEffect(() => {
    if (eventId) setGuestVotesUsed(getGuestVoteCount(eventId));
  }, [eventId]);

  // Fetch ticket perks when user changes
  useEffect(() => {
    if (user?.id && eventId) {
      supabase.rpc('get_user_ticket_perks', { p_user_id: user.id, p_event_id: eventId })
        .then(({ data }) => {
          if (data) setTicketPerks(data as unknown as TicketPerks);
        });
    }
  }, [user?.id, eventId]);

  const fetchEventData = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events').select('*').eq('id', eventId).single();
      if (eventError) throw eventError;
      setEvent(eventData as unknown as Event);

      const policy = (eventData as { join_policy?: string }).join_policy || 'open';
      if (eventId && policy === 'code') {
        const unlocked = sessionStorage.getItem(`eventpulse_join_${eventId}`) === '1';
        setCodeUnlocked(unlocked);
      }

      if (user?.id && eventId) {
        const { data: purchase } = await supabase
          .from('ticket_purchases')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        setHasTicket(!!purchase);
      } else {
        setHasTicket(false);
      }

      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('user_id', eventData.dj_id).single();
      setDjProfile(profileData);

      // Fetch venue owner ID for chat badges
      if (eventData.venue_id) {
        const { data: venueData } = await supabase
          .from('venues').select('owner_id').eq('id', eventData.venue_id).single();
        if (venueData) setVenueOwnerId(venueData.owner_id);
      }

      const { data: requestsData, error: requestsError } = await supabase
        .from('song_requests').select('*').eq('event_id', eventId)
        .in('status', ['pending', 'accepted', 'playing'])
        .order('vote_count', { ascending: false });
      if (requestsError) throw requestsError;
      setRequests(requestsData || []);

      const { data: ticketData } = await supabase
        .from('event_tickets').select('*').eq('event_id', eventId).eq('is_active', true).order('sort_order');
      setTickets((ticketData as unknown as EventTicket[]) || []);
    } catch (error) {
      console.error('Error fetching event:', error);
      toast({ variant: 'destructive', title: 'Event not found' });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToUpdates = () => {
    const channel = supabase
      .channel(`event-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_requests', filter: `event_id=eq.${eventId}` }, () => fetchEventData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const submitRequest = async (song: SearchResult, guestName: string, shoutoutMessage: string) => {
    setSubmitting(true);
    try {
      const isPreEvent = event?.status !== 'live';
      const { error } = await supabase.from('song_requests').insert({
        event_id: eventId,
        song_title: song.title,
        artist: song.artist,
        source: song.source,
        source_id: song.sourceId,
        thumbnail_url: song.thumbnail,
        guest_id: user?.id || null,
        guest_name: guestName || null,
        shoutout_message: shoutoutMessage || null,
        is_pre_event: isPreEvent,
      });
      if (error) throw error;
      toast({ title: isPreEvent ? 'Pre-event request submitted!' : 'Request submitted!', description: 'Your song has been added to the queue.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Failed to submit request' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = useCallback(async (requestId: string, points: number) => {
    const guestSessionId = getGuestSessionId();
    if (!user && guestVotesUsed >= MAX_GUEST_FREE_VOTES) {
      toast({ variant: 'destructive', title: 'No free votes remaining', description: 'Sign up to get 100 free points!' });
      return;
    }
    try {
      const { data, error } = await supabase.rpc('spend_points_on_vote', {
        p_request_id: requestId,
        p_user_id: user?.id || null,
        p_points_to_spend: user ? points : 0,
        p_guest_session_id: user ? null : guestSessionId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; new_balance?: number };
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Vote failed', description: result.error });
        return;
      }
      if (user && result.new_balance !== undefined) setUserBalance(result.new_balance);
      else if (!user) { incrementGuestVoteCount(eventId!); setGuestVotesUsed((p) => p + 1); }
      toast({ title: 'Vote cast!', description: points > 0 ? `Spent ${points} points to boost this song.` : 'Your vote has been counted.' });
      fetchEventData();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Vote failed' });
    }
  }, [user, eventId, guestVotesUsed, toast]);

  const isPreEvent = event?.status !== 'live';

  const getTimeUntilEvent = () => {
    if (!event || event.status === 'live') return null;
    const diff = new Date(event.start_time).getTime() - Date.now();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) > 1 ? 's' : ''} until event`;
    return `${hours}h ${minutes}m until event`;
  };
  const timeUntil = getTimeUntilEvent();

  // Combine ticket perks discount with announcement discounts
  const combinedDiscounts = [...activeDiscounts];
  if (ticketPerks.drink_discount > 0) {
    combinedDiscounts.push({ discount_percent: ticketPerks.drink_discount, discount_categories: [] });
  }

  if (loading) {
    return (
      <MainLayout showFooter={false}>
        <div className="container max-w-2xl py-6">
          <div className="text-center mb-6 space-y-2">
            <div className="h-6 w-24 bg-muted rounded-full animate-pulse mx-auto" />
            <div className="h-8 w-48 bg-muted rounded animate-pulse mx-auto" />
          </div>
          <SkeletonRequestList count={4} />
        </div>
      </MainLayout>
    );
  }

  if (!event) {
    return (
      <MainLayout showFooter={false}>
        <div className="container py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Event Not Found</h1>
          <p className="text-muted-foreground">This event may not exist or has ended.</p>
        </div>
      </MainLayout>
    );
  }

  const joinPolicy = event.join_policy || 'open';
  const needsSignIn = joinPolicy === 'signed_in' && !user;
  const needsTicket = joinPolicy === 'ticket_required' && !hasTicket;
  const needsCode = joinPolicy === 'code' && !codeUnlocked;

  const tryUnlockCode = () => {
    setCheckingAccess(true);
    try {
      const expected = (event.join_code || '').trim().toLowerCase();
      if (!expected || codeInput.trim().toLowerCase() !== expected) {
        toast({ variant: 'destructive', title: 'Invalid invite code' });
        return;
      }
      sessionStorage.setItem(`eventpulse_join_${eventId}`, '1');
      setCodeUnlocked(true);
      toast({ title: 'Welcome in!' });
    } finally {
      setCheckingAccess(false);
    }
  };

  if (needsSignIn || needsTicket || needsCode) {
    return (
      <MainLayout showFooter={false}>
        <div className="container max-w-md py-12 space-y-4">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">{event.name}</h1>
            <p className="text-muted-foreground">
              {needsSignIn && 'This event requires a signed-in account to join.'}
              {needsTicket && !needsSignIn && 'Buy a ticket to unlock the event hub.'}
              {needsCode && 'Enter the invite code from the host to join.'}
            </p>
          </div>
          {needsCode && (
            <div className="flex gap-2">
              <Input
                placeholder="Invite code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
              />
              <Button onClick={tryUnlockCode} disabled={checkingAccess}>
                {checkingAccess ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unlock'}
              </Button>
            </div>
          )}
          {(needsSignIn || (needsTicket && !user)) && (
            <div className="text-center">
              <Button asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          )}
          {needsTicket && user && (
            <div className="space-y-3">
              {tickets.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground">
                  No tickets are on sale yet. Ask the host to add ticket types.
                </p>
              ) : (
                tickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    userId={user.id}
                    userBalance={userBalance}
                    onPurchase={(newBalance) => {
                      setUserBalance(newBalance);
                      fetchEventData();
                    }}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </MainLayout>
    );
  }

  const djInitials = djProfile?.display_name?.slice(0, 2).toUpperCase() || 'DJ';
  const themeColor = event.theme_color;
  const themeBgImage = event.theme_bg_image;
  const themeLogo = event.theme_logo_url;

  return (
    <MainLayout showFooter={false}>
      {showMiniBar && <NowPlayingBar request={nowPlaying} />}

      <div className="particle-bg min-h-screen">
        <div className="container max-w-2xl py-6 space-y-4">

          {/* ═══ Hero Header ═══ */}
          <div className="relative rounded-2xl overflow-hidden min-h-[240px]">
            {/* Background layers */}
            {themeBgImage ? (
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${themeBgImage})` }} />
            ) : themeColor ? (
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }} />
            ) : (
              <div className="absolute inset-0 gradient-primary opacity-90" />
            )}
            {themeBgImage && themeColor && (
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${themeColor}88, ${themeColor}33)` }} />
            )}
            {/* Bottom-only gradient so the image stays visible */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

            {/* Content positioned at edges */}
            <div className="relative z-10 flex flex-col justify-between h-full min-h-[240px] p-4">
              {/* Top row: logo left, status badge right */}
              <div className="flex items-start justify-between">
                {themeLogo ? (
                  <img src={themeLogo} alt="Event logo" className="h-10 drop-shadow-lg" />
                ) : <div />}
                <div className="flex items-center gap-2">
                  {timeUntil && (
                    <span className="text-xs text-primary-foreground/70 bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {timeUntil}
                    </span>
                  )}
                  {isPreEvent ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-warning/20 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                      <Clock className="h-3 w-3" />
                      Pre-Event
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-full bg-destructive/30 backdrop-blur-sm px-3 py-1.5 text-xs font-bold text-primary-foreground">
                      <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                      LIVE
                      <EqualizerBars className="ml-1" />
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom section: event info */}
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary-foreground drop-shadow-md leading-tight">
                  {event.name}
                </h1>
                <div className="flex items-center gap-3 flex-wrap">
                  {djProfile?.avatar_url ? (
                    <img src={djProfile.avatar_url} alt="" className={cn('h-8 w-8 rounded-full object-cover border-2 border-primary-foreground/30', !isPreEvent && 'glow-ring')} />
                  ) : (
                    <div className={cn('h-8 w-8 rounded-full bg-primary-foreground/20 backdrop-blur flex items-center justify-center text-xs font-bold text-primary-foreground', !isPreEvent && 'glow-ring')}>
                      {djInitials}
                    </div>
                  )}
                  <span className="text-sm text-primary-foreground/90 font-medium">{djProfile?.display_name || 'DJ'}</span>
                  {event.genre && (
                    <Badge className="rounded-full text-xs bg-primary-foreground/15 text-primary-foreground border-primary-foreground/20 backdrop-blur-sm">
                      {event.genre}
                    </Badge>
                  )}
                  {ticketPerks.priority_queue && (
                    <Badge className="rounded-full text-xs bg-[hsl(var(--rank-gold))]/20 text-primary-foreground border-[hsl(var(--rank-gold))]/30 backdrop-blur-sm">
                      ⚡ VIP
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Points bar ═══ */}
          {user ? (
            <div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{userBalance} points</span>
                {ticketPerks.bonus_votes > 0 && (
                  <Badge variant="outline" className="text-[10px] border-primary/30">+{ticketPerks.bonus_votes} bonus votes</Badge>
                )}
                {ticketPerks.drink_discount > 0 && (
                  <Badge variant="outline" className="text-[10px] border-primary/30">🍹 {ticketPerks.drink_discount}% off</Badge>
                )}
              </div>
              <Button size="sm" variant="outline" className="rounded-full h-7 text-xs" asChild>
                <Link to="/guest/profile">Get More</Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-2.5">
              <span className="text-sm text-muted-foreground">
                Free votes: {MAX_GUEST_FREE_VOTES - guestVotesUsed} remaining
              </span>
              <Button size="sm" variant="outline" className="rounded-full h-7 text-xs" asChild>
                <Link to="/auth">Sign up for 100 pts</Link>
              </Button>
            </div>
          )}

          {/* ═══ Announcements ═══ */}
          <GuestAnnouncementBanner eventId={event.id} onActiveDiscounts={setActiveDiscounts} />

          {/* ═══ Leaderboard (collapsible) ═══ */}
          <EventLeaderboard eventId={event.id} />

          {/* ═══ Tabs — 5 tabs ═══ */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5 rounded-full bg-muted/80 p-1">
              <TabsTrigger value="queue" className="rounded-full text-xs data-[state=active]:shadow-md gap-1">
                <Music className="h-3 w-3" /> Queue
              </TabsTrigger>
              <TabsTrigger value="tickets" className="rounded-full text-xs data-[state=active]:shadow-md gap-1">
                <Ticket className="h-3 w-3" /> Tickets
              </TabsTrigger>
              <TabsTrigger value="table" className="rounded-full text-xs data-[state=active]:shadow-md gap-1">
                <ShoppingCart className="h-3 w-3" /> Menu
              </TabsTrigger>
              <TabsTrigger value="chat" className="rounded-full text-xs data-[state=active]:shadow-md gap-1 relative">
                <MessageCircle className="h-3 w-3" /> Chat
                {chatUnread > 0 && activeTab !== 'chat' && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1">
                    {chatUnread > 9 ? '9+' : chatUnread}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="send" className="rounded-full text-xs data-[state=active]:shadow-md gap-1">
                <Coins className="h-3 w-3" /> Tip
              </TabsTrigger>
            </TabsList>

            {/* ─── Queue + Search Tab ─── */}
            <TabsContent value="queue" className="space-y-3 animate-tab-fade">
              <InlineSearchPanel
                isPreEvent={isPreEvent}
                onSubmit={submitRequest}
                submitting={submitting}
              />

              {requests.length === 0 ? (
                <Card className="glass-card">
                  <CardContent className="py-12 text-center">
                    <div className="mx-auto w-14 h-14 rounded-full bg-accent flex items-center justify-center mb-4 animate-float">
                      <Music className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-1">No songs in queue yet</h3>
                    <p className="text-muted-foreground text-sm">Be the first to request a song!</p>
                  </CardContent>
                </Card>
              ) : (
                requests.map((request, index) => {
                  const isPlaying = request.status === 'playing';
                  const isPriority = ticketPerks.priority_queue && request.guest_name === profile?.display_name;
                  return (
                    <Card
                      key={request.id}
                      className={cn(
                        'glass-card transition-all duration-300 animate-slide-up overflow-hidden',
                        getRankStyle(index, isPlaying),
                        isPlaying && 'ring-1 ring-primary/30'
                      )}
                      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                            isPlaying ? 'gradient-primary text-primary-foreground' :
                            index === 0 ? 'bg-[hsl(var(--rank-gold))]/15 text-[hsl(var(--rank-gold))]' :
                            index === 1 ? 'bg-[hsl(var(--rank-silver))]/15 text-[hsl(var(--rank-silver))]' :
                            index === 2 ? 'bg-[hsl(var(--rank-bronze))]/15 text-[hsl(var(--rank-bronze))]' :
                            'bg-muted text-muted-foreground'
                          )}>
                            {isPlaying ? (
                              <EqualizerBars />
                            ) : index < 3 ? (
                              <span className="animate-medal-shimmer">{MEDAL_EMOJIS[index]}</span>
                            ) : (
                              index + 1
                            )}
                          </div>
                          {request.thumbnail_url ? (
                            <img src={request.thumbnail_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <Music className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="font-semibold text-sm truncate">{request.song_title}</h4>
                                {request.artist && <p className="text-xs text-muted-foreground truncate">{request.artist}</p>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {isPriority && (
                                  <Badge className="text-[9px] px-1 py-0 h-4 bg-[hsl(var(--rank-gold))]/15 text-[hsl(var(--rank-gold))] border-0">⚡ VIP</Badge>
                                )}
                                {isPlaying && (
                                  <Badge className="shrink-0 text-[10px] px-1.5 py-0.5 gradient-primary border-0 text-primary-foreground animate-pulse-slow">
                                    Now Playing
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {request.shoutout_message && (
                              <div className="mt-1.5 text-xs bg-muted/60 rounded-lg px-2 py-1 flex items-center gap-1.5">
                                <MessageCircle className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="truncate">"{request.shoutout_message}"</span>
                              </div>
                            )}
                          </div>
                          <VoteButton
                            voteCount={request.vote_count}
                            userBalance={userBalance}
                            isAuthenticated={!!user}
                            guestVotesUsed={guestVotesUsed}
                            maxGuestVotes={MAX_GUEST_FREE_VOTES}
                            onVote={(points) => handleVote(request.id, points)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            {/* ─── Tickets Tab ─── */}
            <TabsContent value="tickets" className="space-y-3 animate-tab-fade">
              {tickets.length === 0 ? (
                <Card className="glass-card">
                  <CardContent className="py-8 text-center">
                    <Ticket className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">No tickets available for this event</p>
                  </CardContent>
                </Card>
              ) : (
                tickets.map((ticket, i) => (
                  <div key={ticket.id} className="animate-slide-up" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}>
                    <TicketCard ticket={ticket} userId={user?.id || null} userBalance={userBalance} onPurchase={(newBalance) => setUserBalance(newBalance)} />
                  </div>
                ))
              )}
            </TabsContent>

            {/* ─── Chat Tab ─── */}
            <TabsContent value="chat" className="animate-tab-fade">
              <Card className="glass-card overflow-hidden">
                <EventChat
                  eventId={event.id}
                  userId={user?.id || null}
                  displayName={profile?.display_name || 'Guest'}
                  djId={event.dj_id}
                  venueOwnerId={venueOwnerId}
                  onUnreadCount={activeTab !== 'chat' ? setChatUnread : undefined}
                />
              </Card>
            </TabsContent>

            {/* ─── Tip Tab ─── */}
            <TabsContent value="send" className="space-y-4 animate-tab-fade">
              <TipSection eventId={event.id} djId={event.dj_id} userId={user?.id || null} userBalance={userBalance} onBalanceUpdate={setUserBalance} />
            </TabsContent>

            {/* ─── Menu / Table Tab ─── */}
            <TabsContent value="table" className="space-y-4 animate-tab-fade">
              <GuestTable eventId={event.id} venueId={event.venue_id} userBalance={userBalance} onBalanceUpdate={setUserBalance} activeDiscounts={combinedDiscounts} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
