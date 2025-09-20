// WhatsApp sharing utilities for Italian market
// Note: This file is kept for legacy support but most functions have been moved to utils.ts

interface ShareEventParams {
  eventName: string;
  budget?: number | null;
  date?: string | null;
  joinUrl: string;
}

// Legacy function - kept for backward compatibility
// Consider using react-share components instead
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

// Re-export from utils for backward compatibility
export { copyToClipboard } from '@/lib/utils';