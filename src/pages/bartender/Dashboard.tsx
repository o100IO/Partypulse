import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, TrendingUp, Calendar, Gift, MessageCircle } from 'lucide-react';

interface Tip {
  id: string;
  amount_cents: number;
  message: string | null;
  created_at: string;
  event_id: string | null;
  event?: {
    name: string;
  };
  from_profile?: {
    display_name: string | null;
  };
}

interface Stats {
  totalTips: number;
  tipCount: number;
  avgTip: number;
  todayTips: number;
}

export default function BartenderDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [tips, setTips] = useState<Tip[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalTips: 0,
    tipCount: 0,
    avgTip: 0,
    todayTips: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch tips
      const { data: tipsData, error: tipsError } = await supabase
        .from('tips')
        .select('*')
        .eq('to_user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (tipsError) throw tipsError;

      // Fetch event names and sender profiles for tips
      const tipsWithDetails = await Promise.all(
        (tipsData || []).map(async (tip) => {
          let eventName = null;
          let fromProfile = null;

          if (tip.event_id) {
            const { data: event } = await supabase
              .from('events')
              .select('name')
              .eq('id', tip.event_id)
              .single();
            eventName = event?.name;
          }

          if (tip.from_user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('user_id', tip.from_user_id)
              .single();
            fromProfile = profile;
          }

          return {
            ...tip,
            event: eventName ? { name: eventName } : undefined,
            from_profile: fromProfile,
          };
        })
      );

      setTips(tipsWithDetails);

      // Calculate stats
      const { data: allTips } = await supabase
        .from('tips')
        .select('amount_cents, created_at')
        .eq('to_user_id', user?.id);

      const total = allTips?.reduce((sum, tip) => sum + tip.amount_cents, 0) || 0;
      const count = allTips?.length || 0;
      const avg = count > 0 ? total / count : 0;

      const today = new Date().toISOString().split('T')[0];
      const todayTotal =
        allTips
          ?.filter((tip) => tip.created_at.startsWith(today))
          .reduce((sum, tip) => sum + tip.amount_cents, 0) || 0;

      setStats({
        totalTips: total / 100,
        tipCount: count,
        avgTip: avg / 100,
        todayTips: todayTotal / 100,
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <MainLayout showFooter={false}>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Welcome, {profile?.display_name || 'Bartender'}!</h1>
          <p className="text-muted-foreground">Track your earnings and tips.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalTips.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Tips</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.todayTips.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Tips</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tipCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Tip</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.avgTip.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Tips</CardTitle>
            <CardDescription>Your latest tips received</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : tips.length === 0 ? (
              <div className="text-center py-8">
                <Gift className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold mb-2">No tips yet</h3>
                <p className="text-muted-foreground">Tips you receive will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tips.map((tip) => (
                  <div
                    key={tip.id}
                    className="flex items-start justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">${(tip.amount_cents / 100).toFixed(2)}</div>
                        <p className="text-sm text-muted-foreground">
                          {tip.from_profile?.display_name || 'Anonymous Guest'}
                          {tip.event && ` at ${tip.event.name}`}
                        </p>
                        {tip.message && (
                          <div className="mt-2 text-sm bg-muted rounded p-2 flex items-start gap-2">
                            <MessageCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <span>"{tip.message}"</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatDate(tip.created_at)}</span>
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
