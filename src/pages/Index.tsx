import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import {
  Music,
  QrCode,
  Vote,
  DollarSign,
  BarChart3,
  Smartphone,
  Users,
  Zap,
  ArrowRight,
  Play,
  ThumbsUp,
  Mic2,
} from 'lucide-react';

export default function Index() {
  const { user, role } = useAuth();

  const getDashboardLink = () => {
    switch (role) {
      case 'venue_owner':
        return '/venue/dashboard';
      case 'dj':
        return '/dj/dashboard';
      case 'bartender':
        return '/bartender/dashboard';
      default:
        return '/guest/profile';
    }
  };

  const features = [
    {
      icon: <QrCode className="h-6 w-6" />,
      title: 'One QR Code',
      description: 'Single QR code for all your events. Print table signs & share easily.',
    },
    {
      icon: <Music className="h-6 w-6" />,
      title: 'Song Search',
      description: 'Guests search YouTube & Spotify to find and request their favorite songs.',
    },
    {
      icon: <Vote className="h-6 w-6" />,
      title: 'Vote System',
      description: 'Point-weighted voting lets guests boost songs up the queue.',
    },
    {
      icon: <DollarSign className="h-6 w-6" />,
      title: 'Tipping',
      description: 'Secure tipping for DJs and bartenders via Stripe integration.',
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: 'Analytics',
      description: 'Track requests, tips, and engagement to improve your events.',
    },
    {
      icon: <Smartphone className="h-6 w-6" />,
      title: 'Mobile First',
      description: 'Beautiful experience on any device for guests and hosts alike.',
    },
  ];

  const howItWorks = [
    {
      step: 1,
      icon: <QrCode className="h-8 w-8" />,
      title: 'Scan & Join',
      description: 'Guests scan the QR code to instantly access your event.',
    },
    {
      step: 2,
      icon: <Music className="h-8 w-8" />,
      title: 'Request Songs',
      description: 'Search YouTube or Spotify and submit song requests.',
    },
    {
      step: 3,
      icon: <ThumbsUp className="h-8 w-8" />,
      title: 'Vote & Boost',
      description: 'Use points to vote and boost songs up the queue.',
    },
    {
      step: 4,
      icon: <Play className="h-8 w-8" />,
      title: 'DJ Plays',
      description: 'The DJ manages the queue and plays the hits.',
    },
  ];

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-accent/50 to-background py-20 lg:py-32">
        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Zap className="h-4 w-4" />
              The Future of Event Music
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Let Your Crowd{' '}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Choose the Music
              </span>
            </h1>
            <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
              EventPulse connects DJs, venues, and guests through song requests, voting, and tipping.
              Create unforgettable events where everyone has a voice.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              {user ? (
                <Button size="lg" asChild>
                  <Link to={getDashboardLink()}>
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" asChild>
                    <Link to="/auth?mode=signup&role=dj">
                      Start as DJ
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/auth?mode=signup&role=venue">I'm a Venue Owner</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </section>

      {/* Features Grid */}
      <section className="py-20 lg:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Everything You Need
            </h2>
            <p className="text-lg text-muted-foreground">
              A complete platform for managing song requests, tips, and event engagement.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="group hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-32 bg-muted/30">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Get started in minutes and let the music flow.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((step) => (
              <div key={step.step} className="text-center">
                <div className="relative mx-auto mb-4 h-20 w-20">
                  <div className="absolute inset-0 rounded-full bg-primary/10" />
                  <div className="absolute inset-2 flex items-center justify-center rounded-full bg-background shadow-sm text-primary">
                    {step.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {step.step}
                  </div>
                </div>
                <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* User Types */}
      <section className="py-20 lg:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Built for Everyone
            </h2>
            <p className="text-lg text-muted-foreground">
              Whether you're a DJ, venue owner, bartender, or guest — we've got you covered.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full gradient-primary">
                  <Music className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle>DJs</CardTitle>
                <CardDescription>
                  Manage song requests, control the queue, and receive tips from your fans.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild className="w-full">
                  <Link to="/auth?mode=signup&role=dj">Sign Up as DJ</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full gradient-primary">
                  <Users className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle>Venue Owners</CardTitle>
                <CardDescription>
                  Create venues, manage staff, and track performance across all your events.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild className="w-full">
                  <Link to="/auth?mode=signup&role=venue">Sign Up as Venue</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full gradient-primary">
                  <Mic2 className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle>Bartenders</CardTitle>
                <CardDescription>
                  Get added to venues, receive tips directly, and track your earnings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild className="w-full">
                  <Link to="/auth?mode=signup">Get Started</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full gradient-primary">
                  <Vote className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle>Guests</CardTitle>
                <CardDescription>
                  Scan QR codes, request songs, vote for favorites, and tip your hosts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild className="w-full">
                  <Link to="/events">Browse Events</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32 bg-gradient-to-b from-accent/50 to-background">
        <div className="container">
          <Card className="mx-auto max-w-2xl text-center gradient-primary text-primary-foreground border-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-3xl">Ready to Transform Your Events?</CardTitle>
              <CardDescription className="text-primary-foreground/80 text-lg">
                Join thousands of DJs and venues using EventPulse to create unforgettable experiences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" variant="secondary" asChild>
                <Link to="/auth?mode=signup">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </MainLayout>
  );
}
