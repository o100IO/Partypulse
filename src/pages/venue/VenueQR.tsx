import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Printer, Building2 } from 'lucide-react';

interface Venue {
  id: string;
  name: string;
  address: string | null;
}

export default function VenueQR() {
  const { venueId } = useParams<{ venueId: string }>();
  const { toast } = useToast();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (venueId) {
      fetchVenue();
    }
  }, [venueId]);

  const fetchVenue = async () => {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('id, name, address')
        .eq('id', venueId)
        .single();

      if (error) throw error;
      setVenue(data);
    } catch (error) {
      console.error('Error fetching venue:', error);
      toast({
        variant: 'destructive',
        title: 'Venue not found',
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

  if (!venue) {
    return (
      <MainLayout showFooter={false}>
        <div className="container py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Venue Not Found</h1>
          <Button asChild>
            <Link to="/venue/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  // For venue QR, we'd typically link to a venue-specific page
  // For now, we'll just show the venue info
  const venueUrl = `${window.location.origin}/venue/${venue.id}/live`;

  return (
    <MainLayout showFooter={false}>
      <div className="container max-w-2xl py-8">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Button variant="ghost" asChild>
            <Link to={`/venue/${venueId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Venue
            </Link>
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print All
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">{venue.name} QR Codes</h1>
          <p className="text-muted-foreground">Print and display these at your venue</p>
        </div>

        <div className="space-y-6">
          {/* Main Venue QR */}
          <QRCodeDisplay
            url={venueUrl}
            title="Main Venue QR"
            description="Links to the current live event at this venue"
            size={250}
          />

          {/* Table Signs Template */}
          <Card>
            <CardHeader>
              <CardTitle>Table Signs</CardTitle>
              <CardDescription>Print multiple copies for each table</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 print:grid-cols-1">
                {[1, 2, 3, 4].map((tableNum) => (
                  <div
                    key={tableNum}
                    className="border rounded-lg p-6 text-center break-inside-avoid"
                  >
                    <Building2 className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <h3 className="font-bold text-lg mb-1">{venue.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">Table {tableNum}</p>
                    <div className="inline-block bg-white p-2 rounded">
                      <QRCodeDisplay
                        url={venueUrl}
                        title=""
                        size={100}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Scan to request songs!
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
