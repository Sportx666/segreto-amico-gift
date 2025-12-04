import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Euro, Gift, Users, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadImage, resizeToWebP } from "@/lib/upload";
import { useAuth } from "@/components/AuthProvider";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const EventEdit = () => {
  const { id } = useParams();
  const [name, setName] = useState("");
  const [budget, setBudget] = useState<number | "">("");
  const [date, setDate] = useState("");
  const [drawDate, setDrawDate] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [currentCoverUrl, setCurrentCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  const budgetPresets = [5, 10, 15, 20];

  useEffect(() => {
    if (!user || !id) {
      navigate("/auth");
      return;
    }
    fetchEvent();
  }, [user, id, navigate]);

  const fetchEvent = async () => {
    try {
      const { data: event, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .eq("admin_profile_id", user!.id)
        .single();

      if (error) throw error;

      if (!event) {
        toast.error("Evento non trovato o non hai i permessi per modificarlo");
        navigate("/events");
        return;
      }

      if (event.draw_status === 'completed') {
        toast.error("Non puoi modificare un evento dopo che il sorteggio è stato completato");
        navigate(`/events/${id}`);
        return;
      }

      setName(event.name);
      setBudget(event.budget || "");
      setDate(event.date || "");
      setDrawDate(event.draw_date || "");
      setCurrentCoverUrl(event.cover_image_url);
    } catch (error) {
      console.error("Error fetching event:", error);
      toast.error("Errore nel caricamento dell'evento");
      navigate("/events");
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user || !id) return;

    setLoading(true);
    try {
      let coverImageUrl = currentCoverUrl;

      // If a new cover image is selected, upload it
      if (coverFile) {
        try {
          setCoverUploading(true);
          const resized = await resizeToWebP(coverFile, { max: 1600, quality: 0.8 });
          coverImageUrl = await uploadImage({
            bucket: "event-images",
            path: `${id}/cover.webp`,
            file: resized,
          });
          toast.success("Immagine evento caricata");
        } catch (e) {
          console.warn("Cover upload failed", e);
          toast.error("Caricamento immagine evento fallito");
        } finally {
          setCoverUploading(false);
        }
      }

      // Update the event
      const { error } = await supabase
        .from("events")
        .update({
          name: name.trim(),
          budget: budget || null,
          date: date || null,
          draw_date: drawDate || null,
          cover_image_url: coverImageUrl
        })
        .eq("id", id)
        .eq("admin_profile_id", user.id);

      if (error) throw error;

      toast.success("Evento aggiornato con successo! 🎉");
      navigate(`/events/${id}`);
    } catch (error: unknown) {
      console.error("Error updating event:", error);
      const description = error instanceof Error ? error.message : undefined;
      toast.error("Errore nell'aggiornamento dell'evento", {
        description
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Back Button Bar - Between Navbar and Content */}
      <div className="container max-w-md py-2 md:py-3">
        <Button
          variant="ghost"
          onClick={() => navigate(`/events/${id}`)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Torna all'evento
        </Button>
      </div>

      <div className="max-w-md mx-auto px-4 pb-4 space-y-6">

        <Card className="shadow-elegant border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mb-4">
              <Gift className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">Modifica Evento</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Immagine evento</Label>
                <div className="w-full">
                  <img
                    src={coverFile ? URL.createObjectURL(coverFile) : (currentCoverUrl || "/placeholder.svg")}
                    alt="cover preview"
                    className="w-full h-40 object-cover rounded border"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 items-center">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                    className={coverFile ? "col-span-3" : "col-span-4"}
                  />
                  {coverFile && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 text-destructive"
                      onClick={() => setCoverFile(null)}
                      title="Remove picture"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Rimuovi</span>
                    </Button>
                  )}
                </div>

              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome dell'evento</Label>
                <Input
                  id="name"
                  placeholder="Natale in famiglia 2024"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-3">
                <Label>Budget suggerito</Label>
                <div className="grid grid-cols-4 gap-2">
                  {budgetPresets.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={budget === preset ? "default" : "outline"}
                      size="sm"
                      onClick={() => setBudget(preset)}
                      className="h-10"
                    >
                      <Euro className="w-3 h-3 mr-1" />
                      {preset}
                    </Button>
                  ))}
                </div>
                <Input
                  type="number"
                  placeholder="Budget personalizzato"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value ? Number(e.target.value) : "")}
                  min="1"
                  max="1000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Data dello scambio</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="drawDate">Data automatica del sorteggio</Label>
                <Input
                  id="drawDate"
                  type="date"
                  value={drawDate}
                  onChange={(e) => setDrawDate(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:bg-primary-light transition-all duration-300 hover:shadow-glow"
                disabled={loading || coverUploading}
              >
                {loading ? (
                  "Aggiornamento..."
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Aggiorna Evento
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EventEdit;