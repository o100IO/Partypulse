import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Building2, Calendar, Coins, Music, Loader2, Shield, RefreshCw,
} from 'lucide-react';

type AppRole = 'admin' | 'venue_owner' | 'dj' | 'bartender' | 'guest';

interface Stats {
  users: number;
  venues: number;
  events: number;
  liveEvents: number;
  requests: number;
  tips: number;
}

interface UserRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  points_balance: number;
  roles: AppRole[];
}

interface VenueRow {
  id: string;
  name: string;
  address: string | null;
  owner_id: string;
  created_at: string;
}

interface EventRow {
  id: string;
  name: string;
  status: string;
  start_time: string;
  dj_id: string;
  venue_id: string | null;
}

export default function AdminDashboard() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    users: 0, venues: 0, events: 0, liveEvents: 0, requests: 0, tips: 0,
  });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [userFilter, setUserFilter] = useState('');
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [
        profilesRes,
        rolesRes,
        venuesRes,
        eventsRes,
        requestsRes,
        tipsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, email, points_balance').order('display_name'),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('venues').select('id, name, address, owner_id, created_at').order('created_at', { ascending: false }),
        supabase.from('events').select('id, name, status, start_time, dj_id, venue_id').order('start_time', { ascending: false }),
        supabase.from('song_requests').select('id', { count: 'exact', head: true }),
        supabase.from('tips').select('id', { count: 'exact', head: true }),
      ]);

      const rolesByUser = new Map<string, AppRole[]>();
      (rolesRes.data || []).forEach((r) => {
        const list = rolesByUser.get(r.user_id) || [];
        list.push(r.role as AppRole);
        rolesByUser.set(r.user_id, list);
      });

      const userRows: UserRow[] = (profilesRes.data || []).map((p) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        email: p.email,
        points_balance: p.points_balance,
        roles: rolesByUser.get(p.user_id) || [],
      }));

      const eventRows = (eventsRes.data || []) as EventRow[];

      setUsers(userRows);
      setVenues((venuesRes.data || []) as VenueRow[]);
      setEvents(eventRows);
      setStats({
        users: userRows.length,
        venues: venuesRes.data?.length || 0,
        events: eventRows.length,
        liveEvents: eventRows.filter((e) => e.status === 'live').length,
        requests: requestsRes.count || 0,
        tips: tipsRes.count || 0,
      });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Failed to load admin data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const setPrimaryRole = async (userId: string, newRole: AppRole) => {
    setSavingRole(userId);
    try {
      // Replace non-admin roles with the selected one; keep admin if present
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id, role')
        .eq('user_id', userId);

      const hasAdmin = (existing || []).some((r) => r.role === 'admin');
      const toDelete = (existing || []).filter((r) => r.role !== 'admin');
      if (toDelete.length) {
        await supabase.from('user_roles').delete().in('id', toDelete.map((r) => r.id));
      }
      if (newRole !== 'admin' || !hasAdmin) {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });
        if (error && !/duplicate|unique/i.test(error.message)) throw error;
      }
      toast({ title: 'Role updated' });
      await load();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Could not update role' });
    } finally {
      setSavingRole(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = userFilter.toLowerCase();
    if (!q) return true;
    return (
      (u.display_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      u.roles.some((r) => r.includes(q))
    );
  });

  return (
    <MainLayout showFooter={false}>
      <div className="container py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-7 w-7 text-primary" />
              Admin dashboard
            </h1>
            <p className="text-muted-foreground">
              Signed in as {profile?.display_name || user?.email}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" asChild>
              <Link to="/settings">Account / reset password</Link>
            </Button>
          </div>
        </div>

        {loading && users.length === 0 ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {[
                { label: 'Users', value: stats.users, icon: Users },
                { label: 'Venues', value: stats.venues, icon: Building2 },
                { label: 'Events', value: stats.events, icon: Calendar },
                { label: 'Live now', value: stats.liveEvents, icon: Music },
                { label: 'Requests', value: stats.requests, icon: Music },
                { label: 'Tips', value: stats.tips, icon: Coins },
              ].map((s) => (
                <Card key={s.label}>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                    <s.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{s.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Tabs defaultValue="users">
              <TabsList>
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="venues">Venues</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
              </TabsList>

              <TabsContent value="users" className="space-y-4">
                <Input
                  placeholder="Search name, email, role…"
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="max-w-sm"
                />
                <div className="space-y-2">
                  {filteredUsers.map((u) => (
                    <Card key={u.user_id}>
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                        <div>
                          <p className="font-medium">{u.display_name || 'Unnamed'}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {u.roles.map((r) => (
                              <Badge key={r} variant={r === 'admin' ? 'default' : 'secondary'}>{r}</Badge>
                            ))}
                            <Badge variant="outline">{u.points_balance} pts</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            disabled={savingRole === u.user_id || u.roles.includes('admin')}
                            onValueChange={(v) => setPrimaryRole(u.user_id, v as AppRole)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Set role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="guest">guest</SelectItem>
                              <SelectItem value="dj">dj</SelectItem>
                              <SelectItem value="venue_owner">venue_owner</SelectItem>
                              <SelectItem value="bartender">bartender</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground py-8 text-center">No users found.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="venues" className="space-y-2">
                {venues.map((v) => (
                  <Card key={v.id}>
                    <CardHeader className="py-4">
                      <CardTitle className="text-base">{v.name}</CardTitle>
                      <CardDescription>{v.address || 'No address'} · owner {v.owner_id.slice(0, 8)}…</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
                {venues.length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center">No venues yet.</p>
                )}
              </TabsContent>

              <TabsContent value="events" className="space-y-2">
                {events.map((ev) => (
                  <Card key={ev.id}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{ev.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(ev.start_time).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={ev.status === 'live' ? 'default' : 'secondary'}>{ev.status}</Badge>
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/e/${ev.id}`}>Open</Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/dj/events/${ev.id}`}>Manage</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {events.length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center">No events yet.</p>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </MainLayout>
  );
}
