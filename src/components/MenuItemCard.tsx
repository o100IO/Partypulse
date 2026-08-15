import { useState } from 'react';
import { cn } from '@/lib/utils';

interface MenuItemCardProps {
  emoji: string;
  name: string;
  priceCents: number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function MenuItemCard({ emoji, name, priceCents, selected, disabled, onClick }: MenuItemCardProps) {
  const [pressed, setPressed] = useState(false);
  const [floatEmoji, setFloatEmoji] = useState(false);
  const priceStr = `$${(priceCents / 100).toFixed(0)}`;

  const handleClick = () => {
    if (disabled) return;
    setPressed(true);
    setFloatEmoji(true);
    setTimeout(() => setPressed(false), 250);
    setTimeout(() => setFloatEmoji(false), 1000);
    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all text-center w-full',
        selected
          ? 'border-primary bg-primary/10 scale-[1.03] shadow-md'
          : 'border-border bg-card hover:border-primary/40 hover:shadow-sm',
        disabled && 'opacity-40 pointer-events-none',
        pressed && 'animate-press'
      )}
    >
      {/* Float-up emoji on add */}
      {floatEmoji && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-lg animate-float-up pointer-events-none z-10">
          {emoji}
        </span>
      )}
      <span className="text-3xl">{emoji}</span>
      <span className="text-xs font-medium leading-tight">{name}</span>
      <span className="text-[10px] text-muted-foreground font-bold">{priceStr}</span>
    </button>
  );
}
