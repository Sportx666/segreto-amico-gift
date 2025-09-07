import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Share2 } from "lucide-react";
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
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiato negli appunti!");
    } catch (error) {
      toast.error("Errore nella copia");
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
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p></p>
            <p>Vai su Partecipanti → Aggiungi per creare l'invito personale.</p>
            <p>Condividi il link generato direttamente con il partecipante.</p>
            <p>Se inserisci un'email, eviti duplicati e colleghi automaticamente l'account se esiste.</p>
          </CardContent>
        </CardHeader>
      </Card>

      {/* Nessun codice evento: usa gli inviti personali nella sezione Partecipanti */}

      {/* Come Funziona */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">Come Funziona</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 space-y-2 text-sm">
          <p>1. Genera e invia link personali di invito dalla sezione Partecipanti.</p>
          <p>2. Gli invitati aprono il link, si autenticano e si uniscono all'evento.</p>
          <p>3. Quando tutti hanno aderito, configura le esclusioni ed esegui il sorteggio.</p>
          <p>4. Ogni partecipante riceverà la sua assegnazione segreta.</p>
        </CardContent>
      </Card>
    </div>
  );
};

