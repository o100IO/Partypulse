import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Megaphone, Percent, Send, Trash2, Clock, Loader2, Tag, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Announcement {
  id: string;
  event_id: string;
  type: string;
  title: string;
  message: string | null;
  discount_percent: number | null;
  discount_categories: string[] | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

const MENU_CATEGORIES = [
  { value: 'beers', label: '🍺 Beers' },
  { value: 'cocktails', label: '🍹 Cocktails' },
  { value: 'mixed', label: '🥃 Mixed' },
  { value: 'shots', label: '🔥 Shots' },
  { value: 'bottles', label: '🍾 Bottles' },
  { value: 'non-alcoholic', label: '💧 Non-Alcoholic' },
];

interface AnnouncementPanelProps {
  eventId: string;
}

export function AnnouncementPanel({ eventId }: AnnouncementPanelProps) {
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form state
  const [type, setType] = useState<'message' | 'discount'>('message');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [discountPercent, setDiscountPercent] = useState(20);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [duration, setDuration] = useState('30'); // minutes

  useEffect(() => {
    fetchAnnouncements();
    const channel = supabase
      .channel(`dj-announcements-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_announcements', filter: `event_id=eq.${eventId}` }, () => fetchAnnouncements())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('event_announcements')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (!error) setAnnouncements((data as Announcement[]) || []);
    setLoading(false);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleSend = async () => {
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Title is required' });
      return;
    }
    setSending(true);
    try {
      const expiresAt = type === 'discount'
        ? new Date(Date.now() + parseInt(duration) * 60000).toISOString()
        : null;

      const { error } = await supabase.from('event_announcements').insert({
        event_id: eventId,
        type,
        title: title.trim(),
        message: message.trim() || null,
        discount_percent: type === 'discount' ? discountPercent : 0,
        discount_categories: type === 'discount' && selectedCategories.length > 0 ? selectedCategories : [],
        expires_at: expiresAt,
        is_active: true,
      });
      if (error) throw error;

      toast({ title: type === 'discount' ? '🎉 Discount alert sent!' : '📢 Message sent!', description: 'Guests will see it instantly.' });
      setTitle('');
      setMessage('');
      setSelectedCategories([]);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Failed to send' });
    } finally {
      setSending(false);
    }
  };

  const deactivate = async (id: string) => {
    await supabase.from('event_announcements').update({ is_active: false }).eq('id', id);
    fetchAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    await supabase.from('event_announcements').delete().eq('id', id);
    fetchAnnouncements();
  };

  const isExpired = (a: Announcement) => a.expires_at && new Date(a.expires_at) < new Date();
  const activeAnnouncements = announcements.filter(a => a.is_active && !isExpired(a));
  const pastAnnouncements = announcements.filter(a => !a.is_active || isExpired(a));

  return (
    <div className="space-y-4">
      {/* Create Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" /> Send Announcement
          </CardTitle>
          <CardDescription>Push messages and discount alerts to all guests in real-time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Type Toggle */}
          <div className="flex rounded-lg bg-muted p-1 gap-1">
            <button
              onClick={() => setType('message')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all',
                type === 'message' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Megaphone className="h-4 w-4" /> Message
            </button>
            <button
              onClick={() => setType('discount')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all',
                type === 'discount' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Percent className="h-4 w-4" /> Discount
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title</Label>
              <Input
                placeholder={type === 'message' ? 'e.g. VIP area now open!' : 'e.g. Happy Hour!'}
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Message (optional)</Label>
              <Textarea
                placeholder={type === 'message' ? 'Details for your guests...' : 'e.g. All cocktails half price for the next 30 minutes!'}
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="mt-1 min-h-[60px]"
                rows={2}
              />
            </div>

            {type === 'discount' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Discount %</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {[10, 20, 30, 50].map(p => (
                        <button
                          key={p}
                          onClick={() => setDiscountPercent(p)}
                          className={cn(
                            'flex-1 rounded-lg py-2 text-sm font-bold transition-all border',
                            discountPercent === p
                              ? 'bg-primary text-primary-foreground border-primary shadow-md'
                              : 'bg-muted border-border hover:border-primary/50'
                          )}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Duration</Label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs mb-1.5 block">Apply to categories (leave empty for all)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {MENU_CATEGORIES.map(cat => (
                      <button
                        key={cat.value}
                        onClick={() => toggleCategory(cat.value)}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-medium border transition-all',
                          selectedCategories.includes(cat.value)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted border-border hover:border-primary/50'
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Button onClick={handleSend} disabled={sending || !title.trim()} className="w-full gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {type === 'discount' ? 'Send Discount Alert' : 'Broadcast Message'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Announcements */}
      {activeAnnouncements.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active ({activeAnnouncements.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeAnnouncements.map(a => (
              <div key={a.id} className={cn(
                'flex items-start gap-3 p-3 rounded-lg border',
                a.type === 'discount' ? 'border-primary/30 bg-primary/5' : 'border-border'
              )}>
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm',
                  a.type === 'discount' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {a.type === 'discount' ? <Percent className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{a.title}</span>
                    {a.type === 'discount' && (
                      <Badge variant="secondary" className="text-[10px]">{a.discount_percent}% off</Badge>
                    )}
                  </div>
                  {a.message && <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>}
                  {a.expires_at && (
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expires {new Date(a.expires_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deactivate(a.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteAnnouncement(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Past Announcements */}
      {pastAnnouncements.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Past ({pastAnnouncements.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {pastAnnouncements.slice(0, 5).map(a => (
              <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg text-muted-foreground opacity-60">
                {a.type === 'discount' ? <Percent className="h-3.5 w-3.5" /> : <Megaphone className="h-3.5 w-3.5" />}
                <span className="text-xs flex-1 truncate">{a.title}</span>
                {a.type === 'discount' && <span className="text-[10px]">{a.discount_percent}%</span>}
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteAnnouncement(a.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
