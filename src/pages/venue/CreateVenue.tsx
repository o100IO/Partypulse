import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CreateVenue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('venues')
        .insert({
          name: formData.name,
          description: formData.description || null,
          address: formData.address || null,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Venue created!',
        description: 'Your venue has been set up successfully.',
      });

      navigate(`/venue/${data.id}`);
    } catch (error: any) {
      console.error('Error creating venue:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to create venue',
        description: error.message || 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout showFooter={false}>
      <div className="container max-w-2xl py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/venue/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Create New Venue</CardTitle>
            <CardDescription>Set up a new venue for your events</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Venue Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., The Blue Note"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="e.g., 123 Music Street, City"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Tell guests about your venue..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || !formData.name}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Venue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
