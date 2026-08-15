import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, GripVertical, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuItem {
  id: string;
  name: string;
  emoji: string;
  price_cents: number;
  category: string;
  is_active: boolean;
  sort_order: number;
}

interface VenueMenuManagerProps {
  venueId?: string;
  eventId?: string;
}

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'beers', label: '🍺 Beers' },
  { key: 'cocktails', label: '🍹 Cocktails' },
  { key: 'mixed', label: '🥃 Mixed' },
  { key: 'shots', label: '🔥 Shots' },
  { key: 'bottles', label: '🍾 Bottles' },
  { key: 'non-alcoholic', label: '💧 NA' },
  { key: 'drinks', label: '🥤 Other' },
];

const CATEGORY_OPTIONS = CATEGORIES.filter(c => c.key !== 'all');

export function VenueMenuManager({ venueId, eventId }: VenueMenuManagerProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [newItem, setNewItem] = useState({ name: '', emoji: '🍹', price: '', category: 'beers' });
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState('');

  useEffect(() => {
    fetchItems();
  }, [venueId, eventId]);

  const fetchItems = async () => {
    try {
      if (venueId) {
        await supabase.rpc('seed_default_menu_items', { p_venue_id: venueId });
      }
      let query = supabase.from('venue_menu_items').select('*').order('sort_order');
      if (venueId) query = query.eq('venue_id', venueId);
      else if (eventId) query = query.eq('event_id', eventId);
      else { setLoading(false); return; }

      const { data, error } = await query;
      if (error) throw error;
      setItems((data as MenuItem[]) || []);
    } catch (err) {
      console.error('Error fetching menu:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateItem = async (id: string, updates: Partial<MenuItem>) => {
    try {
      const { error } = await supabase.from('venue_menu_items').update(updates).eq('id', id);
      if (error) throw error;
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Failed to update' });
    }
  };

  const addItem = async () => {
    if (!newItem.name.trim() || !newItem.price) return;
    setSaving(true);
    try {
      const insertData = {
        name: newItem.name,
        emoji: newItem.emoji,
        price_cents: Math.round(parseFloat(newItem.price) * 100),
        category: newItem.category,
        sort_order: items.length + 1,
        venue_id: venueId || null,
        event_id: !venueId ? (eventId || null) : null,
      };
      const { data, error } = await supabase.from('venue_menu_items').insert(insertData).select().single();
      if (error) throw error;
      setItems(prev => [...prev, data as MenuItem]);
      setNewItem({ name: '', emoji: '🍹', price: '', category: 'beers' });
      toast({ title: 'Item added' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Failed to add item' });
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase.from('venue_menu_items').delete().eq('id', id);
      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== id));
      toast({ title: 'Item removed' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Failed to delete' });
    }
  };

  const startEditPrice = (item: MenuItem) => {
    setEditingPrice(item.id);
    setTempPrice((item.price_cents / 100).toFixed(2));
  };

  const commitPrice = (id: string) => {
    const cents = Math.round(parseFloat(tempPrice || '0') * 100);
    if (cents >= 0) updateItem(id, { price_cents: cents });
    setEditingPrice(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter);

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <Button
            key={cat.key}
            size="sm"
            variant={filter === cat.key ? 'default' : 'outline'}
            className="rounded-full text-xs shrink-0 h-7"
            onClick={() => setFilter(cat.key)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Items list — redesigned */}
      <div className="space-y-1.5">
        {filtered.map(item => (
          <div
            key={item.id}
            className={cn(
              'group flex items-center gap-3 rounded-xl border p-3 transition-all hover:shadow-sm',
              item.is_active ? 'bg-card' : 'bg-muted/40 opacity-60'
            )}
          >
            {/* Emoji editable */}
            <Input
              value={item.emoji}
              onChange={e => updateItem(item.id, { emoji: e.target.value })}
              className="w-11 h-11 text-center text-2xl p-0 border-0 bg-transparent focus:ring-1 focus:ring-primary/30 rounded-lg"
            />

            {/* Name + category */}
            <div className="flex-1 min-w-0 space-y-0.5">
              <Input
                value={item.name}
                onChange={e => updateItem(item.id, { name: e.target.value })}
                className="h-7 text-sm font-medium border-0 bg-transparent px-0 focus:ring-0 focus:bg-muted/30 rounded"
              />
              <Select
                value={item.category}
                onValueChange={v => updateItem(item.id, { category: v })}
              >
                <SelectTrigger className="h-5 w-auto border-0 bg-transparent px-0 text-[10px] text-muted-foreground gap-1 focus:ring-0 [&>svg]:h-3 [&>svg]:w-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(c => (
                    <SelectItem key={c.key} value={c.key} className="text-xs">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price — click-to-edit with big target */}
            <div className="shrink-0">
              {editingPrice === item.id ? (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    autoFocus
                    type="number"
                    step="0.01"
                    min="0"
                    value={tempPrice}
                    onChange={e => setTempPrice(e.target.value)}
                    onBlur={() => commitPrice(item.id)}
                    onKeyDown={e => { if (e.key === 'Enter') commitPrice(item.id); if (e.key === 'Escape') setEditingPrice(null); }}
                    className="w-20 h-8 text-sm font-semibold text-right"
                  />
                </div>
              ) : (
                <button
                  onClick={() => startEditPrice(item)}
                  className="flex items-center gap-0.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary/20 transition-colors min-w-[60px] justify-center"
                >
                  ${(item.price_cents / 100).toFixed(2)}
                </button>
              )}
            </div>

            {/* Active toggle */}
            <Switch
              checked={item.is_active}
              onCheckedChange={checked => updateItem(item.id, { is_active: checked })}
              className="shrink-0"
            />

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={() => deleteItem(item.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">No items in this category</p>
        )}
      </div>

      {/* Add New — cleaner inline form */}
      <Card className="border-dashed border-2">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2"><Plus className="h-4 w-4" /> Add Menu Item</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex gap-2 items-center">
            <Input
              placeholder="🍹"
              value={newItem.emoji}
              onChange={e => setNewItem({ ...newItem, emoji: e.target.value })}
              className="w-12 text-center text-xl h-10"
            />
            <Input
              placeholder="Item name"
              value={newItem.name}
              onChange={e => setNewItem({ ...newItem, name: e.target.value })}
              className="flex-1 h-10"
            />
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newItem.price}
                onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                className="pl-8 h-10 text-base font-medium"
              />
            </div>
            <Select value={newItem.category} onValueChange={v => setNewItem({ ...newItem, category: v })}>
              <SelectTrigger className="w-32 h-10 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map(c => (
                  <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addItem} disabled={saving || !newItem.name.trim()} size="icon" className="h-10 w-10 shrink-0">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
