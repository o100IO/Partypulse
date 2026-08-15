import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Coins, Music, ThumbsUp, History, TrendingUp, ShoppingCart, ArrowRight, TestTube, Loader2 } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type PointTransaction = Database['public']['Tables']['point_transactions']['Row'];

interface Stats {
  pointsBalance: number;
  totalRequests: number;
  totalVotes: number;
}

export default function GuestProfile() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [stats, setStats] = useState<Stats>({
    pointsBalance: 0,
    totalRequests: 0,
    totalVotes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [addingPoints, setAddingPoints] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfileData();
    }
  }, [user]);

  const fetchProfileData = async () => {
    try {
      // Get transactions
      const { data: txData, error: txError } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (txError) throw txError;
      setTransactions(txData || []);

      // Get stats
      const { count: requestCount } = await supabase
        .from('song_requests')
        .select('*', { count: 'exact', head: true })
        .eq('guest_id', user?.id);

      const { count: voteCount } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      setStats({
        pointsBalance: profile?.points_balance || 0,
        totalRequests: requestCount || 0,
        totalVotes: voteCount || 0,
      });
    } catch (error) {
      console.error('Error fetching profile data:', error);
      toast({
        variant: 'destructive',
        title: 'Error loading profile',
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

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <ShoppingCart className="h-4 w-4" />;
      case 'earned':
        return <TrendingUp className="h-4 w-4" />;
      case 'spent':
        return <ThumbsUp className="h-4 w-4" />;
      case 'refund':
        return <ArrowRight className="h-4 w-4" />;
      default:
        return <Coins className="h-4 w-4" />;
    }
  };

  const addTestPoints = async () => {
    if (!user) return;
    setAddingPoints(true);
    try {
      const { data, error } = await supabase.rpc('grant_demo_points');
      if (error) throw error;

      const result = data as { success: boolean; error?: string; new_balance?: number };
      if (!result?.success) {
        toast({ variant: 'destructive', title: result?.error || 'Failed to add points' });
        return;
      }

      setStats(prev => ({ ...prev, pointsBalance: result.new_balance ?? prev.pointsBalance }));
      toast({ title: '🎉 +1000 Test Points added!', description: 'Use them to vote and tip.' });
      fetchProfileData();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Failed to add points' });
    } finally {
      setAddingPoints(false);
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'earned':
      case 'refund':
        return 'text-green-500';
      case 'spent':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <MainLayout showFooter={false}>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">Manage your points and view your activity.</p>
        </div>

        {/* Points Balance Card */}
        <Card className="mb-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Your Points Balance</p>
                <div className="flex items-center gap-2">
                  <Coins className="h-8 w-8 text-primary" />
                  <span className="text-4xl font-bold">{stats.pointsBalance}</span>
                </div>
              </div>
              <Button size="lg" onClick={addTestPoints} disabled={addingPoints}>
                {addingPoints ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
                Add 1000 Test Points
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Song Requests</CardTitle>
              <Music className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRequests}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Votes Cast</CardTitle>
              <ThumbsUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalVotes}</div>
            </CardContent>
          </Card>
        </div>

        {/* Point Packages */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Buy Points</CardTitle>
            <CardDescription>Get more points to boost your song requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="p-4 rounded-lg border hover:border-primary transition-colors cursor-pointer">
                <div className="text-2xl font-bold mb-1">500</div>
                <div className="text-sm text-muted-foreground mb-2">points</div>
                <Badge variant="outline">$5.00</Badge>
              </div>
              <div className="p-4 rounded-lg border border-primary bg-primary/5 cursor-pointer relative">
                <Badge className="absolute -top-2 -right-2 text-xs">Popular</Badge>
                <div className="text-2xl font-bold mb-1">1,100</div>
                <div className="text-sm text-muted-foreground mb-2">points</div>
                <Badge variant="outline">$10.00</Badge>
              </div>
              <div className="p-4 rounded-lg border hover:border-primary transition-colors cursor-pointer">
                <div className="text-2xl font-bold mb-1">3,000</div>
                <div className="text-sm text-muted-foreground mb-2">points</div>
                <Badge variant="outline">$25.00</Badge>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
              <p className="text-sm font-medium text-primary flex items-center justify-center gap-1.5">
                <TestTube className="h-3.5 w-3.5" />
                Demo Mode — tap packages above or use the test button to add free points
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Your recent point transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8">
                <History className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold mb-2">No transactions yet</h3>
                <p className="text-muted-foreground">Your point activity will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full bg-muted flex items-center justify-center ${getTransactionColor(tx.transaction_type)}`}>
                        {getTransactionIcon(tx.transaction_type)}
                      </div>
                      <div>
                        <div className="font-medium capitalize">{tx.transaction_type}</div>
                        {tx.description && (
                          <p className="text-sm text-muted-foreground">{tx.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${tx.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount}
                      </div>
                      <p className="text-sm text-muted-foreground">{formatDate(tx.created_at)}</p>
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
