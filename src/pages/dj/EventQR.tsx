import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';

interface Event {
  id: string;
  name: string;
  start_time: string;
  venue_id: string | null;
}

export default function EventQR() {
  const { eventId } = useParams<{ eventId: string }>();
  const { toast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, start_time, venue_id')
        .eq('id', eventId)
        .single();

      if (error) throw error;
      setEvent(data);
    } catch (error) {
      console.error('Error fetching event:', error);
      toast({
        variant: 'destructive',
        title: 'Event not found',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
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

  if (!event) {
    return (
      <MainLayout showFooter={false}>
        <div className="container py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Event Not Found</h1>
          <Button asChild>
            <Link to="/dj/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  const eventUrl = `${window.location.origin}/e/${event.id}`;

  return (
    <MainLayout showFooter={false}>
      <div className="container max-w-2xl py-8">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Button variant="ghost" asChild>
            <Link to={`/dj/events/${eventId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Event
            </Link>
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>

        <div className="space-y-6">
          <QRCodeDisplay
            url={eventUrl}
            title={event.name}
            description="Scan to request songs and vote!"
            size={250}
          />

          {/* Print-friendly version */}
          <Card className="print:border-0 print:shadow-none">
            <CardHeader className="text-center">
              <CardTitle className="text-lg">Table Sign Template</CardTitle>
              <CardDescription>Print and display at your event</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <h2 className="text-2xl font-bold mb-2">Request Songs!</h2>
                <p className="text-muted-foreground mb-4">
                  Scan the QR code to request your favorite songs
                </p>
                <div className="inline-block bg-white p-4 rounded-lg mb-4">
                  <QRCodeDisplay
                    url={eventUrl}
                    title=""
                    size={150}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Or visit: {eventUrl}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
