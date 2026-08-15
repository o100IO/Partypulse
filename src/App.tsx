import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";

// DJ Pages
import DJDashboard from "./pages/dj/Dashboard";
import CreateEvent from "./pages/dj/CreateEvent";
import EventDetail from "./pages/dj/EventDetail";
import EventAnalytics from "./pages/dj/EventAnalytics";
import DJEvents from "./pages/dj/Events";
import EventQR from "./pages/dj/EventQR";

// Venue Pages
import VenueDashboard from "./pages/venue/Dashboard";
import CreateVenue from "./pages/venue/CreateVenue";
import VenueDetail from "./pages/venue/VenueDetail";
import VenueStaff from "./pages/venue/VenueStaff";
import VenueEvents from "./pages/venue/VenueEvents";
import VenueQR from "./pages/venue/VenueQR";
import VenueLive from "./pages/venue/VenueLive";

// Bartender Pages
import BartenderDashboard from "./pages/bartender/Dashboard";

// Guest Pages
import GuestEvent from "./pages/guest/Event";
import GuestProfile from "./pages/guest/Profile";
import Events from "./pages/Events";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSetup from "./pages/admin/AdminSetup";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="eventpulse-theme">
      <AuthProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              
              {/* Public Routes */}
              <Route path="/events" element={<Events />} />
              <Route path="/e/:eventId" element={<GuestEvent />} />
              <Route path="/venue/:venueId/live" element={<VenueLive />} />

              {/* Settings (All authenticated users) */}
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />

              {/* DJ Routes */}
              <Route
                path="/dj/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['dj', 'venue_owner']}>
                    <DJDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dj/events"
                element={
                  <ProtectedRoute allowedRoles={['dj', 'venue_owner']}>
                    <DJEvents />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dj/events/new"
                element={
                  <ProtectedRoute allowedRoles={['dj', 'venue_owner']}>
                    <CreateEvent />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dj/events/:eventId"
                element={
                  <ProtectedRoute allowedRoles={['dj', 'venue_owner']}>
                    <EventDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dj/events/:eventId/qr"
                element={
                  <ProtectedRoute allowedRoles={['dj', 'venue_owner']}>
                    <EventQR />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dj/events/:eventId/analytics"
                element={
                  <ProtectedRoute allowedRoles={['dj', 'venue_owner']}>
                    <EventAnalytics />
                  </ProtectedRoute>
                }
              />

              {/* Venue Owner Routes */}
              <Route
                path="/venue/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['venue_owner']}>
                    <VenueDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/venue/create"
                element={
                  <ProtectedRoute allowedRoles={['venue_owner']}>
                    <CreateVenue />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/venue/:venueId"
                element={
                  <ProtectedRoute allowedRoles={['venue_owner']}>
                    <VenueDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/venue/:venueId/staff"
                element={
                  <ProtectedRoute allowedRoles={['venue_owner']}>
                    <VenueStaff />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/venue/:venueId/events"
                element={
                  <ProtectedRoute allowedRoles={['venue_owner']}>
                    <VenueEvents />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/venue/:venueId/qr"
                element={
                  <ProtectedRoute allowedRoles={['venue_owner']}>
                    <VenueQR />
                  </ProtectedRoute>
                }
              />

              {/* Bartender Routes */}
              <Route
                path="/bartender/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['bartender']}>
                    <BartenderDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Guest Routes */}
              <Route
                path="/guest/profile"
                element={
                  <ProtectedRoute allowedRoles={['guest']}>
                    <GuestProfile />
                  </ProtectedRoute>
                }
              />

              {/* Platform admin */}
              <Route path="/admin/setup" element={<AdminSetup />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </ErrorBoundary>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
