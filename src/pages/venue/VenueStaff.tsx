import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Plus, Trash2, User } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface StaffMember {
  id: string;
  user_id: string;
  role: AppRole;
  profile: {
    display_name: string | null;
    email: string | null;
  } | null;
}

interface Venue {
  id: string;
  name: string;
}

export default function VenueStaff() {
  const { venueId } = useParams<{ venueId: string }>();
  const { toast } = useToast();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'dj' | 'bartender'>('dj');

  useEffect(() => {
    if (venueId) {
      fetchData();
    }
  }, [venueId]);

  const fetchData = async () => {
    try {
      // Fetch venue
      const { data: venueData, error: venueError } = await supabase
        .from('venues')
        .select('id, name')
        .eq('id', venueId)
        .single();

      if (venueError) throw venueError;
      setVenue(venueData);

      // Fetch staff
      const { data: staffData, error: staffError } = await supabase
        .from('venue_staff')
        .select('id, user_id, role')
        .eq('venue_id', venueId);

      if (staffError) throw staffError;

      // Fetch profiles for staff
      const staffWithProfiles = await Promise.all(
        (staffData || []).map(async (s) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, email')
            .eq('user_id', s.user_id)
            .single();
          return { ...s, profile };
        })
      );

      setStaff(staffWithProfiles);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: 'Error loading data',
        description: 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const addStaff = async () => {
    if (!newStaffEmail || !venueId) return;

    setAddingStaff(true);
    try {
      // Find user by email
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', newStaffEmail)
        .single();

      if (profileError || !profileData) {
        throw new Error('User not found with that email');
      }

      // Add to venue staff
      const { error: staffError } = await supabase.from('venue_staff').insert({
        venue_id: venueId,
        user_id: profileData.user_id,
        role: newStaffRole,
      });

      if (staffError) {
        if (staffError.code === '23505') {
          throw new Error('This user is already a staff member');
        }
        throw staffError;
      }

      toast({
        title: 'Staff member added',
        description: 'They can now be assigned to events at this venue.',
      });

      setAddDialogOpen(false);
      setNewStaffEmail('');
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to add staff',
        description: error.message || 'Please try again.',
      });
    } finally {
      setAddingStaff(false);
    }
  };

  const removeStaff = async (staffId: string) => {
    try {
      const { error } = await supabase.from('venue_staff').delete().eq('id', staffId);

      if (error) throw error;

      toast({
        title: 'Staff member removed',
      });

      setStaff(staff.filter((s) => s.id !== staffId));
    } catch (error) {
      console.error('Error removing staff:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to remove staff',
        description: 'Please try again.',
      });
    }
  };

  const getRoleBadge = (role: AppRole) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
      dj: { variant: 'default', label: 'DJ' },
      bartender: { variant: 'secondary', label: 'Bartender' },
    };
    const config = variants[role] || { variant: 'outline', label: role };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <MainLayout showFooter={false}>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showFooter={false}>
      <div className="container py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to={`/venue/${venueId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to {venue?.name || 'Venue'}
          </Link>
        </Button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Staff Management</h1>
            <p className="text-muted-foreground">Manage DJs and bartenders for {venue?.name}</p>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Staff Member</DialogTitle>
                <DialogDescription>Add a DJ or bartender to this venue</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    placeholder="staff@example.com"
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={newStaffRole} onValueChange={(v) => setNewStaffRole(v as 'dj' | 'bartender')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dj">DJ</SelectItem>
                      <SelectItem value="bartender">Bartender</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addStaff} disabled={addingStaff || !newStaffEmail} className="w-full">
                  {addingStaff && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Staff Member
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current Staff</CardTitle>
            <CardDescription>
              {staff.length} staff member{staff.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {staff.length === 0 ? (
              <div className="text-center py-8">
                <User className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold mb-2">No staff yet</h3>
                <p className="text-muted-foreground mb-4">Add DJs and bartenders to your venue.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {staff.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{member.profile?.display_name || 'Unknown'}</h4>
                        <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getRoleBadge(member.role)}
                      <Button variant="ghost" size="icon" onClick={() => removeStaff(member.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
