import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Music, Mic2, Building2, Users } from 'lucide-react';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().min(2, 'Name must be at least 2 characters').optional(),
});

type RoleOption = 'venue_owner' | 'dj' | 'bartender' | 'guest';

const roleOptions: { value: RoleOption; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'dj', label: 'DJ', icon: <Music className="h-5 w-5" />, description: 'Host events & manage requests' },
  { value: 'venue_owner', label: 'Venue Owner', icon: <Building2 className="h-5 w-5" />, description: 'Manage venues & staff' },
  { value: 'bartender', label: 'Bartender', icon: <Mic2 className="h-5 w-5" />, description: 'Receive tips from guests' },
  { value: 'guest', label: 'Guest', icon: <Users className="h-5 w-5" />, description: 'Request songs & earn points' },
];

export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signIn, signUp, user, role } = useAuth();
  const { toast } = useToast();

  const mode = searchParams.get('mode');
  const [isSignUp, setIsSignUp] = useState(mode === 'signup');
  const [isForgot, setIsForgot] = useState(mode === 'forgot');
  const [isReset, setIsReset] = useState(mode === 'reset');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleOption>('guest');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; displayName?: string }>({});

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsReset(true);
        setIsForgot(false);
        setIsSignUp(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && !isReset) {
      if (role === 'admin') navigate('/admin');
      else navigate('/');
    }
  }, [user, role, navigate, isReset]);

  useEffect(() => {
    setIsSignUp(mode === 'signup');
    setIsForgot(mode === 'forgot');
    setIsReset(mode === 'reset');
    const roleParam = searchParams.get('role');
    if (roleParam === 'dj' || roleParam === 'venue') {
      setSelectedRole(roleParam === 'venue' ? 'venue_owner' : 'dj');
    }
  }, [searchParams, mode]);

  const validateForm = () => {
    try {
      authSchema.parse({
        email: isReset ? 'reset@placeholder.com' : email,
        password: isForgot ? '123456' : password,
        displayName: isSignUp ? displayName : undefined,
      });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: { email?: string; password?: string; displayName?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as keyof typeof newErrors] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrors({ email: 'Enter your email' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      if (error) throw error;
      toast({
        title: 'Reset email sent',
        description: 'Check your inbox for a link to set a new password.',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not send reset email',
        description: err instanceof Error ? err.message : 'Try again',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setErrors({ password: 'Password must be at least 6 characters' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: 'Password updated', description: 'You are signed in with your new password.' });
      navigate(role === 'admin' ? '/admin' : '/');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not update password',
        description: err instanceof Error ? err.message : 'Open the link from your email again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, selectedRole, displayName);
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Sign up failed',
            description: error.message.includes('already registered')
              ? 'This email is already registered. Try signing in instead.'
              : error.message,
          });
        } else {
          toast({ title: 'Account created!', description: 'Welcome to Partypulse!' });
          navigate('/');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Sign in failed',
            description: 'Invalid email or password. Please try again.',
          });
        }
        // redirect handled by useEffect once role loads
      }
    } finally {
      setLoading(false);
    }
  };

  const title = isReset
    ? 'Set new password'
    : isForgot
      ? 'Reset password'
      : isSignUp
        ? 'Create Account'
        : 'Welcome Back';

  return (
    <MainLayout showFooter={false}>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>
              {isReset && 'Choose a new password for your account.'}
              {isForgot && 'We will email you a reset link (use your admin or account email).'}
              {isSignUp && 'Join Partypulse and start your music journey'}
              {!isReset && !isForgot && !isSignUp && 'Sign in to your Partypulse account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isForgot ? (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
                <p className="text-center text-sm">
                  <Link to="/auth" className="text-primary hover:underline font-medium">Back to sign in</Link>
                </p>
              </form>
            ) : isReset ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={errors.password ? 'border-destructive' : ''}
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update password
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input
                        id="displayName"
                        placeholder="Your name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className={errors.displayName ? 'border-destructive' : ''}
                      />
                      {errors.displayName && (
                        <p className="text-sm text-destructive">{errors.displayName}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>I am a...</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {roleOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSelectedRole(option.value)}
                            className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                              selectedRole === option.value
                                ? 'border-primary bg-accent'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className={selectedRole === option.value ? 'text-primary' : 'text-muted-foreground'}>
                              {option.icon}
                            </div>
                            <span className="text-sm font-medium">{option.label}</span>
                            <span className="text-xs text-muted-foreground text-center">{option.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={errors.password ? 'border-destructive' : ''}
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Button>
              </form>
            )}

            {!isReset && !isForgot && (
              <div className="mt-6 text-center text-sm space-y-2">
                {isSignUp ? (
                  <p>
                    Already have an account?{' '}
                    <Link to="/auth" className="text-primary hover:underline font-medium">Sign in</Link>
                  </p>
                ) : (
                  <>
                    <p>
                      <Link to="/auth?mode=forgot" className="text-primary hover:underline font-medium">
                        Forgot password?
                      </Link>
                    </p>
                    <p>
                      Don't have an account?{' '}
                      <Link to="/auth?mode=signup" className="text-primary hover:underline font-medium">Sign up</Link>
                    </p>
                    <p className="text-xs text-muted-foreground pt-2">
                      Platform admin?{' '}
                      <Link to="/admin/setup" className="text-primary hover:underline">First-time setup</Link>
                      {' · '}
                      <Link to="/admin" className="text-primary hover:underline">Dashboard</Link>
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
