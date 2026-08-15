import { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';

interface MainLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
  hideBottomNav?: boolean;
}

export function MainLayout({ children, showFooter = true, hideBottomNav = false }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      {showFooter && <Footer />}
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
