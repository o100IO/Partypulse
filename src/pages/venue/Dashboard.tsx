import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Building2,
  Users,
  Calendar,
  DollarSign,
  QrCode,
  MoreVertical,
  MapPin,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Venue {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  logo_url: string | null;
}

interface Stats {
  totalVenues: number;
  totalStaff: number;
  totalEvents: number;
  totalTips: number;
}

export default function VenueDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalVenues: 0,
    totalStaff: 0,
    totalEvents: 0,
    totalTips: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch venues
      const { data: venuesData, error: venuesError } = await supabase
        .from('venues')
        .select('*')
        .eq('owner_id', user?.id)
        .order('created_at', { ascending: false });

      if (venuesError) throw venuesError;
      setVenues(venuesData || []);

      // Calculate stats
      const venueIds = venuesData?.map((v) => v.id) || [];

      let staffCount = 0;
      let eventsCount = 0;
      let tipsTotal = 0;

      if (venueIds.length > 0) {
        const { count: staff } = await supabase
          .from('venue_staff')
          .select('*', { count: 'exact', head: true })
          .in('venue_id', venueIds);
        staffCount = staff || 0;

        const { count: events } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .in('venue_id', venueIds);
        eventsCount = events || 0;

        // Get tips from events at these venues
        const { data: venueEvents } = await supabase
          .from('events')
          .select('id')
          .in('venue_id', venueIds);

        if (venueEvents && venueEvents.length > 0) {
          const eventIds = venueEvents.map((e) => e.id);
          const { data: tipsData } = await supabase
            .from('tips')
            .select('amount_cents')
            .in('event_id', eventIds);
          tipsTotal = tipsData?.reduce((sum, tip) => sum + tip.amount_cents, 0) || 0;
        }
      }

      setStats({
        totalVenues: venuesData?.length || 0,
        totalStaff: staffCount,
        totalEvents: eventsCount,
        totalTips: tipsTotal / 100,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        variant: 'destructive',
        title: 'Error loading dashboard',
        description: 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout showFooter={false}>
      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Venue Dashboard</h1>
            <p className="text-muted-foreground">Manage your venues, staff, and events.</p>
          </div>
          <Button asChild>
            <Link to="/venue/create">
              <Plus className="mr-2 h-4 w-4" />
              Add Venue
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Venues</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalVenues}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Staff Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStaff}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEvents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tips Generated</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalTips.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Venues List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Venues</CardTitle>
            <CardDescription>Manage your venues and their staff</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : venues.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold mb-2">No venues yet</h3>
                <p className="text-muted-foreground mb-4">Create your first venue to get started.</p>
                <Button asChild>
                  <Link to="/venue/create">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Venue
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {venues.map((venue) => (
                  <div
                    key={venue.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-accent flex items-center justify-center">
                        {venue.logo_url ? (
                          <img src={venue.logo_url} alt={venue.name} className="h-12 w-12 rounded-lg object-cover" />
                        ) : (
                          <Building2 className="h-6 w-6 text-primary" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium">{venue.name}</h4>
                        {venue.address && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {venue.address}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/venue/${venue.id}`}>View Details</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/venue/${venue.id}/staff`}>Manage Staff</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/venue/${venue.id}/events`}>View Events</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/venue/${venue.id}/qr`}>QR Codes</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
