import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
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
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();

  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleOption>('guest');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; displayName?: string }>({});

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    setIsSignUp(searchParams.get('mode') === 'signup');
    const roleParam = searchParams.get('role');
    if (roleParam === 'dj' || roleParam === 'venue') {
      setSelectedRole(roleParam === 'venue' ? 'venue_owner' : 'dj');
    }
  }, [searchParams]);

  const validateForm = () => {
    try {
      authSchema.parse({
        email,
        password,
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
          toast({
            title: 'Account created!',
            description: 'Welcome to EventPulse! You can now sign in.',
          });
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
        } else {
          navigate('/');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout showFooter={false}>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{isSignUp ? 'Create Account' : 'Welcome Back'}</CardTitle>
            <CardDescription>
              {isSignUp
                ? 'Join EventPulse and start your music journey'
                : 'Sign in to your EventPulse account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
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

            <div className="mt-6 text-center text-sm">
              {isSignUp ? (
                <p>
                  Already have an account?{' '}
                  <Link to="/auth" className="text-primary hover:underline font-medium">
                    Sign in
                  </Link>
                </p>
              ) : (
                <p>
                  Don't have an account?{' '}
                  <Link to="/auth?mode=signup" className="text-primary hover:underline font-medium">
                    Sign up
                  </Link>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
