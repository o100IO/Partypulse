import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoteButtonProps {
  voteCount: number;
  userBalance: number;
  isAuthenticated: boolean;
  guestVotesUsed: number;
  maxGuestVotes: number;
  onVote: (points: number) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

const VOTE_TIERS = [
  { points: 0, label: 'Free Vote', weight: 1 },
  { points: 10, label: '10 Points', weight: 1 },
  { points: 50, label: '50 Points', weight: 5 },
  { points: 100, label: '100 Points', weight: 10 },
];

function getHeatColor(count: number): string {
  if (count >= 20) return 'text-destructive';
  if (count >= 10) return 'text-warning';
  if (count >= 5) return 'text-primary';
  return 'text-muted-foreground';
}

const CONFETTI_EMOJIS = ['🎉', '✨', '🔥', '💜', '⭐'];

export function VoteButton({
  voteCount,
  userBalance,
  isAuthenticated,
  guestVotesUsed,
  maxGuestVotes,
  onVote,
  disabled,
  className,
}: VoteButtonProps) {
  const [voting, setVoting] = useState(false);
  const [showFloat, setShowFloat] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [flipKey, setFlipKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const triggerEffects = () => {
    setShowFloat(true);
    setShowConfetti(true);
    setFlipKey((k) => k + 1);
    setTimeout(() => setShowFloat(false), 1000);
    setTimeout(() => setShowConfetti(false), 800);
  };

  const handleFreeVote = async () => {
    if (voting) return;
    setVoting(true);
    try {
      await onVote(0);
      triggerEffects();
    } finally {
      setVoting(false);
    }
  };

  const handleTierVote = async (points: number) => {
    if (voting) return;
    setVoting(true);
    try {
      await onVote(points);
      triggerEffects();
    } finally {
      setVoting(false);
    }
  };

  const canGuestVote = !isAuthenticated && guestVotesUsed < maxGuestVotes;
  const paidTiers = VOTE_TIERS.filter((t) => t.points > 0 && t.points <= userBalance);
  const isDisabled = disabled || voting || (!isAuthenticated && !canGuestVote);
  const heatColor = getHeatColor(voteCount);

  return (
    <div ref={containerRef} className={cn('relative inline-flex items-center gap-0.5', className)}>
      {/* Floating +1 */}
      {showFloat && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-bold text-primary animate-float-up pointer-events-none z-10">
          +1
        </span>
      )}

      {/* Confetti burst */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {CONFETTI_EMOJIS.map((emoji, i) => (
            <span
              key={i}
              className="absolute animate-confetti text-xs"
              style={{
                left: `${50 + (i - 2) * 18}%`,
                top: '20%',
                animationDelay: `${i * 0.06}s`,
              }}
            >
              {emoji}
            </span>
          ))}
        </div>
      )}

      {/* Main upvote button */}
      <Button
        variant="ghost"
        size="sm"
        disabled={isDisabled}
        onClick={handleFreeVote}
        className={cn(
          'flex flex-col items-center gap-0 h-auto py-1 px-2 rounded-lg transition-all',
          showFloat && 'animate-vote-pop'
        )}
      >
        {voting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronUp className={cn('h-4 w-4 transition-colors', heatColor)} />
        )}
        <span
          key={flipKey}
          className={cn(
            'text-xs font-bold tabular-nums leading-none transition-colors',
            heatColor,
            flipKey > 0 && 'animate-number-flip'
          )}
        >
          {voteCount}
        </span>
      </Button>

      {/* Point tier dropdown (auth only, has balance) */}
      {isAuthenticated && paidTiers.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-auto py-1 px-1.5 text-[10px] text-primary font-bold">
              boost
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[140px]">
            {paidTiers.map((tier) => (
              <DropdownMenuItem key={tier.points} onClick={() => handleTierVote(tier.points)}>
                <div className="flex items-center justify-between w-full gap-3">
                  <span className="text-sm">{tier.label}</span>
                  <span className="text-xs text-muted-foreground">+{tier.weight}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
