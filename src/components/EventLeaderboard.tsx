import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, ChevronUp, ChevronDown, Coins, ThumbsUp, Music } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeaderEntry {
  user_id: string | null;
  display_name: string;
  total_points?: number;
  vote_count?: number;
  total_tips?: number;
  request_count?: number;
}

interface LeaderboardData {
  top_voters: LeaderEntry[];
  top_tippers: LeaderEntry[];
  top_requesters: LeaderEntry[];
}

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
const ACHIEVEMENTS = {
  big_voter: { label: 'Top Voter', icon: '🗳️' },
  big_tipper: { label: 'Big Tipper', icon: '💰' },
  top_requester: { label: 'DJ Whisperer', icon: '🎵' },
};

export function EventLeaderboard({ eventId }: { eventId: string }) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [eventId]);

  const fetchLeaderboard = async () => {
    const { data: result } = await supabase.rpc('get_event_leaderboard', { p_event_id: eventId });
    if (result) setData(result as unknown as LeaderboardData);
  };

  const hasData = data && (data.top_voters.length > 0 || data.top_tippers.length > 0 || data.top_requesters.length > 0);

  if (!hasData) return null;

  const topVoter = data?.top_voters?.[0];
  const topTipper = data?.top_tippers?.[0];

  return (
    <Card className="glass-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[hsl(var(--rank-gold))]" />
          <span className="text-sm font-bold">Leaderboard</span>
          {!expanded && topVoter && (
            <span className="text-xs text-muted-foreground ml-1">
              🥇 {topVoter.display_name}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <CardContent className="pt-0 pb-4 px-4 space-y-4 animate-tab-fade">
          {/* Top Voters */}
          {data!.top_voters.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <ThumbsUp className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Top Voters</span>
              </div>
              <div className="space-y-1">
                {data!.top_voters.map((entry, i) => (
                  <div key={entry.user_id || i} className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm',
                    i === 0 && 'bg-[hsl(var(--rank-gold))]/10'
                  )}>
                    <span className="text-base w-6 text-center">{MEDALS[i]}</span>
                    <span className="flex-1 font-medium truncate">{entry.display_name}</span>
                    <Badge variant="secondary" className="text-[10px]">{entry.total_points} pts</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Tippers */}
          {data!.top_tippers.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Coins className="h-3.5 w-3.5 text-[hsl(var(--rank-gold))]" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Top Tippers</span>
              </div>
              <div className="space-y-1">
                {data!.top_tippers.map((entry, i) => (
                  <div key={entry.user_id || i} className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm',
                    i === 0 && 'bg-[hsl(var(--rank-gold))]/10'
                  )}>
                    <span className="text-base w-6 text-center">{MEDALS[i]}</span>
                    <span className="flex-1 font-medium truncate">{entry.display_name}</span>
                    <Badge variant="secondary" className="text-[10px]">{entry.total_tips} pts</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Requesters */}
          {data!.top_requesters.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Music className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Top Requesters</span>
              </div>
              <div className="space-y-1">
                {data!.top_requesters.map((entry, i) => (
                  <div key={entry.user_id || i} className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm',
                    i === 0 && 'bg-[hsl(var(--rank-gold))]/10'
                  )}>
                    <span className="text-base w-6 text-center">{MEDALS[i]}</span>
                    <span className="flex-1 font-medium truncate">{entry.display_name}</span>
                    <Badge variant="secondary" className="text-[10px]">{entry.request_count} songs</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
