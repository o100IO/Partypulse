import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield } from 'lucide-react';

export type JoinPolicy = 'open' | 'signed_in' | 'ticket_required' | 'code';

interface JoinSettingsCardProps {
  eventId: string;
  joinPolicy: JoinPolicy;
  joinCode: string | null;
  onSaved: (policy: JoinPolicy, code: string | null) => void;
}

const POLICY_HELP: Record<JoinPolicy, string> = {
  open: 'Anyone with the QR/link can join (including limited anonymous votes).',
  signed_in: 'Guests must sign in before using the event hub.',
  ticket_required: 'Guests must buy a ticket (with points) before full access.',
  code: 'Guests must enter the invite code you set below.',
};

export function JoinSettingsCard({ eventId, joinPolicy, joinCode, onSaved }: JoinSettingsCardProps) {
  const { toast } = useToast();
  const [policy, setPolicy] = useState<JoinPolicy>(joinPolicy || 'open');
  const [code, setCode] = useState(joinCode || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const trimmed = code.trim() || null;
      if (policy === 'code' && !trimmed) {
        toast({ variant: 'destructive', title: 'Invite code required for code-gated events' });
        return;
      }
      const { error } = await supabase
        .from('events')
        .update({ join_policy: policy, join_code: policy === 'code' ? trimmed : null })
        .eq('id', eventId);
      if (error) throw error;
      onSaved(policy, policy === 'code' ? trimmed : null);
      toast({ title: 'Join settings saved' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Failed to save join settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          Who can join
        </CardTitle>
        <CardDescription>
          Control access when guests scan the event QR or open the link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Join policy</Label>
          <Select value={policy} onValueChange={(v) => setPolicy(v as JoinPolicy)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open — anyone with the link</SelectItem>
              <SelectItem value="signed_in">Signed in required</SelectItem>
              <SelectItem value="ticket_required">Ticket required</SelectItem>
              <SelectItem value="code">Invite code</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{POLICY_HELP[policy]}</p>
        </div>
        {policy === 'code' && (
          <div className="space-y-2">
            <Label htmlFor="join-code">Invite code</Label>
            <Input
              id="join-code"
              placeholder="e.g. VIPNIGHT"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        )}
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save join settings
        </Button>
      </CardContent>
    </Card>
  );
}
