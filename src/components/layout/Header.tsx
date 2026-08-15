import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';
import { useAuth } from '@/hooks/useAuth';
import { NavLink } from '@/components/NavLink';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, LogOut, Settings, LayoutDashboard, Coins, Radio, Music, Store, Wine, Plus, Shield } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

function DesktopNavLinks({ role, pathname }: { role: string | null; pathname: string }) {
  const linkClass = (path: string) => cn(
    'text-sm font-medium px-3 py-1.5 rounded-full transition-colors',
    pathname === path || (path !== '/' && pathname.startsWith(path))
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
  );

  return (
    <nav className="hidden md:flex items-center gap-1">
      <Link to="/events" className={linkClass('/events')}>
        <span className="flex items-center gap-1.5"><Radio className="h-3.5 w-3.5" />Events</span>
      </Link>
      {role === 'admin' && (
        <Link to="/admin" className={linkClass('/admin')}>
          <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />Admin</span>
        </Link>
      )}
      {role === 'dj' && (
        <>
          <Link to="/dj/dashboard" className={linkClass('/dj/dashboard')}>
            <span className="flex items-center gap-1.5"><LayoutDashboard className="h-3.5 w-3.5" />Dashboard</span>
          </Link>
          <Link to="/dj/events" className={linkClass('/dj/events')}>
            <span className="flex items-center gap-1.5"><Music className="h-3.5 w-3.5" />My Events</span>
          </Link>
        </>
      )}
      {role === 'venue_owner' && (
        <>
          <Link to="/venue/dashboard" className={linkClass('/venue/dashboard')}>
            <span className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5" />Venue</span>
          </Link>
          <Link to="/dj/dashboard" className={linkClass('/dj/dashboard')}>
            <span className="flex items-center gap-1.5"><Music className="h-3.5 w-3.5" />DJ Panel</span>
          </Link>
        </>
      )}
      {role === 'bartender' && (
        <Link to="/bartender/dashboard" className={linkClass('/bartender/dashboard')}>
          <span className="flex items-center gap-1.5"><Wine className="h-3.5 w-3.5" />Orders</span>
        </Link>
      )}
      {role === 'guest' && (
        <Link to="/guest/profile" className={linkClass('/guest/profile')}>
          <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Profile</span>
        </Link>
      )}
    </nav>
  );
}

export function Header() {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b glass">
      <div className="container flex h-14 items-center justify-between gap-4">
        <Logo />

        {user && <DesktopNavLinks role={role} pathname={location.pathname} />}

        <div className="flex items-center gap-2">
          {/* Mobile: just show Events on non-auth pages */}
          {!user && (
            <Button variant="ghost" size="sm" className="md:hidden" asChild>
              <Link to="/events"><Radio className="h-4 w-4" /></Link>
            </Button>
          )}
          {/* Desktop: show Events for non-auth */}
          {!user && (
            <Button variant={location.pathname === '/events' ? 'secondary' : 'ghost'} size="sm" className="hidden md:flex gap-1.5" asChild>
              <Link to="/events"><Radio className="h-3.5 w-3.5" />Events</Link>
            </Button>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'User'} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {profile?.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium leading-none">{profile?.display_name || 'User'}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  {profile && (
                    <div className="flex items-center gap-1 pt-1">
                      <Coins className="h-3 w-3 text-primary" />
                      <span className="text-xs text-primary font-medium">{profile.points_balance} points</span>
                    </div>
                  )}
                </div>
                <DropdownMenuSeparator />
                {role === 'admin' && (
                  <DropdownMenuItem onClick={() => navigate('/admin')}>
                    <Shield className="mr-2 h-4 w-4" />
                    Admin dashboard
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/auth?mode=signup">Get Started</Link>
              </Button>
            </div>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
