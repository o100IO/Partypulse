import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Copy, Check, Share2, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface QRCodeDisplayProps {
  url: string;
  title: string;
  description?: string;
  size?: number;
  compact?: boolean;
}

export function QRCodeDisplay({ url, title, description, size = 200, compact = false }: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: 'Link copied!',
        description: 'The event link has been copied to your clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to copy',
        description: 'Please try again.',
      });
    }
  };

  const downloadQRCode = () => {
    if (!svgRef.current) return;

    const svg = svgRef.current.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const padding = 40;
    canvas.width = size + padding * 2;
    canvas.height = size + padding * 2;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, size, size);
      URL.revokeObjectURL(svgUrl);

      const link = document.createElement('a');
      link.download = `${title.replace(/\s+/g, '-').toLowerCase()}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast({
        title: 'QR code downloaded!',
        description: 'The QR code has been saved to your device.',
      });
    };
    img.src = svgUrl;
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: description || `Join ${title}!`,
          url: url,
        });
      } catch (e) {
        // User cancelled or share failed, fallback to copy
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-4">
        <div ref={svgRef} className="bg-white p-2 rounded-lg shadow-sm shrink-0">
          <QRCodeSVG
            value={url}
            size={size}
            level="H"
            includeMargin={false}
            fgColor="#1a1a2e"
          />
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <p className="text-xs text-muted-foreground break-all line-clamp-2">{url}</p>
          <div className="flex gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" onClick={copyToClipboard} className="h-7 text-xs">
              {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare} className="h-7 text-xs">
              <Share2 className="mr-1 h-3 w-3" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={downloadQRCode} className="h-7 text-xs">
              <Download className="mr-1 h-3 w-3" />
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div ref={svgRef} className="bg-white p-4 rounded-xl shadow-sm">
          <QRCodeSVG
            value={url}
            size={size}
            level="H"
            includeMargin={false}
            fgColor="#1a1a2e"
          />
        </div>
        <p className="text-sm text-muted-foreground break-all text-center max-w-xs">{url}</p>
        <div className="flex gap-2 flex-wrap justify-center">
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={downloadQRCode}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Full-screen QR dialog for quick sharing
export function QRShareDialog({ url, title, children }: { url: string; title: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: 'Link copied!' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to copy' });
    }
  };

  const downloadQR = () => {
    if (!svgRef.current) return;
    const svg = svgRef.current.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 340;
    canvas.height = 340;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 340, 340);

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 20, 20, 300, 300);
      URL.revokeObjectURL(svgUrl);
      const link = document.createElement('a');
      link.download = `${title.replace(/\s+/g, '-').toLowerCase()}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = svgUrl;
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">Scan to join the event or share the link</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div ref={svgRef} className="bg-white p-5 rounded-2xl shadow-md">
            <QRCodeSVG
              value={url}
              size={220}
              level="H"
              includeMargin={false}
              fgColor="#1a1a2e"
            />
          </div>
          <p className="text-xs text-muted-foreground break-all text-center max-w-xs">{url}</p>
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={copyToClipboard}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button variant="outline" className="flex-1" onClick={downloadQR}>
              <Download className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print QR Code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
