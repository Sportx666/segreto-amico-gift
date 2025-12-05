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
import { useI18n } from "@/i18n";

const EventEdit = () => {
  const { t } = useI18n();
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
        toast.error(t('event_edit.not_found'));
        navigate("/events");
        return;
      }

      if (event.draw_status === 'completed') {
        toast.error(t('event_edit.cannot_edit_after_draw'));
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
      toast.error(t('event_edit.loading_error'));
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

      if (coverFile) {
        try {
          setCoverUploading(true);
          const resized = await resizeToWebP(coverFile, { max: 1600, quality: 0.8 });
          coverImageUrl = await uploadImage({
            bucket: "event-images",
            path: `${id}/cover.webp`,
            file: resized,
          });
          toast.success(t('event_edit.image_uploaded'));
        } catch (e) {
          console.warn("Cover upload failed", e);
          toast.error(t('event_edit.image_upload_failed'));
        } finally {
          setCoverUploading(false);
        }
      }

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

      toast.success(t('event_edit.updated_success'));
      navigate(`/events/${id}`);
    } catch (error: unknown) {
      console.error("Error updating event:", error);
      const description = error instanceof Error ? error.message : undefined;
      toast.error(t('event_edit.update_error'), {
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
          {t('buttons.back_to_event')}
        </Button>
      </div>

      <div className="max-w-md mx-auto px-4 pb-4 space-y-6">

        <Card className="shadow-elegant border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mb-4">
              <Gift className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">{t('event_edit.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>{t('event_edit.cover_image')}</Label>
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
                      <span className="hidden sm:inline">{t('event_edit.remove_image')}</span>
                    </Button>
                  )}
                </div>

              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t('event_edit.event_name')}</Label>
                <Input
                  id="name"
                  placeholder={t('event_edit.event_name_placeholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-3">
                <Label>{t('event_edit.suggested_budget')}</Label>
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
                  placeholder={t('event_edit.custom_budget')}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value ? Number(e.target.value) : "")}
                  min="1"
                  max="1000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">{t('event_edit.exchange_date')}</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="drawDate">{t('event_edit.auto_draw_date')}</Label>
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
                  t('event_edit.updating')
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    {t('event_edit.update_button')}
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
