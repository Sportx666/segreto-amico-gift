import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Share2, MessageCircle, Mail, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

interface EventShareProps {
  event: {
    id: string;
    name: string;
    join_code: string;
    date: string | null;
    budget: number | null;
  };
}

export const EventShare = ({ event }: EventShareProps) => {
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  const joinUrl = `${window.location.origin}/join/${event.join_code}`;
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiato negli appunti!");
    } catch (error) {
      toast.error("Errore nella copia");
    }
  };

  const shareViaWhatsApp = () => {
    const message = `🎁 Ti invito al mio evento "Amico Segreto"!\n\n📅 Evento: ${event.name}\n${event.date ? `📆 Data: ${new Date(event.date).toLocaleDateString('it-IT')}\n` : ''}${event.budget ? `💰 Budget: €${event.budget}\n` : ''}\n🔗 Partecipa qui: ${joinUrl}\n\nOppure usa il codice: ${event.join_code}`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const shareViaEmail = () => {
    const subject = `Invito all'evento "Amico Segreto": ${event.name}`;
    const body = `Ciao!\n\nTi invito a partecipare al mio evento "Amico Segreto":\n\n📅 Nome: ${event.name}\n${event.date ? `📆 Data: ${new Date(event.date).toLocaleDateString('it-IT')}\n` : ''}${event.budget ? `💰 Budget consigliato: €${event.budget}\n` : ''}\nPer partecipare, clicca su questo link:\n${joinUrl}\n\nOppure vai su ${window.location.origin} e inserisci il codice: ${event.join_code}\n\nA presto!\n`;
    
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  const shareViaNativeAPI = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Evento "Amico Segreto": ${event.name}`,
          text: `Partecipa al mio evento "Amico Segreto"!`,
          url: joinUrl,
        });
      } catch (error) {
        // User cancelled or error occurred
        copyToClipboard(joinUrl);
      }
    } else {
      copyToClipboard(joinUrl);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Condividi Evento
          </CardTitle>
          <CardDescription>
            Invita amici e familiari a partecipare al tuo evento "Amico Segreto"
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Join Code */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Codice di Accesso</CardTitle>
          <CardDescription>
            Condividi questo codice per permettere agli altri di unirsi
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="join-code">Codice Evento</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="join-code"
                value={event.join_code}
                readOnly
                className="font-mono text-lg text-center"
              />
              <Button
                variant="outline"
                onClick={() => copyToClipboard(event.join_code)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <Badge variant="secondary" className="w-fit">
            Gli invitati dovranno inserire questo codice per accedere
          </Badge>
        </CardContent>
      </Card>

      {/* Direct Link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Link Diretto</CardTitle>
          <CardDescription>
            Link diretto per accedere immediatamente all'evento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="join-url">URL di Accesso</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="join-url"
                value={joinUrl}
                readOnly
                className="text-sm"
              />
              <Button
                variant="outline"
                onClick={() => copyToClipboard(joinUrl)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Share Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Condividi Con</CardTitle>
          <CardDescription>
            Scegli come condividere l'invito con i tuoi amici
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              onClick={shareViaWhatsApp}
              variant="outline"
              className="justify-start"
            >
              <MessageCircle className="w-4 h-4 mr-2 text-green-600" />
              WhatsApp
            </Button>
            
            <Button
              onClick={shareViaEmail}
              variant="outline"
              className="justify-start"
            >
              <Mail className="w-4 h-4 mr-2" />
              Email
            </Button>
            
            <Button
              onClick={shareViaNativeAPI}
              variant="outline"
              className="justify-start sm:col-span-2"
            >
              <Share2 className="w-4 h-4 mr-2" />
              {navigator.share ? "Condividi" : "Copia Link"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">Come Funziona</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 space-y-2 text-sm">
          <p>1. Condividi il codice evento o il link diretto con i partecipanti</p>
          <p>2. I partecipanti inseriranno il codice o cliccheranno sul link per unirsi</p>
          <p>3. Una volta che tutti si sono uniti, potrai configurare esclusioni ed eseguire il sorteggio</p>
          <p>4. Ogni partecipante riceverà la sua assegnazione segreta!</p>
        </CardContent>
      </Card>
    </div>
  );
};