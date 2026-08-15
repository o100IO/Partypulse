import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Check, Clock, Package, Loader2, ShoppingCart } from 'lucide-react';

interface OrderWithGuest {
  id: string;
  item_name: string;
  item_emoji: string;
  quantity: number;
  price_cents: number;
  status: string;
  created_at: string;
  table_id: string;
  guest_name: string;
}

interface DJOrderDashboardProps {
  eventId: string;
}

const STATUS_FLOW: Record<string, { next: string; label: string; icon: typeof Check }> = {
  pending: { next: 'confirmed', label: 'Confirm', icon: Check },
  confirmed: { next: 'delivered', label: 'Deliver', icon: Package },
};

export function DJOrderDashboard({ eventId }: DJOrderDashboardProps) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderWithGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel(`dj-orders-${eventId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'table_orders',
      }, () => fetchOrders())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'guest_tables',
        filter: `event_id=eq.${eventId}`,
      }, () => fetchOrders())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  const fetchOrders = async () => {
    try {
      // Get all tables for this event
      const { data: tables } = await supabase
        .from('guest_tables')
        .select('id, table_name, user_id')
        .eq('event_id', eventId);

      if (!tables || tables.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const tableIds = tables.map(t => t.id);
      const userIds = tables.map(t => t.user_id);

      // Fetch orders and profiles in parallel
      const [ordersRes, profilesRes] = await Promise.all([
        supabase
          .from('table_orders')
          .select('*')
          .in('table_id', tableIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds),
      ]);

      const profileMap = new Map(
        (profilesRes.data || []).map(p => [p.user_id, p.display_name || 'Guest'])
      );
      const tableMap = new Map(
        tables.map(t => [t.id, profileMap.get(t.user_id) || 'Guest'])
      );

      setOrders(
        (ordersRes.data || []).map(o => ({
          ...o,
          guest_name: tableMap.get(o.table_id) || 'Guest',
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdating(orderId);
    try {
      const { error } = await supabase
        .from('table_orders')
        .update({ status: newStatus })
        .eq('id', orderId);
      if (error) throw error;
      toast({ title: `Order ${newStatus}!` });
      await fetchOrders();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Failed to update order' });
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const filtered = statusFilter === 'active'
    ? orders.filter(o => o.status === 'pending' || o.status === 'confirmed')
    : orders;

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const confirmedCount = orders.filter(o => o.status === 'confirmed').length;

  const timeAgo = (date: string) => {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ago`;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, 'outline' | 'secondary' | 'default'> = {
      pending: 'outline',
      confirmed: 'secondary',
      delivered: 'default',
    };
    return <Badge variant={map[status] || 'outline'} className="text-[10px] capitalize">{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-semibold">{pendingCount} pending</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5">
          <Package className="h-3.5 w-3.5" />
          <span className="text-sm font-semibold">{confirmedCount} ready</span>
        </div>
        <div className="ml-auto">
          <Button
            size="sm"
            variant={statusFilter === 'active' ? 'default' : 'outline'}
            onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
            className="text-xs rounded-full h-7"
          >
            {statusFilter === 'active' ? 'Active Only' : 'All Orders'}
          </Button>
        </div>
      </div>

      {/* Orders list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="font-semibold mb-1">No orders yet</h3>
          <p className="text-sm text-muted-foreground">Orders from guests will appear here in real-time.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => (
            <div
              key={order.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                order.status === 'pending' ? 'bg-primary/5 border-primary/20' : ''
              }`}
            >
              <span className="text-2xl">{order.item_emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{order.item_name}</span>
                  {order.quantity > 1 && (
                    <span className="text-xs text-muted-foreground">×{order.quantity}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{order.guest_name}</span>
                  <span>·</span>
                  <span>{timeAgo(order.created_at)}</span>
                  <span>·</span>
                  <span>{order.price_cents} pts</span>
                </div>
              </div>
              {statusBadge(order.status)}
              {STATUS_FLOW[order.status] && (
                <Button
                  size="sm"
                  variant={order.status === 'pending' ? 'default' : 'secondary'}
                  className="text-xs h-7 rounded-full"
                  disabled={updating === order.id}
                  onClick={() => updateStatus(order.id, STATUS_FLOW[order.status].next)}
                >
                  {updating === order.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    STATUS_FLOW[order.status].label
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
