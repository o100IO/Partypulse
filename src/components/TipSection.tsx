import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PartyPopper, Send, MessageCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TipSectionProps {
  eventId: string;
  djId: string;
  userId: string | null;
  userBalance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

const PRESETS = [
  { amount: 200, label: '$2', emoji: '🙌', tag: null },
  { amount: 500, label: '$5', emoji: '🔥', tag: 'Popular' },
  { amount: 1000, label: '$10', emoji: '💜', tag: null },
  { amount: 2000, label: '$20', emoji: '🚀', tag: null },
];

const RAIN_EMOJIS = ['🎉', '🎊', '💜', '🥳', '✨', '🎶', '🔥', '🪩'];

export function TipSection({ eventId, djId, userId, userBalance, onBalanceUpdate }: TipSectionProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pressedIdx, setPressedIdx] = useState<number | null>(null);

  const rainPositions = useMemo(
    () => RAIN_EMOJIS.map((_, i) => ({
      left: `${8 + (i * 12) % 85}%`,
      delay: `${i * 0.15}s`,
      size: i % 3 === 0 ? 'text-2xl' : 'text-lg',
    })),
    []
  );

  const handleSend = async () => {
    if (!userId || selected === null) return;

    const amount = selected;
    if (amount > userBalance) {
      toast({ variant: 'destructive', title: 'Not enough points', description: 'Get more points from your profile.' });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.rpc('send_points_tip', {
        p_from_user_id: userId,
        p_to_user_id: djId,
        p_event_id: eventId,
        p_amount_cents: amount,
        p_message: message || null,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; new_balance?: number };
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Tip failed', description: result.error });
        return;
      }

      if (result.new_balance !== undefined) onBalanceUpdate(result.new_balance);
      setSuccess(true);
      setSelected(null);
      setMessage('');
      setTimeout(() => setSuccess(false), 3000);

      toast({ title: '🎉 Tip sent!', description: `You sent ${amount} points to the DJ!` });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Something went wrong' });
    } finally {
      setSending(false);
    }
  };

  if (!userId) {
    return (
      <Card className="glass-card border-primary/20">
        <CardContent className="py-10 text-center">
          <PartyPopper className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium mb-1">Sign in to send tips</p>
          <p className="text-sm text-muted-foreground">Create an account to tip the DJ with points</p>
          <Button size="sm" variant="outline" className="mt-4" asChild>
            <Link to="/auth">Sign Up</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="glass-card border-primary/30 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {RAIN_EMOJIS.map((emoji, i) => (
            <span
              key={i}
              className={cn('absolute animate-emoji-rain', rainPositions[i].size)}
              style={{
                left: rainPositions[i].left,
                top: '-20px',
                animationDelay: rainPositions[i].delay,
              }}
            >
              {emoji}
            </span>
          ))}
        </div>
        <CardContent className="py-12 text-center animate-slide-up relative z-20">
          <span className="text-5xl mb-4 block">🎉</span>
          <h3 className="text-xl font-bold mb-1">Tip Sent!</h3>
          <p className="text-muted-foreground">The DJ appreciates your support</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-primary/20 overflow-hidden">
      <CardContent className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              💜 Show Some Love
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Tip the DJ with points</p>
          </div>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold bg-primary/10 text-primary border-primary/20">
            <Sparkles className="h-3 w-3 mr-1" />
            {userBalance} pts
          </Badge>
        </div>

        {/* Preset grid */}
        <div className="grid grid-cols-4 gap-2.5">
          {PRESETS.map((p, idx) => {
            const isSelected = selected === p.amount;
            const isDisabled = p.amount > userBalance;
            return (
              <button
                key={p.amount}
                onClick={() => {
                  setSelected(isSelected ? null : p.amount);
                  setPressedIdx(idx);
                  setTimeout(() => setPressedIdx(null), 250);
                }}
                disabled={isDisabled}
                className={cn(
                  'relative flex flex-col items-center gap-1 rounded-2xl p-3.5 border-2 transition-all duration-200 text-center',
                  isSelected
                    ? 'border-primary gradient-primary text-primary-foreground scale-105 shadow-glow'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30',
                  isDisabled && 'opacity-30 pointer-events-none',
                  pressedIdx === idx && 'animate-press',
                  isSelected && 'animate-bounce-subtle'
                )}
              >
                {p.tag && (
                  <span className={cn(
                    'absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap',
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-primary/10 text-primary'
                  )}>
                    {p.tag}
                  </span>
                )}
                <span className={cn('text-3xl transition-transform', !isDisabled && 'hover:animate-float')}>
                  {p.emoji}
                </span>
                <span className="text-sm font-bold">{p.label}</span>
                <span className={cn(
                  'text-[10px]',
                  isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
                )}>
                  {p.amount} pts
                </span>
              </button>
            );
          })}
        </div>

        {/* Message input */}
        <div className="relative">
          <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            placeholder="Add a message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="rounded-xl pl-9"
          />
        </div>

        {/* Send button */}
        <button
          className={cn(
            'w-full h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all duration-300 active:scale-95',
            selected !== null
              ? 'gradient-primary text-primary-foreground animate-breathing-glow glow-btn-shimmer shadow-glow cursor-pointer'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
          disabled={selected === null || sending}
          onClick={handleSend}
        >
          {sending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              {selected ? `Send ${selected} pts to DJ` : 'Select an amount'}
            </>
          )}
        </button>
      </CardContent>
    </Card>
  );
}
