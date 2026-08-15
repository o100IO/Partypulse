import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SkeletonStatsGrid, SkeletonCard } from '@/components/SkeletonCard';
import {
  ArrowLeft,
  Music,
  ThumbsUp,
  DollarSign,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Play,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

interface AnalyticsData {
  totalRequests: number;
  playedRequests: number;
  declinedRequests: number;
  pendingRequests: number;
  totalVotes: number;
  totalTips: number;
  uniqueGuests: number;
  topSongs: { name: string; requests: number }[];
  topArtists: { name: string; requests: number }[];
  hourlyActivity: { hour: string; requests: number }[];
}

const STATUS_COLORS = {
  played: 'hsl(var(--chart-1))',
  accepted: 'hsl(var(--chart-2))',
  pending: 'hsl(var(--chart-3))',
  declined: 'hsl(var(--chart-4))',
};

export default function EventAnalytics() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [eventName, setEventName] = useState('');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (eventId && user) {
      fetchAnalytics();
    }
  }, [eventId, user]);

  const fetchAnalytics = async () => {
    try {
      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('name, dj_id')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;

      if (eventData.dj_id !== user?.id) {
        navigate('/dj/dashboard');
        return;
      }

      setEventName(eventData.name);

      // Fetch all requests for this event
      const { data: requests, error: requestsError } = await supabase
        .from('song_requests')
        .select('*')
        .eq('event_id', eventId);

      if (requestsError) throw requestsError;

      // Fetch votes for this event's requests
      const requestIds = requests?.map((r) => r.id) || [];
      const { data: votes } = await supabase
        .from('votes')
        .select('*')
        .in('request_id', requestIds);

      // Fetch tips for this event
      const { data: tips } = await supabase
        .from('tips')
        .select('amount_cents')
        .eq('event_id', eventId);

      // Calculate analytics
      const statusCounts = {
        played: requests?.filter((r) => r.status === 'played').length || 0,
        playing: requests?.filter((r) => r.status === 'playing').length || 0,
        accepted: requests?.filter((r) => r.status === 'accepted').length || 0,
        pending: requests?.filter((r) => r.status === 'pending').length || 0,
        declined: requests?.filter((r) => r.status === 'declined').length || 0,
      };

      // Group by song title
      const songCounts: Record<string, number> = {};
      const artistCounts: Record<string, number> = {};
      const hourlyRequests: Record<string, number> = {};

      requests?.forEach((r) => {
        // Song counts
        songCounts[r.song_title] = (songCounts[r.song_title] || 0) + 1;
        
        // Artist counts
        if (r.artist) {
          artistCounts[r.artist] = (artistCounts[r.artist] || 0) + 1;
        }
        
        // Hourly activity
        const hour = new Date(r.created_at).getHours();
        const hourLabel = `${hour}:00`;
        hourlyRequests[hourLabel] = (hourlyRequests[hourLabel] || 0) + 1;
      });

      const topSongs = Object.entries(songCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, requests]) => ({ name: name.slice(0, 30), requests }));

      const topArtists = Object.entries(artistCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, requests]) => ({ name, requests }));

      const hourlyActivity = Object.entries(hourlyRequests)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([hour, requests]) => ({ hour, requests }));

      // Unique guests (by guest_id or guest_name)
      const uniqueGuestIds = new Set(requests?.map((r) => r.guest_id || r.guest_name).filter(Boolean));

      setAnalytics({
        totalRequests: requests?.length || 0,
        playedRequests: statusCounts.played + statusCounts.playing,
        declinedRequests: statusCounts.declined,
        pendingRequests: statusCounts.pending,
        totalVotes: votes?.length || 0,
        totalTips: tips?.reduce((sum, t) => sum + t.amount_cents, 0) || 0,
        uniqueGuests: uniqueGuestIds.size,
        topSongs,
        topArtists,
        hourlyActivity,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        variant: 'destructive',
        title: 'Error loading analytics',
        description: 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const pieData = analytics
    ? [
        { name: 'Played', value: analytics.playedRequests, color: STATUS_COLORS.played },
        { name: 'Pending', value: analytics.pendingRequests, color: STATUS_COLORS.pending },
        { name: 'Declined', value: analytics.declinedRequests, color: STATUS_COLORS.declined },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <MainLayout showFooter={false}>
      <div className="container py-8">
        <Button variant="ghost" onClick={() => navigate(`/dj/events/${eventId}`)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Event
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">Event Analytics</h1>
          <p className="text-muted-foreground">{eventName}</p>
        </div>

        {loading ? (
          <>
            <SkeletonStatsGrid count={4} />
            <div className="grid gap-6 lg:grid-cols-2 mt-6">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </>
        ) : analytics ? (
          <>
            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Requests
                  </CardTitle>
                  <Music className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalRequests}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Songs Played
                  </CardTitle>
                  <Play className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.playedRequests}</div>
                  <p className="text-xs text-muted-foreground">
                    {analytics.totalRequests > 0
                      ? `${Math.round((analytics.playedRequests / analytics.totalRequests) * 100)}% play rate`
                      : 'No requests yet'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Votes
                  </CardTitle>
                  <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalVotes}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Tips Received
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${(analytics.totalTips / 100).toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2 mb-8">
              {/* Request Status Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Request Status</CardTitle>
                  <CardDescription>Breakdown of song request outcomes</CardDescription>
                </CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      No request data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Artists Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Artists</CardTitle>
                  <CardDescription>Most requested artists</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.topArtists.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={analytics.topArtists} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} />
                        <Tooltip />
                        <Bar dataKey="requests" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      No artist data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Activity Timeline */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Hourly Activity</CardTitle>
                <CardDescription>Request volume throughout the event</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.hourlyActivity.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={analytics.hourlyActivity}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="requests"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    No activity data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Songs List */}
            <Card>
              <CardHeader>
                <CardTitle>Top Requested Songs</CardTitle>
                <CardDescription>Most popular song requests at this event</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.topSongs.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.topSongs.map((song, index) => (
                      <div
                        key={song.name}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm text-primary">
                            {index + 1}
                          </div>
                          <span className="font-medium">{song.name}</span>
                        </div>
                        <Badge variant="secondary">{song.requests} requests</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No song data available
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No analytics data available
          </div>
        )}
      </div>
    </MainLayout>
  );
}
