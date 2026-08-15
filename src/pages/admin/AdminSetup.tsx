import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield } from 'lucide-react';

/**
 * One-time bootstrap: create the first platform admin with name + email.
 * Disabled once any admin role exists.
 */
export default function AdminSetup() {
  const navigate = useNavigate();
  const { user, role, signUp, signIn, signOut } = useAuth();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    const check = async () => {
      try {
        const { data, error } = await supabase.rpc('admin_exists');
        if (error) throw error;
        setAdminExists(!!data);
        if (data && role === 'admin') {
          navigate('/admin', { replace: true });
        }
      } catch {
        // Tables/RPC missing — still show form with error on submit
        setAdminExists(false);
      } finally {
        setChecking(false);
      }
    };
    void check();
  }, [role, navigate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || form.displayName.trim().length < 2) {
      toast({ variant: 'destructive', title: 'Fill in name, email, and password (min 6)' });
      return;
    }
    if (form.password.length < 6) {
      toast({ variant: 'destructive', title: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);
    try {
      // Sign out any guest session so we can register the admin cleanly
      if (user) await signOut();

      const { error: signUpError } = await signUp(
        form.email,
        form.password,
        'guest',
        form.displayName.trim()
      );

      // Email confirmation or success — try sign-in (works when confirm is off)
      if (signUpError && signUpError.name !== 'EmailConfirmationRequired') {
        // Maybe account already exists — try sign in
        const { error: signInError } = await signIn(form.email, form.password);
        if (signInError) throw signUpError;
      } else if (signUpError?.name === 'EmailConfirmationRequired') {
        toast({
          variant: 'destructive',
          title: 'Confirm email is enabled',
          description:
            'Turn off Confirm email in Supabase Auth → Providers → Email, then run setup again.',
        });
        return;
      } else {
        // Ensure we have a session
        const { error: signInError } = await signIn(form.email, form.password);
        if (signInError) {
          // Session may already exist from signUp
        }
      }

      const { data, error } = await supabase.rpc('bootstrap_first_admin', {
        p_display_name: form.displayName.trim(),
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Bootstrap failed');
      }

      toast({ title: 'Admin created', description: 'You can use this email for login and password reset.' });
      navigate('/admin', { replace: true });
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Could not create admin',
        description: err instanceof Error ? err.message : 'Try again',
      });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <MainLayout showFooter={false}>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (adminExists) {
    return (
      <MainLayout showFooter={false}>
        <div className="container max-w-md py-16 text-center space-y-4">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Admin already set up</h1>
          <p className="text-muted-foreground">Sign in with the admin email to open the dashboard.</p>
          <Button asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showFooter={false}>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              <Shield className="h-6 w-6 text-primary" />
              Create admin
            </CardTitle>
            <CardDescription>
              One-time setup. This email is used for login and password reset.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-name">Display name</Label>
                <Input
                  id="admin-name"
                  placeholder="Admin name"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create admin account
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
