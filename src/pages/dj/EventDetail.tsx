import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QRShareDialog } from '@/components/QRCodeDisplay';
import { QRCodeSVG } from 'qrcode.react';
import { TicketManager } from '@/components/TicketManager';
import { VenueMenuManager } from '@/components/VenueMenuManager';
import { DJOrderDashboard } from '@/components/DJOrderDashboard';
import { AnnouncementPanel } from '@/components/AnnouncementPanel';
import { EventChat } from '@/components/EventChat';
import { JoinSettingsCard, JoinPolicy } from '@/components/JoinSettingsCard';
import { cn } from '@/lib/utils';
import {
  Music, Calendar, Clock, QrCode, Play, Pause, ArrowLeft, ExternalLink,
  Users, ThumbsUp, Check, X, MoreVertical, Copy, BarChart3, Ticket, UtensilsCrossed, ShoppingCart, Megaphone, MessageCircle, Palette, Upload, Loader2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Event {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  start_time: string;
  end_time: string | null;
  status: string;
  qr_code: string | null;
  dj_id: string;
  venue_id: string | null;
  theme_color: string | null;
  theme_bg_image: string | null;
  theme_logo_url: string | null;
  join_policy?: string | null;
  join_code?: string | null;
}

interface SongRequest {
  id: string;
  song_title: string;
  artist: string | null;
  source: string | null;
  thumbnail_url: string | null;
  status: string;
  vote_count: number;
  guest_name: string | null;
  shoutout_message: string | null;
  created_at: string;
  is_pre_event: boolean;
}

type RequestFilter = 'all' | 'pending' | 'accepted' | 'pre_event';

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [event, setEvent] = useState<Event | null>(null);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowPlaying, setNowPlaying] = useState<SongRequest | null>(null);
  const [filter, setFilter] = useState<RequestFilter>('all');
  const [activeTab, setActiveTab] = useState('queue');
  const [venueOwnerId, setVenueOwnerId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (eventId) {
      fetchEventData();
      subscribeToUpdates();
    }
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;

      // Allow DJ or venue owner access
      let hasAccess = eventData.dj_id === user?.id;
      let fetchedVenueOwnerId: string | undefined;
      if (eventData.venue_id) {
        const { data: venue } = await supabase
          .from('venues')
          .select('owner_id')
          .eq('id', eventData.venue_id)
          .single();
        fetchedVenueOwnerId = venue?.owner_id;
        if (venue?.owner_id === user?.id) hasAccess = true;
      }
      setVenueOwnerId(fetchedVenueOwnerId);
      if (!hasAccess) {
        navigate('/dj/dashboard');
        return;
      }

      setEvent(eventData);

      const { data: requestsData, error: requestsError } = await supabase
        .from('song_requests')
        .select('*')
        .eq('event_id', eventId)
        .order('vote_count', { ascending: false });

      if (requestsError) throw requestsError;

      const playing = requestsData?.find((r) => r.status === 'playing');
      setNowPlaying(playing || null);
      setRequests(requestsData?.filter((r) => r.status !== 'playing') || []);
    } catch (error) {
      console.error('Error fetching event:', error);
      toast({ variant: 'destructive', title: 'Error loading event', description: 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToUpdates = () => {
    const channel = supabase
      .channel(`dj-event-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_requests', filter: `event_id=eq.${eventId}` }, () => fetchEventData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const updateEventStatus = async (newStatus: 'draft' | 'scheduled' | 'live' | 'ended' | 'archived') => {
    try {
      await supabase.from('events').update({ status: newStatus }).eq('id', eventId);
      setEvent((prev) => (prev ? { ...prev, status: newStatus } : null));
      toast({ title: 'Event status updated', description: `Event is now ${newStatus}.` });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const updateRequestStatus = async (requestId: string, newStatus: 'pending' | 'accepted' | 'declined' | 'playing' | 'played') => {
    try {
      if (newStatus === 'playing' && nowPlaying) {
        await supabase.from('song_requests').update({ status: 'played' }).eq('id', nowPlaying.id);
      }
      await supabase.from('song_requests').update({ status: newStatus }).eq('id', requestId);
      fetchEventData();
    } catch (error) {
      console.error('Error updating request:', error);
    }
  };

  const copyEventLink = () => {
    const link = `${window.location.origin}/e/${eventId}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copied!', description: 'Event link has been copied to clipboard.' });
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
      pending: { variant: 'outline', label: 'Pending' },
      accepted: { variant: 'secondary', label: 'Accepted' },
      declined: { variant: 'destructive', label: 'Declined' },
      playing: { variant: 'default', label: 'Playing' },
      played: { variant: 'secondary', label: 'Played' },
    };
    const config = variants[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <MainLayout showFooter={false}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!event) {
    return (
      <MainLayout showFooter={false}>
        <div className="container py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Event Not Found</h1>
          <Button asChild><Link to="/dj/dashboard">Back to Dashboard</Link></Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showFooter={false}>
      <div className="container py-8">
        <Button variant="ghost" onClick={() => navigate('/dj/dashboard')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Event Info & Controls */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant={event.status === 'live' ? 'default' : 'secondary'} className="mb-2">
                      {event.status === 'live' ? '🔴 Live' : event.status}
                    </Badge>
                    <CardTitle>{event.name}</CardTitle>
                    {event.genre && <Badge variant="outline" className="mt-2">{event.genre}</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" /><span>{formatDate(event.start_time)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" /><span>{formatTime(event.start_time)}</span>
                  {event.end_time && <span>- {formatTime(event.end_time)}</span>}
                </div>
                {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}

                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-primary" /> Event QR Code
                  </p>
                  <div className="flex items-center justify-center">
                    <QRShareDialog url={`${window.location.origin}/e/${event.id}`} title={event.name}>
                      <button className="group bg-white p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-border/50">
                        <QRCodeSVG value={`${window.location.origin}/e/${event.id}`} size={140} level="H" includeMargin={false} fgColor="#1a1a2e" />
                        <p className="text-[10px] text-muted-foreground mt-2 text-center group-hover:text-primary transition-colors">Tap to enlarge & share</p>
                      </button>
                    </QRShareDialog>
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  {event.status !== 'live' ? (
                    <Button onClick={() => updateEventStatus('live')} className="w-full"><Play className="mr-2 h-4 w-4" /> Go Live</Button>
                  ) : (
                    <Button onClick={() => updateEventStatus('ended')} variant="outline" className="w-full"><Pause className="mr-2 h-4 w-4" /> End Event</Button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={copyEventLink}><Copy className="mr-1 h-3 w-3" /> Copy Link</Button>
                    <Button variant="outline" size="sm" asChild><Link to={`/e/${eventId}`} target="_blank"><ExternalLink className="mr-1 h-3 w-3" /> Guest View</Link></Button>
                  </div>
                  <Button variant="outline" asChild className="w-full"><Link to={`/dj/events/${eventId}/analytics`}><BarChart3 className="mr-2 h-4 w-4" /> View Analytics</Link></Button>
                </div>
              </CardContent>
            </Card>

            {/* Now Playing */}
            {nowPlaying && (
              <Card className="border-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Now Playing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    {nowPlaying.thumbnail_url ? (
                      <img src={nowPlaying.thumbnail_url} alt={nowPlaying.song_title} className="w-16 h-12 rounded object-cover" />
                    ) : (
                      <div className="w-16 h-12 rounded bg-muted flex items-center justify-center"><Music className="h-6 w-6 text-muted-foreground" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{nowPlaying.song_title}</h4>
                      {nowPlaying.artist && <p className="text-sm text-muted-foreground truncate">{nowPlaying.artist}</p>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => updateRequestStatus(nowPlaying.id, 'played')}><Check className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Tabs */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="queue" className="text-xs"><Music className="h-3.5 w-3.5 mr-1" /> Queue</TabsTrigger>
                <TabsTrigger value="orders" className="text-xs"><ShoppingCart className="h-3.5 w-3.5 mr-1" /> Orders</TabsTrigger>
                <TabsTrigger value="announce" className="text-xs"><Megaphone className="h-3.5 w-3.5 mr-1" /> Alerts</TabsTrigger>
                <TabsTrigger value="chat" className="text-xs"><MessageCircle className="h-3.5 w-3.5 mr-1" /> Chat</TabsTrigger>
                <TabsTrigger value="tickets" className="text-xs"><Ticket className="h-3.5 w-3.5 mr-1" /> Tickets</TabsTrigger>
                <TabsTrigger value="menu" className="text-xs"><UtensilsCrossed className="h-3.5 w-3.5 mr-1" /> Menu</TabsTrigger>
                <TabsTrigger value="brand" className="text-xs"><Palette className="h-3.5 w-3.5 mr-1" /> Brand</TabsTrigger>
              </TabsList>

              {/* Queue Tab */}
              <TabsContent value="queue">
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Song Queue</CardTitle>
                        <CardDescription>
                          {requests.filter((r) => r.status === 'pending' && !r.is_pre_event).length} pending, {requests.filter((r) => r.is_pre_event).length} pre-event
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All</Button>
                        <Button size="sm" variant={filter === 'pending' ? 'default' : 'outline'} onClick={() => setFilter('pending')}>Pending</Button>
                        <Button size="sm" variant={filter === 'pre_event' ? 'default' : 'outline'} onClick={() => setFilter('pre_event')}>Pre-Event</Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {requests.length === 0 ? (
                      <div className="text-center py-8">
                        <Music className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                        <h3 className="font-semibold mb-2">No requests yet</h3>
                        <p className="text-muted-foreground text-sm">Share your event link and QR code to start receiving requests.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {requests
                          .filter((request) => {
                            if (filter === 'pending') return request.status === 'pending' && !request.is_pre_event;
                            if (filter === 'pre_event') return request.is_pre_event;
                            return true;
                          })
                          .map((request) => (
                          <div key={request.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                            {request.thumbnail_url ? (
                              <img src={request.thumbnail_url} alt={request.song_title} className="w-16 h-12 rounded object-cover" />
                            ) : (
                              <div className="w-16 h-12 rounded bg-muted flex items-center justify-center"><Music className="h-6 w-6 text-muted-foreground" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-medium truncate">{request.song_title}</h4>
                                  {request.artist && <p className="text-sm text-muted-foreground truncate">{request.artist}</p>}
                                </div>
                                <div className="flex gap-1">
                                  {request.is_pre_event && <Badge variant="outline" className="text-xs">Pre-Event</Badge>}
                                  {getStatusBadge(request.status)}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{request.vote_count}</span>
                                {request.guest_name && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{request.guest_name}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {request.status === 'pending' && (
                                <>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-success hover:text-success/80" onClick={() => updateRequestStatus(request.id, 'accepted')}><Check className="h-4 w-4" /></Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive/80" onClick={() => updateRequestStatus(request.id, 'declined')}><X className="h-4 w-4" /></Button>
                                </>
                              )}
                              {request.status === 'accepted' && (
                                <Button size="sm" onClick={() => updateRequestStatus(request.id, 'playing')}><Play className="mr-1 h-3 w-3" /> Play</Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => updateRequestStatus(request.id, 'pending')}>Reset to Pending</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateRequestStatus(request.id, 'declined')}>Decline</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Orders Tab */}
              <TabsContent value="orders">
                <Card>
                  <CardHeader>
                    <CardTitle>Table Orders</CardTitle>
                    <CardDescription>Real-time guest drink and bottle orders</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DJOrderDashboard eventId={eventId!} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Announcements Tab */}
              <TabsContent value="announce">
                <AnnouncementPanel eventId={eventId!} />
              </TabsContent>

              {/* Tickets Tab */}
              <TabsContent value="tickets">
                <Card>
                  <CardHeader>
                    <CardTitle>Event Tickets</CardTitle>
                    <CardDescription>Create ticket types for guests to purchase with points</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TicketManager eventId={eventId!} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Chat Moderation Tab */}
              <TabsContent value="chat">
                <Card>
                  <CardHeader>
                    <CardTitle>Live Chat</CardTitle>
                    <CardDescription>Monitor and moderate guest chat. Pin important messages.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EventChat
                      eventId={eventId!}
                      userId={user?.id || null}
                      displayName={profile?.display_name || 'Host'}
                      isModerator={true}
                      djId={event?.dj_id}
                      venueOwnerId={venueOwnerId}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Menu Tab */}
              <TabsContent value="menu">
                <Card>
                  <CardHeader>
                    <CardTitle>Menu Items</CardTitle>
                    <CardDescription>Manage drinks and bottles guests can order</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <VenueMenuManager venueId={event.venue_id || undefined} eventId={!event.venue_id ? eventId : undefined} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Branding Tab */}
              <TabsContent value="brand">
                <div className="space-y-4">
                  <JoinSettingsCard
                    eventId={eventId!}
                    joinPolicy={(event.join_policy as JoinPolicy) || 'open'}
                    joinCode={event.join_code || null}
                    onSaved={(policy, code) =>
                      setEvent((prev) => (prev ? { ...prev, join_policy: policy, join_code: code } : null))
                    }
                  />
                  <BrandingPanel eventId={eventId!} event={event} onUpdate={fetchEventData} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

/* ─── Branding Panel ─── */
const PRESET_COLORS = [
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Neon Pink', hex: '#ec4899' },
  { name: 'Electric Blue', hex: '#3b82f6' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Gold', hex: '#f59e0b' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'White', hex: '#ffffff' },
];

function BrandingPanel({ eventId, event, onUpdate }: { eventId: string; event: Event; onUpdate: () => void }) {
  const { toast } = useToast();
  const [themeColor, setThemeColor] = useState(event.theme_color || '');
  const [bgImage, setBgImage] = useState(event.theme_bg_image || '');
  const [logoUrl, setLogoUrl] = useState(event.theme_logo_url || '');
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [dragOverBg, setDragOverBg] = useState(false);
  const [dragOverLogo, setDragOverLogo] = useState(false);

  // Sync from parent
  useEffect(() => {
    setBgImage(event.theme_bg_image || '');
    setLogoUrl(event.theme_logo_url || '');
    setThemeColor(event.theme_color || '');
  }, [event.theme_bg_image, event.theme_logo_url, event.theme_color]);

  const saveField = async (field: string, value: string | null) => {
    try {
      const { error } = await supabase.from('events').update({ [field]: value }).eq('id', eventId);
      if (error) throw error;
      onUpdate();
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save' });
    }
  };

  const selectColor = (hex: string) => {
    setThemeColor(hex);
    saveField('theme_color', hex);
    toast({ title: 'Accent color updated!' });
  };

  const clearColor = () => {
    setThemeColor('');
    saveField('theme_color', null);
    toast({ title: 'Color cleared' });
  };

  const uploadFile = async (file: File, field: 'theme_bg_image' | 'theme_logo_url', setUploading: (v: boolean) => void) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${eventId}/${field}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('event-assets').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('event-assets').getPublicUrl(path);
      await saveField(field, publicUrl);
      if (field === 'theme_bg_image') setBgImage(publicUrl);
      else setLogoUrl(publicUrl);
      toast({ title: 'Image uploaded!' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const clearField = async (field: 'theme_bg_image' | 'theme_logo_url') => {
    await saveField(field, null);
    if (field === 'theme_bg_image') setBgImage('');
    else setLogoUrl('');
    toast({ title: 'Removed!' });
  };

  const handleDrop = (e: React.DragEvent, field: 'theme_bg_image' | 'theme_logo_url', setUploading: (v: boolean) => void, setDragOver: (v: boolean) => void) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) uploadFile(file, field, setUploading);
  };

  const previewColor = themeColor || '#7c3aed';

  return (
    <div className="space-y-6">
      {/* ═══ Live Preview ═══ */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Live Preview</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="relative rounded-xl overflow-hidden h-44">
            {bgImage ? (
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgImage})` }} />
            ) : (
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${previewColor}, ${previewColor}cc)` }} />
            )}
            {bgImage && themeColor && (
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${themeColor}99, ${themeColor}44)` }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4 gap-2">
              {logoUrl && <img src={logoUrl} alt="" className="h-10 drop-shadow-lg" />}
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: `${previewColor}55` }}>
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> LIVE
              </div>
              <h3 className="text-lg font-extrabold text-white drop-shadow-md">{event.name}</h3>
              <span className="text-xs text-white/70">DJ Name • {event.genre || 'All Genres'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Accent Color ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /> Accent Color</CardTitle>
          <CardDescription className="text-xs">Sets the gradient and accent on the guest page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.hex}
                onClick={() => selectColor(c.hex)}
                className={cn(
                  'h-9 w-9 rounded-full border-2 transition-all hover:scale-110 shadow-sm',
                  themeColor === c.hex ? 'border-primary ring-2 ring-primary/30 scale-110' : 'border-border'
                )}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <input type="color" value={themeColor || '#7c3aed'} onChange={e => selectColor(e.target.value)} className="h-9 w-12 rounded-lg border border-border cursor-pointer" />
            <Input
              value={themeColor}
              onChange={e => { setThemeColor(e.target.value); }}
              onBlur={() => { if (themeColor) saveField('theme_color', themeColor); }}
              placeholder="#7c3aed"
              className="flex-1 font-mono text-xs"
            />
            {themeColor && (
              <Button variant="ghost" size="sm" onClick={clearColor} className="text-xs text-muted-foreground">
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══ Background Image ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /> Background Image</CardTitle>
          <CardDescription className="text-xs">Cover photo for the event hero section</CardDescription>
        </CardHeader>
        <CardContent>
          {bgImage ? (
            <div className="relative rounded-xl overflow-hidden group">
              <img src={bgImage} alt="" className="w-full h-36 object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <label className="cursor-pointer">
                  <Button variant="secondary" size="sm" className="pointer-events-none">Replace</Button>
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], 'theme_bg_image', setUploadingBg)} />
                </label>
                <Button variant="destructive" size="sm" onClick={() => clearField('theme_bg_image')}>Remove</Button>
              </div>
            </div>
          ) : (
            <label
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all',
                dragOverBg ? 'border-primary bg-primary/10' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
              )}
              onDragOver={e => { e.preventDefault(); setDragOverBg(true); }}
              onDragLeave={() => setDragOverBg(false)}
              onDrop={e => handleDrop(e, 'theme_bg_image', setUploadingBg, setDragOverBg)}
            >
              {uploadingBg ? (
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground/50" />
              )}
              <span className="text-sm font-medium text-muted-foreground">{uploadingBg ? 'Uploading…' : 'Drag & drop or click to upload'}</span>
              <span className="text-[10px] text-muted-foreground/60">Recommended: 1920×1080, JPG or PNG</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], 'theme_bg_image', setUploadingBg)} disabled={uploadingBg} />
            </label>
          )}
        </CardContent>
      </Card>

      {/* ═══ Event Logo ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Upload className="h-4 w-4 text-primary" /> Event Logo</CardTitle>
          <CardDescription className="text-xs">Displayed on the guest hero header</CardDescription>
        </CardHeader>
        <CardContent>
          {logoUrl ? (
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-xl bg-muted/40 flex items-center justify-center p-2 border border-border">
                <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" className="pointer-events-none text-xs">Replace</Button>
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], 'theme_logo_url', setUploadingLogo)} />
                </label>
                <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => clearField('theme_logo_url')}>Remove</Button>
              </div>
            </div>
          ) : (
            <label
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all',
                dragOverLogo ? 'border-primary bg-primary/10' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
              )}
              onDragOver={e => { e.preventDefault(); setDragOverLogo(true); }}
              onDragLeave={() => setDragOverLogo(false)}
              onDrop={e => handleDrop(e, 'theme_logo_url', setUploadingLogo, setDragOverLogo)}
            >
              {uploadingLogo ? (
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground/50" />
              )}
              <span className="text-sm font-medium text-muted-foreground">{uploadingLogo ? 'Uploading…' : 'Drag & drop or click'}</span>
              <span className="text-[10px] text-muted-foreground/60">Square logo, PNG with transparency recommended</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], 'theme_logo_url', setUploadingLogo)} disabled={uploadingLogo} />
            </label>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
