import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { shareViaWhatsApp, copyToClipboard } from "@/lib/whatsapp";

interface InviteButtonProps {
  shareText: string;
  className?: string;
}

export const InviteButton = ({ shareText, className }: InviteButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleWhatsAppShare = () => {
    shareViaWhatsApp(shareText);
    toast.success("Apertura WhatsApp...");
  };

  const handleCopyLink = async () => {
    const success = await copyToClipboard(shareText);
    if (success) {
      setCopied(true);
      toast.success("Link copiato negli appunti! 📋");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Errore nella copia del link");
    }
  };

  const handleNativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Invito Amico Segreto",
          text: shareText
        });
      } else {
        handleWhatsAppShare();
      }
    } catch (error) {
      // User cancelled or error - try WhatsApp fallback
      handleWhatsAppShare();
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleWhatsAppShare}
        className={`flex-1 bg-[#25D366] hover:bg-[#20BD5A] text-white ${className}`}
      >
        <MessageCircle className="w-4 h-4 mr-2" />
        WhatsApp
      </Button>
      
      <Button
        variant="outline"
        onClick={handleCopyLink}
        className="px-3"
      >
        <Copy className="w-4 h-4" />
      </Button>
      
      <Button
        variant="outline"
        onClick={handleNativeShare}
        className="px-3"
      >
        <Share2 className="w-4 h-4" />
      </Button>
    </div>
  );
};