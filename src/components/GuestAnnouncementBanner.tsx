import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Megaphone, Percent, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Announcement {
  id: string;
  type: string;
  title: string;
  message: string | null;
  discount_percent: number | null;
  discount_categories: string[] | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface GuestAnnouncementBannerProps {
  eventId: string;
  onActiveDiscounts?: (discounts: Announcement[]) => void;
}

export function GuestAnnouncementBanner({ eventId, onActiveDiscounts }: GuestAnnouncementBannerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [newFlash, setNewFlash] = useState<string | null>(null);

  useEffect(() => {
    fetchAnnouncements();
    const channel = supabase
      .channel(`guest-announcements-${eventId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_announcements', filter: `event_id=eq.${eventId}` }, (payload) => {
        const newAnn = payload.new as Announcement;
        setAnnouncements(prev => [newAnn, ...prev]);
        setNewFlash(newAnn.id);
        setTimeout(() => setNewFlash(null), 3000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'event_announcements', filter: `event_id=eq.${eventId}` }, () => fetchAnnouncements())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'event_announcements', filter: `event_id=eq.${eventId}` }, () => fetchAnnouncements())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('event_announcements')
      .select('*')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setAnnouncements((data as Announcement[]) || []);
  };

  // Filter out expired & dismissed
  const active = announcements.filter(a => {
    if (dismissed.has(a.id)) return false;
    if (!a.is_active) return false;
    if (a.expires_at && new Date(a.expires_at) < new Date()) return false;
    return true;
  });

  // Report active discounts to parent
  useEffect(() => {
    const discounts = active.filter(a => a.type === 'discount');
    onActiveDiscounts?.(discounts);
  }, [active.length]);

  if (active.length === 0) return null;

  return (
    <div className="space-y-2">
      {active.map((a) => {
        const isDiscount = a.type === 'discount';
        const isNew = newFlash === a.id;

        return (
          <div
            key={a.id}
            className={cn(
              'relative rounded-xl overflow-hidden transition-all duration-500',
              isNew && 'animate-slide-up',
            )}
          >
            {/* Background */}
            <div className={cn(
              'absolute inset-0',
              isDiscount
                ? 'bg-gradient-to-r from-primary/90 via-primary to-primary/90'
                : 'bg-gradient-to-r from-accent/90 via-accent to-accent/90'
            )} />

            {/* Shimmer overlay for new announcements */}
            {isNew && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[glow-sweep_1.5s_ease-in-out]" />
            )}

            {/* Content */}
            <div className="relative z-10 flex items-start gap-3 px-4 py-3">
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                isDiscount ? 'bg-primary-foreground/20' : 'bg-foreground/10'
              )}>
                {isDiscount ? (
                  <Percent className={cn('h-4 w-4', isDiscount ? 'text-primary-foreground' : 'text-foreground')} />
                ) : (
                  <Megaphone className="h-4 w-4 text-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'font-bold text-sm',
                    isDiscount ? 'text-primary-foreground' : 'text-foreground'
                  )}>
                    {isDiscount && `${a.discount_percent}% OFF — `}{a.title}
                  </span>
                </div>
                {a.message && (
                  <p className={cn(
                    'text-xs mt-0.5',
                    isDiscount ? 'text-primary-foreground/80' : 'text-foreground/70'
                  )}>
                    {a.message}
                  </p>
                )}
                {a.expires_at && (
                  <TimeRemaining
                    expiresAt={a.expires_at}
                    className={cn(
                      'text-[10px] mt-1',
                      isDiscount ? 'text-primary-foreground/60' : 'text-foreground/50'
                    )}
                  />
                )}
              </div>

              <button
                onClick={() => setDismissed(prev => new Set([...prev, a.id]))}
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center shrink-0 hover:bg-black/10 transition-colors',
                  isDiscount ? 'text-primary-foreground/60' : 'text-foreground/40'
                )}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimeRemaining({ expiresAt, className }: { expiresAt: string; className?: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(mins > 0 ? `${mins}m ${secs}s remaining` : `${secs}s remaining`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <span className={cn('flex items-center gap-1', className)}>
      <Clock className="h-3 w-3" /> {remaining}
    </span>
  );
}
