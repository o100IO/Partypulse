import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, Truck } from 'lucide-react';

interface TableOrder {
  id: string;
  item_name: string;
  item_emoji: string;
  quantity: number;
  price_cents: number;
  status: string;
  created_at: string;
}

interface TableOrderCardProps {
  order: TableOrder;
}

const statusConfig: Record<string, { label: string; variant: 'secondary' | 'default' | 'outline'; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', variant: 'outline', color: 'border-warning/40 bg-warning/5', icon: <Clock className="h-3 w-3" /> },
  confirmed: { label: 'Confirmed', variant: 'secondary', color: 'border-primary/40 bg-primary/5', icon: <CheckCircle2 className="h-3 w-3" /> },
  delivered: { label: 'Delivered', variant: 'default', color: 'border-emerald-500/40 bg-emerald-500/5', icon: <Truck className="h-3 w-3" /> },
};

export function TableOrderCard({ order }: TableOrderCardProps) {
  const config = statusConfig[order.status] || { label: order.status, variant: 'outline' as const, color: '', icon: null };
  const timeAgo = getTimeAgo(order.created_at);

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 animate-slide-up',
      config.color
    )}>
      <span className="text-2xl">{order.item_emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{order.item_name}</span>
          {order.quantity > 1 && (
            <span className="text-xs bg-muted rounded-full px-1.5 py-0.5">×{order.quantity}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground font-medium">{order.price_cents * order.quantity} pts</span>
          <span className="text-[10px] text-muted-foreground/60">• {timeAgo}</span>
        </div>
      </div>
      <Badge variant={config.variant} className="text-[10px] capitalize status-morph gap-1">
        {config.icon}
        {config.label}
      </Badge>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}
