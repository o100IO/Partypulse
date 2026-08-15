import { Music } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl',
  };

  return (
    <Link to="/" className="flex items-center gap-2 group">
      <div className="gradient-primary rounded-lg p-1.5 shadow-glow group-hover:scale-105 transition-transform">
        <Music className={`${sizeClasses[size]} text-primary-foreground`} />
      </div>
      {showText && (
        <span className={`${textSizeClasses[size]} font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent`}>
          EventPulse
        </span>
      )}
    </Link>
  );
}
