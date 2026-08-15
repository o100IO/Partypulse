import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Building2 } from 'lucide-react';

/**
 * Public landing for venue QR codes.
 * Redirects guests to the venue's current live event when one exists.
 */
export default function VenueLive() {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const [venueName, setVenueName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    if (!venueId) return;

    const resolve = async () => {
      try {
        const { data: venue } = await supabase
          .from('venues')
          .select('id, name')
          .eq('id', venueId)
          .maybeSingle();

        if (!venue) {
          setEmpty(true);
          return;
        }
        setVenueName(venue.name);

        const { data: liveEvent } = await supabase
          .from('events')
          .select('id')
          .eq('venue_id', venueId)
          .eq('status', 'live')
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (liveEvent?.id) {
          navigate(`/e/${liveEvent.id}`, { replace: true });
          return;
        }

        setEmpty(true);
      } catch (err) {
        console.error(err);
        setEmpty(true);
      } finally {
        setLoading(false);
      }
    };

    void resolve();
  }, [venueId, navigate]);

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
      <div className="container max-w-md py-16 text-center space-y-4">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">{venueName || 'Venue'}</h1>
        <p className="text-muted-foreground">
          No live event right now. Check back when the host goes live, or browse all events.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link to="/events">Browse events</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Home</Link>
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
