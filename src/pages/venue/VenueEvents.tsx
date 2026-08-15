import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Calendar, Music } from 'lucide-react';

interface Event {
  id: string;
  name: string;
  start_time: string;
  status: string;
  dj_profile?: {
    display_name: string | null;
  };
}

interface Venue {
  id: string;
  name: string;
}

export default function VenueEvents() {
  const { venueId } = useParams<{ venueId: string }>();
  const { toast } = useToast();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (venueId) {
      fetchData();
    }
  }, [venueId]);

  const fetchData = async () => {
    try {
      // Fetch venue
      const { data: venueData, error: venueError } = await supabase
        .from('venues')
        .select('id, name')
        .eq('id', venueId)
        .single();

      if (venueError) throw venueError;
      setVenue(venueData);

      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, name, start_time, status, dj_id')
        .eq('venue_id', venueId)
        .order('start_time', { ascending: false });

      if (eventsError) throw eventsError;

      // Fetch DJ profiles
      const eventsWithProfiles = await Promise.all(
        (eventsData || []).map(async (event) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', event.dj_id)
            .single();
          return { ...event, dj_profile: profile };
        })
      );

      setEvents(eventsWithProfiles);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: 'Error loading data',
        description: 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'secondary', label: 'Draft' },
      scheduled: { variant: 'outline', label: 'Scheduled' },
      live: { variant: 'default', label: 'Live' },
      ended: { variant: 'secondary', label: 'Ended' },
      archived: { variant: 'secondary', label: 'Archived' },
    };
    const config = variants[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <MainLayout showFooter={false}>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showFooter={false}>
      <div className="container py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to={`/venue/${venueId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to {venue?.name || 'Venue'}
          </Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground">All events at {venue?.name}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Event History</CardTitle>
            <CardDescription>
              {events.length} event{events.length !== 1 ? 's' : ''} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold mb-2">No events yet</h3>
                <p className="text-muted-foreground">Events hosted at this venue will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                        <Music className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{event.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(event.start_time)}
                          {event.dj_profile?.display_name && ` • DJ: ${event.dj_profile.display_name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(event.status)}
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/e/${event.id}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
