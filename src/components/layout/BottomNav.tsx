import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Home, Radio, User, LayoutDashboard, Settings, Music, Store, Wine, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

function getNavItems(role: string | null, isAuthenticated: boolean): NavItem[] {
  if (!isAuthenticated) {
    return [
      { icon: Home, label: 'Home', path: '/' },
      { icon: Radio, label: 'Events', path: '/events' },
      { icon: User, label: 'Sign In', path: '/auth' },
    ];
  }

  const common: NavItem[] = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Radio, label: 'Events', path: '/events' },
  ];

  switch (role) {
    case 'admin':
      return [
        ...common,
        { icon: Shield, label: 'Admin', path: '/admin' },
        { icon: Settings, label: 'Settings', path: '/settings' },
      ];
    case 'dj':
      return [
        ...common,
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dj/dashboard' },
        { icon: Music, label: 'My Events', path: '/dj/events' },
        { icon: Settings, label: 'Settings', path: '/settings' },
      ];
    case 'venue_owner':
      return [
        ...common,
        { icon: Store, label: 'Venue', path: '/venue/dashboard' },
        { icon: Music, label: 'DJ Panel', path: '/dj/dashboard' },
        { icon: Settings, label: 'Settings', path: '/settings' },
      ];
    case 'bartender':
      return [
        ...common,
        { icon: Wine, label: 'Orders', path: '/bartender/dashboard' },
        { icon: Settings, label: 'Settings', path: '/settings' },
      ];
    default: // guest
      return [
        ...common,
        { icon: User, label: 'Profile', path: '/guest/profile' },
        { icon: Settings, label: 'Settings', path: '/settings' },
      ];
  }
}

export function BottomNav() {
  const { user, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Hide on guest event page (has its own FAB + tabs)
  if (location.pathname.startsWith('/e/')) return null;

  const items = getNavItems(role, !!user);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="glass border-t border-border/60 px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around">
          {items.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 px-3 min-w-[56px] transition-all duration-200',
                  isActive
                    ? 'text-primary scale-105'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5 transition-all', isActive && 'drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]')} />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
