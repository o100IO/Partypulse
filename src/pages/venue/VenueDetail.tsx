import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Save, Users, Calendar, QrCode, Building2, UtensilsCrossed } from 'lucide-react';
import { VenueMenuManager } from '@/components/VenueMenuManager';

interface Venue {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  logo_url: string | null;
}

export default function VenueDetail() {
  const { venueId } = useParams<{ venueId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
  });

  useEffect(() => {
    if (venueId) {
      fetchVenue();
    }
  }, [venueId]);

  const fetchVenue = async () => {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('id', venueId)
        .single();

      if (error) throw error;
      setVenue(data);
      setFormData({
        name: data.name,
        description: data.description || '',
        address: data.address || '',
      });
    } catch (error) {
      console.error('Error fetching venue:', error);
      toast({
        variant: 'destructive',
        title: 'Venue not found',
        description: 'This venue may not exist.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!venueId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('venues')
        .update({
          name: formData.name,
          description: formData.description || null,
          address: formData.address || null,
        })
        .eq('id', venueId);

      if (error) throw error;

      toast({
        title: 'Venue updated',
        description: 'Your changes have been saved.',
      });
    } catch (error) {
      console.error('Error updating venue:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to update',
        description: 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
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

  return (
    <MainLayout showFooter={false}>
      <div className="container py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/venue/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-accent flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{venue.name}</h1>
              {venue.address && <p className="text-muted-foreground">{venue.address}</p>}
            </div>
          </div>
        </div>

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="staff" asChild>
              <Link to={`/venue/${venueId}/staff`}>Staff</Link>
            </TabsTrigger>
            <TabsTrigger value="events" asChild>
              <Link to={`/venue/${venueId}/events`}>Events</Link>
            </TabsTrigger>
            <TabsTrigger value="qr" asChild>
              <Link to={`/venue/${venueId}/qr`}>QR Codes</Link>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Venue Settings</CardTitle>
                <CardDescription>Update your venue information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Venue Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                  />
                </div>

                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="menu">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5" />
                  Venue Menu
                </CardTitle>
                <CardDescription>Manage the items guests can send to DJs during events</CardDescription>
              </CardHeader>
              <CardContent>
                {venueId && <VenueMenuManager venueId={venueId} />}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
