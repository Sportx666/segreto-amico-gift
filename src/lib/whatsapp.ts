// WhatsApp sharing utilities for Italian market

interface ShareEventParams {
  eventName: string;
  budget?: number | null;
  date?: string | null;
  joinUrl: string;
}

export const createWhatsAppInviteText = ({ 
  eventName, 
  budget, 
  date, 
  joinUrl 
}: ShareEventParams): string => {
  let message = `🎁 Amico Segreto!\n\nSei invitato/a a partecipare a "${eventName}"`;
  
  if (budget) {
    message += `\n💰 Budget: ${budget}€`;
  }
  
  if (date) {
    const formattedDate = new Date(date).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    message += `\n📅 Scambio: ${formattedDate}`;
  }
  
  message += `\n\n👆 Clicca per entrare:\n${joinUrl}`;
  
  return message;
};

export const shareViaWhatsApp = (text: string) => {
  const encodedText = encodeURIComponent(text);
  const whatsappUrl = `https://wa.me/?text=${encodedText}`;
  
  // Check if we're on mobile and have native sharing capability
  if (navigator.share && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    navigator.share({
      title: "Invito Amico Segreto",
      text: text
    }).catch(() => {
      // Fallback to WhatsApp web if native sharing fails
      window.open(whatsappUrl, "_blank");
    });
  } else {
    // Desktop or no native sharing - use WhatsApp web
    window.open(whatsappUrl, "_blank");
  }
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    return true;
  }
};