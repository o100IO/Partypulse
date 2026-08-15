import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Ticket } from 'lucide-react';

interface EventTicket {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  quantity_available: number;
  quantity_sold: number;
  is_active: boolean;
  sort_order: number;
  perk_drink_discount: number;
  perk_priority_queue: boolean;
  perk_bonus_votes: number;
}

interface TicketManagerProps {
  eventId: string;
}

export function TicketManager({ eventId }: TicketManagerProps) {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTicket, setNewTicket] = useState({ name: '', description: '', price: '', quantity: '100', drinkDiscount: '0', priorityQueue: false, bonusVotes: '0' });

  useEffect(() => {
    fetchTickets();
  }, [eventId]);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('event_tickets')
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order');
      if (error) throw error;
      setTickets((data as EventTicket[]) || []);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const addTicket = async () => {
    if (!newTicket.name.trim() || !newTicket.price) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('event_tickets')
        .insert({
          event_id: eventId,
          name: newTicket.name,
          description: newTicket.description || null,
          // price_cents stores points (legacy column name); do not multiply by 100
          price_cents: Math.round(parseFloat(newTicket.price)) || 0,
          quantity_available: parseInt(newTicket.quantity) || 100,
          sort_order: tickets.length + 1,
          perk_drink_discount: parseInt(newTicket.drinkDiscount) || 0,
          perk_priority_queue: newTicket.priorityQueue,
          perk_bonus_votes: parseInt(newTicket.bonusVotes) || 0,
        })
        .select()
        .single();
      if (error) throw error;
      setTickets(prev => [...prev, data as EventTicket]);
      setNewTicket({ name: '', description: '', price: '', quantity: '100', drinkDiscount: '0', priorityQueue: false, bonusVotes: '0' });
      toast({ title: 'Ticket type added' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Failed to add ticket' });
    } finally {
      setSaving(false);
    }
  };

  const updateTicket = async (id: string, updates: Partial<EventTicket>) => {
    try {
      const { error } = await supabase.from('event_tickets').update(updates).eq('id', id);
      if (error) throw error;
      setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Failed to update' });
    }
  };

  const deleteTicket = async (id: string) => {
    try {
      const { error } = await supabase.from('event_tickets').delete().eq('id', id);
      if (error) throw error;
      setTickets(prev => prev.filter(t => t.id !== id));
      toast({ title: 'Ticket removed' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Failed to delete' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tickets.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Ticket className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No tickets yet. Add your first ticket type below.</p>
          </CardContent>
        </Card>
      )}

      {tickets.map(ticket => (
        <Card key={ticket.id}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={ticket.name}
                    onChange={e => updateTicket(ticket.id, { name: e.target.value })}
                    className="h-8 text-sm font-semibold"
                  />
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {ticket.quantity_sold}/{ticket.quantity_available} sold
                  </Badge>
                </div>
              <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Price (pts):</span>
                  <Input
                    type="number"
                    value={ticket.price_cents}
                    onChange={e => updateTicket(ticket.id, { price_cents: parseInt(e.target.value) || 0 })}
                    className="h-7 text-xs w-24"
                  />
                  <span className="text-xs text-muted-foreground ml-2">Qty:</span>
                  <Input
                    type="number"
                    value={ticket.quantity_available}
                    onChange={e => updateTicket(ticket.id, { quantity_available: parseInt(e.target.value) || 0 })}
                    className="h-7 text-xs w-20"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className="text-xs text-muted-foreground">🍹 Drink off:</span>
                  <Input type="number" value={ticket.perk_drink_discount} onChange={e => updateTicket(ticket.id, { perk_drink_discount: parseInt(e.target.value) || 0 } as any)} className="h-7 text-xs w-16" />
                  <span className="text-xs text-muted-foreground">%</span>
                  <span className="text-xs text-muted-foreground ml-1">⚡ Priority:</span>
                  <Switch checked={ticket.perk_priority_queue} onCheckedChange={checked => updateTicket(ticket.id, { perk_priority_queue: checked } as any)} />
                  <span className="text-xs text-muted-foreground ml-1">🗳️ Bonus:</span>
                  <Input type="number" value={ticket.perk_bonus_votes} onChange={e => updateTicket(ticket.id, { perk_bonus_votes: parseInt(e.target.value) || 0 } as any)} className="h-7 text-xs w-16" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={ticket.is_active}
                  onCheckedChange={checked => updateTicket(ticket.id, { is_active: checked })}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTicket(ticket.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Ticket Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Ticket name (e.g. General Admission)" value={newTicket.name} onChange={e => setNewTicket({ ...newTicket, name: e.target.value })} />
          <Input placeholder="Description (optional)" value={newTicket.description} onChange={e => setNewTicket({ ...newTicket, description: e.target.value })} />
          <div className="flex gap-2">
            <Input type="number" placeholder="Price (points)" value={newTicket.price} onChange={e => setNewTicket({ ...newTicket, price: e.target.value })} className="flex-1" />
            <Input type="number" placeholder="Quantity" value={newTicket.quantity} onChange={e => setNewTicket({ ...newTicket, quantity: e.target.value })} className="w-24" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground pt-1">VIP Perks (optional)</p>
          <div className="flex gap-2 items-center flex-wrap">
            <Input type="number" placeholder="Drink discount %" value={newTicket.drinkDiscount} onChange={e => setNewTicket({ ...newTicket, drinkDiscount: e.target.value })} className="w-32" />
            <label className="flex items-center gap-1.5 text-xs"><Switch checked={newTicket.priorityQueue} onCheckedChange={checked => setNewTicket({ ...newTicket, priorityQueue: checked })} /> Priority Queue</label>
            <Input type="number" placeholder="Bonus votes" value={newTicket.bonusVotes} onChange={e => setNewTicket({ ...newTicket, bonusVotes: e.target.value })} className="w-28" />
          </div>
          <Button onClick={addTicket} disabled={saving || !newTicket.name.trim()} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Ticket
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
