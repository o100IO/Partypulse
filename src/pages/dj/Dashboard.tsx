import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SkeletonStatsGrid } from '@/components/SkeletonCard';
import { QRShareDialog } from '@/components/QRCodeDisplay';
import { QRCodeSVG } from 'qrcode.react';
import {
  Plus,
  Calendar,
  Music,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  QrCode,
  MoreVertical,
  Play,
  Pause,
  Share2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Event {
  id: string;
  name: string;
  start_time: string;
  status: string;
  venue_id: string | null;
}

interface Stats {
  totalEvents: number;
  totalRequests: number;
  totalTips: number;
  upcomingEvents: number;
}

export default function DJDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalEvents: 0,
    totalRequests: 0,
    totalTips: 0,
    upcomingEvents: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('dj_id', user?.id)
        .order('start_time', { ascending: false })
        .limit(5);

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);

      // Calculate stats
      const { count: totalEventsCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('dj_id', user?.id);

      const { count: upcomingCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('dj_id', user?.id)
        .in('status', ['draft', 'scheduled', 'live']);

      // Get request count from user's events
      const { data: userEvents } = await supabase
        .from('events')
        .select('id')
        .eq('dj_id', user?.id);

      let requestCount = 0;
      if (userEvents && userEvents.length > 0) {
        const eventIds = userEvents.map((e) => e.id);
        const { count } = await supabase
          .from('song_requests')
          .select('*', { count: 'exact', head: true })
          .in('event_id', eventIds);
        requestCount = count || 0;
      }

      // Get tips received
      const { data: tipsData } = await supabase
        .from('tips')
        .select('amount_cents')
        .eq('to_user_id', user?.id);

      const totalTips = tipsData?.reduce((sum, tip) => sum + tip.amount_cents, 0) || 0;

      setStats({
        totalEvents: totalEventsCount || 0,
        totalRequests: requestCount,
        totalTips: totalTips / 100,
        upcomingEvents: upcomingCount || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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

  return (
    <MainLayout showFooter={false}>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {profile?.display_name || 'DJ'} 🎧</h1>
            <p className="text-sm text-muted-foreground">Manage your events and track performance.</p>
          </div>
          <Button asChild className="rounded-xl gap-2">
            <Link to="/dj/events/new">
              <Plus className="h-4 w-4" />
              New Event
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <SkeletonStatsGrid count={4} />
        ) : (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total Events', value: stats.totalEvents, icon: Calendar, color: 'text-primary' },
              { label: 'Song Requests', value: stats.totalRequests, icon: Music, color: 'text-accent-foreground' },
              { label: 'Tips Earned', value: `$${stats.totalTips.toFixed(2)}`, icon: DollarSign, color: 'text-success' },
              { label: 'Upcoming', value: stats.upcomingEvents, icon: Clock, color: 'text-warning' },
            ].map((stat) => (
              <Card key={stat.label} className="glass-card overflow-hidden group hover:shadow-glow transition-all duration-300">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                    <stat.icon className={cn('h-4 w-4', stat.color)} />
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Recent Events */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Events</h2>
            <Button variant="ghost" size="sm" className="rounded-full text-xs" asChild>
              <Link to="/dj/events">View All →</Link>
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : events.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-10 text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-accent flex items-center justify-center mb-4 animate-float">
                  <Music className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">No events yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Create your first event to get started.</p>
                <Button asChild className="rounded-xl">
                  <Link to="/dj/events/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Event
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {events.map((event, i) => (
                <Link
                  key={event.id}
                  to={`/dj/events/${event.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border bg-card/60 hover:bg-card hover:shadow-md transition-all duration-200 group animate-slide-up"
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                      event.status === 'live' ? 'gradient-primary text-primary-foreground' : 'bg-accent'
                    )}>
                      {event.status === 'live' ? <Play className="h-4 w-4" /> : <Music className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-sm truncate group-hover:text-primary transition-colors">{event.name}</h4>
                      <p className="text-xs text-muted-foreground">{formatDate(event.start_time)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getStatusBadge(event.status)}
                    <QRShareDialog 
                      url={`${window.location.origin}/e/${event.id}`} 
                      title={event.name}
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.preventDefault()}>
                        <QrCode className="h-4 w-4" />
                      </Button>
                    </QRShareDialog>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
