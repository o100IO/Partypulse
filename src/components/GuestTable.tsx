import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { TableOrderCard } from '@/components/TableOrderCard';
import { Loader2, Plus, ShoppingCart, Coins, MapPin, Check, Minus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface MenuItem {
  id: string;
  name: string;
  emoji: string;
  price_cents: number;
  category: string;
}

interface TableOrder {
  id: string;
  item_name: string;
  item_emoji: string;
  quantity: number;
  price_cents: number;
  status: string;
  created_at: string;
}

interface ActiveDiscount {
  discount_percent: number | null;
  discount_categories: string[] | null;
}

interface GuestTableProps {
  eventId: string;
  venueId: string | null;
  userBalance: number;
  onBalanceUpdate: (balance: number) => void;
  activeDiscounts?: ActiveDiscount[];
}

interface CartItem {
  menuItem: MenuItem;
  qty: number;
}

const CATEGORIES = [
  { key: 'all', label: 'All', icon: '🍽️' },
  { key: 'beers', label: 'Beers', icon: '🍺' },
  { key: 'cocktails', label: 'Cocktails', icon: '🍹' },
  { key: 'mixed', label: 'Mixed', icon: '🥃' },
  { key: 'shots', label: 'Shots', icon: '🔥' },
  { key: 'bottles', label: 'Bottles', icon: '🍾' },
  { key: 'non-alcoholic', label: 'NA', icon: '💧' },
];

const TABLE_PRESETS = [
  { label: 'VIP 1', icon: '👑' },
  { label: 'VIP 2', icon: '👑' },
  { label: 'Booth A', icon: '🛋️' },
  { label: 'Booth B', icon: '🛋️' },
  { label: 'Bar Left', icon: '🍸' },
  { label: 'Bar Right', icon: '🍸' },
  { label: 'Patio', icon: '🌙' },
  { label: 'Dance Floor', icon: '💃' },
];

export function GuestTable({ eventId, venueId, userBalance, onBalanceUpdate, activeDiscounts = [] }: GuestTableProps) {
  // Calculate best discount for a given category
  const getDiscountedPrice = (priceCents: number, category: string) => {
    let bestDiscount = 0;
    for (const d of activeDiscounts) {
      const pct = d.discount_percent || 0;
      const cats = d.discount_categories || [];
      if (pct > bestDiscount && (cats.length === 0 || cats.includes(category))) {
        bestDiscount = pct;
      }
    }
    if (bestDiscount === 0) return { price: priceCents, discounted: false, original: priceCents };
    return { price: Math.round(priceCents * (1 - bestDiscount / 100)), discounted: true, original: priceCents };
  };
  const { user } = useAuth();
  const { toast } = useToast();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<TableOrder[]>([]);
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableName, setTableName] = useState('');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [category, setCategory] = useState('all');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [customTableName, setCustomTableName] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user?.id) loadData();
  }, [eventId, user?.id]);

  const loadData = async () => {
    try {
      let query = supabase
        .from('venue_menu_items')
        .select('id, name, emoji, price_cents, category')
        .eq('is_active', true)
        .order('sort_order');

      if (venueId) query = query.eq('venue_id', venueId);
      else query = query.eq('event_id', eventId);

      const { data: menuData } = await query;
      setMenuItems((menuData as MenuItem[]) || []);

      const { data: tableData } = await supabase
        .from('guest_tables')
        .select('id, table_name')
        .eq('event_id', eventId)
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle();

      if (tableData) {
        setTableId(tableData.id);
        setTableName(tableData.table_name || 'My Table');
        await fetchOrders(tableData.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async (tId: string) => {
    const { data } = await supabase
      .from('table_orders')
      .select('*')
      .eq('table_id', tId)
      .order('created_at', { ascending: false });
    setOrders((data as TableOrder[]) || []);
  };

  const openTable = async (name: string) => {
    if (!user?.id || !name.trim()) return;
    try {
      const { data, error } = await supabase
        .from('guest_tables')
        .insert({ event_id: eventId, user_id: user.id, table_name: name.trim() })
        .select('id, table_name')
        .single();
      if (error) throw error;
      setTableId(data.id);
      setTableName(data.table_name);
      toast({ title: `🍽️ Seated at ${name.trim()}!` });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Failed to open table' });
    }
  };

  // Cart helpers
  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id);
      if (existing) return prev.map(c => c.menuItem.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { menuItem: item, qty: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === itemId);
      if (!existing) return prev;
      if (existing.qty <= 1) return prev.filter(c => c.menuItem.id !== itemId);
      return prev.map(c => c.menuItem.id === itemId ? { ...c, qty: c.qty - 1 } : c);
    });
  };

  const getCartQty = (itemId: string) => cart.find(c => c.menuItem.id === itemId)?.qty || 0;
  const cartTotal = cart.reduce((sum, c) => sum + getDiscountedPrice(c.menuItem.price_cents, c.menuItem.category).price * c.qty, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  const placeOrder = async () => {
    if (!user?.id || !tableId || cart.length === 0) return;
    if (userBalance < cartTotal) {
      toast({ variant: 'destructive', title: 'Not enough points' });
      return;
    }
    setPlacing(true);
    try {
      // Server prices, charges and records the order atomically
      const { data, error } = await supabase.rpc('place_table_order', {
        p_table_id: tableId,
        p_items: cart.map(c => ({ menu_item_id: c.menuItem.id, quantity: c.qty })),
      });
      if (error) throw error;

      const result = data as { success: boolean; error?: string; total?: number; new_balance?: number };
      if (!result?.success) {
        toast({ variant: 'destructive', title: result?.error || 'Failed to place order' });
        return;
      }

      onBalanceUpdate(result.new_balance ?? userBalance);
      setCart([]);
      await fetchOrders(tableId);
      toast({ title: `🎉 Order placed!`, description: `${cartCount} items on the way` });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Failed to place order' });
    } finally {
      setPlacing(false);
    }
  };

  if (!user) {
    return (
      <Card className="glass-card">
        <CardContent className="py-8 text-center">
          <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Sign in to open a table and order drinks</p>
          <Button size="sm" variant="outline" className="mt-3 rounded-full" asChild>
            <Link to="/auth">Sign Up</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // ─── Table Selection Screen ───
  if (!tableId) {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <MapPin className="mx-auto h-8 w-8 text-primary" />
          <h3 className="text-lg font-bold">Where are you sitting?</h3>
          <p className="text-sm text-muted-foreground">Pick your spot to start ordering</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TABLE_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => setSelectedTable(selectedTable === preset.label ? null : preset.label)}
              className={cn(
                'flex items-center gap-3 rounded-xl border-2 p-3 transition-all text-left',
                selectedTable === preset.label
                  ? 'border-primary bg-primary/10 shadow-md scale-[1.02]'
                  : 'border-border hover:border-primary/40 hover:shadow-sm'
              )}
            >
              <span className="text-2xl">{preset.icon}</span>
              <span className="text-sm font-medium">{preset.label}</span>
              {selectedTable === preset.label && (
                <Check className="h-4 w-4 text-primary ml-auto" />
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Or type your own..."
            value={customTableName}
            onChange={e => { setCustomTableName(e.target.value); setSelectedTable(null); }}
            className="rounded-xl"
          />
        </div>
        <Button
          onClick={() => openTable(selectedTable || customTableName || 'My Table')}
          disabled={!selectedTable && !customTableName.trim()}
          className="w-full rounded-xl h-12 text-base gap-2"
        >
          <Plus className="h-5 w-5" />
          Open Table {selectedTable ? `at ${selectedTable}` : customTableName ? `"${customTableName}"` : ''}
        </Button>
      </div>
    );
  }

  // Filter + search
  const filteredItems = menuItems
    .filter(i => category === 'all' || i.category === category)
    .filter(i => !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  return (
    <div className="space-y-3">
      {/* Table info */}
      <div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold">{tableName}</span>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 animate-pulse">
              {pendingCount} pending
            </Badge>
          )}
        </div>
        <span className="text-sm font-semibold flex items-center gap-1.5">
          <Coins className="h-4 w-4 text-primary" /> {userBalance} pts
        </span>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search menu..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9 rounded-xl h-9 text-sm"
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={cn(
              'shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
              category === cat.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            )}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Menu list — easy-to-tap rows */}
      {filteredItems.length > 0 ? (
        <div className="space-y-1.5">
          {filteredItems.map(item => {
            const qty = getCartQty(item.id);
            const { price, discounted, original } = getDiscountedPrice(item.price_cents, item.category);
            const tooExpensive = price > userBalance;
            return (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-2.5 transition-all',
                  qty > 0 ? 'border-primary/30 bg-primary/5' : 'border-border bg-card',
                  discounted && qty === 0 && 'border-primary/20 bg-primary/[0.03]',
                  tooExpensive && qty === 0 && 'opacity-50'
                )}
              >
                <span className="text-2xl w-9 text-center shrink-0">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <div className="flex items-center gap-1.5">
                    {discounted ? (
                      <>
                        <span className="text-xs font-bold text-primary">{price} pts</span>
                        <span className="text-[10px] text-muted-foreground line-through">{original}</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-primary/10 text-primary border-0">DEAL</Badge>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground font-semibold">{price} pts</span>
                    )}
                  </div>
                </div>

                {/* Quantity controls */}
                {qty > 0 ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-full"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm font-bold text-primary">{qty}</span>
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => addToCart(item)}
                      disabled={tooExpensive}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full h-8 px-3 text-xs shrink-0"
                    onClick={() => addToCart(item)}
                    disabled={tooExpensive}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {searchQuery ? 'No items match your search' : 'No items in this category'}
          </CardContent>
        </Card>
      )}

      {/* Sticky cart summary */}
      {cart.length > 0 && (
        <div className="sticky bottom-16 md:bottom-2 z-20 rounded-2xl bg-primary text-primary-foreground p-3 shadow-lg shadow-primary/30 animate-slide-up">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-sm font-bold">{cartCount} item{cartCount > 1 ? 's' : ''}</span>
            </div>
            <span className="text-sm font-bold">{cartTotal} pts</span>
          </div>
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {cart.map(c => (
              <span key={c.menuItem.id} className="text-xs bg-primary-foreground/15 rounded-full px-2 py-0.5">
                {c.qty}x {c.menuItem.emoji} {c.menuItem.name}
              </span>
            ))}
          </div>
          <Button
            onClick={placeOrder}
            disabled={placing || cartTotal > userBalance}
            className="w-full rounded-xl bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold h-10"
          >
            {placing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {cartTotal > userBalance ? 'Not Enough Points' : 'Place Order'}
          </Button>
        </div>
      )}

      {/* Past orders */}
      {orders.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Past Orders ({orders.length})
          </h3>
          {orders.map(order => (
            <TableOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
