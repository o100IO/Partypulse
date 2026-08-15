import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Ticket, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EventTicket {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  quantity_available: number;
  quantity_sold: number;
  perk_drink_discount?: number;
  perk_priority_queue?: boolean;
  perk_bonus_votes?: number;
}

interface TicketCardProps {
  ticket: EventTicket;
  userId: string | null;
  userBalance: number;
  onPurchase: (newBalance: number) => void;
}

export function TicketCard({ ticket, userId, userBalance, onPurchase }: TicketCardProps) {
  const { toast } = useToast();
  const [buying, setBuying] = useState(false);
  const [stamped, setStamped] = useState(false);
  const remaining = ticket.quantity_available - ticket.quantity_sold;
  const canAfford = userBalance >= ticket.price_cents;
  const soldOut = remaining <= 0;

  // Determine tier styling based on price
  const isVIP = ticket.price_cents >= 2000;
  const isPremium = ticket.price_cents >= 1000 && !isVIP;

  const handleBuy = async () => {
    if (!userId) return;
    setBuying(true);
    try {
      const { data, error } = await supabase.rpc('purchase_ticket', {
        p_ticket_id: ticket.id,
        p_user_id: userId,
        p_quantity: 1,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; new_balance?: number };
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Purchase failed', description: result.error });
        return;
      }
      if (result.new_balance !== undefined) onPurchase(result.new_balance);
      setStamped(true);
      setTimeout(() => setStamped(false), 2000);
      toast({ title: '🎟️ Ticket purchased!', description: `You got a ${ticket.name} ticket.` });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Something went wrong' });
    } finally {
      setBuying(false);
    }
  };

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-300 relative',
      soldOut && 'opacity-60 grayscale',
      isVIP && !soldOut && 'border-2 border-[hsl(var(--rank-gold))] shadow-[0_0_15px_hsl(var(--rank-gold)/0.15)]',
      isPremium && !soldOut && 'border-2 border-primary/50 shadow-[0_0_10px_hsl(var(--primary)/0.1)]',
    )}>
      {/* VIP shimmer stripe */}
      {isVIP && !soldOut && (
        <div className="absolute top-0 left-0 right-0 h-1 gradient-warm animate-shimmer" />
      )}

      {/* Stamp overlay */}
      {stamped && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
          <span className="text-5xl animate-stamp">🎟️</span>
        </div>
      )}

      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
              isVIP ? 'bg-[hsl(var(--rank-gold))]/15' : 'bg-primary/10'
            )}>
              <Ticket className={cn('h-5 w-5', isVIP ? 'text-[hsl(var(--rank-gold))]' : 'text-primary')} />
            </div>
            <div className="min-w-0">
              <h4 className={cn(
                'font-semibold text-sm truncate',
                soldOut && 'line-through text-muted-foreground'
              )}>
                {ticket.name}
              </h4>
              {ticket.description && (
                <p className="text-xs text-muted-foreground truncate">{ticket.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs font-bold flex items-center gap-1">
                  <Coins className="h-3 w-3" /> {ticket.price_cents} pts
                </span>
                <Badge variant={remaining > 0 ? 'secondary' : 'destructive'} className="text-[10px]">
                  {remaining > 0 ? `${remaining} left` : 'Sold out'}
                </Badge>
                {(ticket.perk_drink_discount ?? 0) > 0 && (
                  <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">🍹 {ticket.perk_drink_discount}% off drinks</Badge>
                )}
                {ticket.perk_priority_queue && (
                  <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">⚡ Priority Queue</Badge>
                )}
                {(ticket.perk_bonus_votes ?? 0) > 0 && (
                  <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">🗳️ +{ticket.perk_bonus_votes} votes</Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            disabled={!userId || !canAfford || soldOut || buying}
            onClick={handleBuy}
            className="shrink-0"
          >
            {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buy'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
