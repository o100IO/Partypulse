import { Logo } from './Logo';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-4">
            <Logo size="sm" />
            <p className="text-sm text-muted-foreground">
              The ultimate platform for DJs, venues, and guests to connect through music requests, voting, and tipping.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">For DJs</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/auth?mode=signup&role=dj" className="hover:text-primary transition-colors">Sign Up</Link></li>
              <li><Link to="/features/dj" className="hover:text-primary transition-colors">Features</Link></li>
              <li><Link to="/pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">For Venues</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/auth?mode=signup&role=venue" className="hover:text-primary transition-colors">Sign Up</Link></li>
              <li><Link to="/features/venue" className="hover:text-primary transition-colors">Features</Link></li>
              <li><Link to="/enterprise" className="hover:text-primary transition-colors">Enterprise</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/help" className="hover:text-primary transition-colors">Help Center</Link></li>
              <li><Link to="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
              <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} EventPulse. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
