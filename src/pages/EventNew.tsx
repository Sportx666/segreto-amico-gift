import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Euro, Gift, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";

const EventNew = () => {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState<number | "">("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const budgetPresets = [5, 10, 15, 20];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;

    setLoading(true);
    try {
      // First create or get user's profile
      let { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!profile) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email,
            display_name: user.email?.split("@")[0]
          });
        if (profileError) throw profileError;
      }

      // Generate join code using database function
      const { data: codeData, error: codeError } = await supabase
        .rpc("generate_join_code");
      if (codeError) throw codeError;

      // Create the event (stamp admin_profile_id)
      const { data: event, error } = await supabase
        .from("events")
        .insert({
          name: name.trim(),
          budget: budget || null,
          date: date || null,
          join_code: codeData,
          admin_profile_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Ensure a participant row for this user (read-then-insert to avoid upsert constraints)
      let { data: participant } = await supabase
        .from("participants")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!participant) {
        const inserted = await supabase
          .from("participants")
          .insert({ profile_id: user.id })
          .select("id")
          .single();
        if (inserted.error || !inserted.data) throw inserted.error ?? new Error("Missing participant");
        participant = inserted.data;
      }

      // Load admin display name for membership label
      const { data: profileInfo } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", user.id)
        .single();
      const adminDisplay = profileInfo?.display_name || (user.email?.split("@")[0] ?? "Admin");

      // Add admin as event member with admin role and label
      const { error: memberError } = await supabase
        .from("event_members")
        .insert({
          event_id: event.id,
          participant_id: participant.id,
          role: "admin",
          anonymous_name: adminDisplay,
          status: "joined"
        });

      if (memberError) throw memberError;

      toast.success("Evento creato con successo! 🎉");
      navigate(`/events/${event.id}`);
    } catch (error: unknown) {
      console.error("Error creating event:", error);
      const description = error instanceof Error ? error.message : undefined;
      toast.error("Errore nella creazione dell'evento", {
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

  return (
    <div className="min-h-screen bg-gradient-subtle p-4">
      <div className="max-w-md mx-auto space-y-6">
        <Card className="shadow-elegant border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mb-4">
              <Gift className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">Crea Nuovo Evento</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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

              <Button 
                type="submit" 
                className="w-full bg-gradient-primary hover:bg-primary-light transition-all duration-300 hover:shadow-glow"
                disabled={loading}
              >
                {loading ? (
                  "Creazione..."
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Crea Evento
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

export default EventNew;
