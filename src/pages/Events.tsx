import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Music, Calendar, ArrowRight, Radio, Loader2 } from 'lucide-react';

interface EventWithDJ {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  start_time: string;
  status: string;
  dj_id: string;
  dj_name?: string;
}

export default function Events() {
  const [events, setEvents] = useState<EventWithDJ[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .in('status', ['live', 'scheduled', 'draft'])
        .order('start_time', { ascending: true });

      if (error) throw error;

      // Fetch DJ names
      const djIds = [...new Set((data || []).map(e => e.dj_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', djIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

      setEvents((data || []).map(e => ({
        ...e,
        dj_name: profileMap.get(e.dj_id) || 'DJ',
      })));
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-destructive text-destructive-foreground';
      case 'scheduled': return 'bg-primary text-primary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <MainLayout>
      <div className="container py-12">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-4">
              <Radio className="h-4 w-4" />
              Browse Events
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-2">Live & Upcoming Events</h1>
            <p className="text-muted-foreground">Join an event, request songs, and vote for your favorites.</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : events.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-16 text-center">
                <Music className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No events right now</h3>
                <p className="text-muted-foreground mb-6">Check back soon or create your own event as a DJ!</p>
                <Button asChild>
                  <Link to="/auth?mode=signup&role=dj">Start as DJ</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <Link key={event.id} to={`/e/${event.id}`} className="block group">
                  <Card className="glass-card transition-all hover:shadow-lg hover:border-primary/30 group-hover:scale-[1.01]">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getStatusColor(event.status)}>
                              {event.status === 'live' && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current animate-pulse inline-block" />}
                              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                            </Badge>
                            {event.genre && (
                              <Badge variant="secondary" className="rounded-full text-xs">{event.genre}</Badge>
                            )}
                          </div>
                          <h3 className="text-lg font-bold truncate">{event.name}</h3>
                          <p className="text-sm text-muted-foreground">{event.dj_name}</p>
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(event.start_time)}
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-2" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
