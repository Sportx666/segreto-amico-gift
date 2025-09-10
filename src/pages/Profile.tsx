import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { uploadImage, resizeToWebP } from "@/lib/upload";
import { AVATAR_PLACEHOLDER } from "@/lib/placeholder";
import { toast } from "sonner";
import { Trash2, Upload, User } from "lucide-react";
import { NotificationSettings } from '@/components/NotificationSettings';

const Profile = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [locale, setLocale] = useState("it");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, locale, avatar_url")
        .eq("id", user.id)
        .single();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setLocale(data.locale ?? "it");
        setAvatarUrl(data.avatar_url);
      }
    }
    load();
  }, [user]);

  // Update preview when a new file is selected
  useEffect(() => {
    if (!file) {
      // Clear preview when no file is selected
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // Auto-save avatar to DB when a file is selected
  useEffect(() => {
    const uploadAndSave = async () => {
      if (!user || !file) return;
      try {
        setUploadingAvatar(true);
        const resized = await resizeToWebP(file, { max: 1024, quality: 0.85 });
        const url = await uploadImage({
          bucket: "avatars",
          path: `${user.id}/avatar-${Date.now()}.webp`,
          file: resized,
        });
        const { data, error } = await supabase
          .from("profiles")
          .update({ avatar_url: url })
          .eq("id", user.id)
          .select("avatar_url")
          .single();
        if (error) throw error;
        setAvatarUrl(data?.avatar_url ?? url);
        setFile(null);
        setPreviewUrl(null);
        toast.success("Avatar aggiornato");
      } catch (err) {
        console.error(err);
        toast.error("Errore nel salvataggio dell'avatar");
      } finally {
        setUploadingAvatar(false);
      }
    };
    uploadAndSave();
  }, [file, user]);

  const handleSave = async () => {
    if (!user) return;
    let url = avatarUrl;
    try {
      if (file) {
        const resized = await resizeToWebP(file, { max: 1024, quality: 0.85 });
        url = await uploadImage({
          bucket: "avatars",
          path: `${user.id}/avatar.webp`,
          file: resized,
        });
      }
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName, locale, avatar_url: url })
        .eq("id", user.id);
      if (error) throw error;
      setAvatarUrl(url);
      setFile(null);
      toast.success("Profilo aggiornato");
      window.location.href = "/";
    } catch (err) {
      console.error(err);
      toast.error("Errore durante l'aggiornamento");
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);
      if (error) throw error;
      setAvatarUrl(null);
      setFile(null);
      toast.success("Avatar rimosso");
    } catch (err) {
      console.error(err);
      toast.error("Errore durante la rimozione");
    }
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
      <PageHeader 
        title="Profilo" 
        description="Gestisci le tue informazioni personali"
      />
      
      <div className="grid gap-6 md:gap-8">
        {/* Profile Form */}
        <div className="grid gap-6 md:gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informazioni Personali</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email"
                    value={user.email ?? ""} 
                    disabled 
                    className="bg-muted"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="displayName">Nome Visualizzato</Label>
                  <Input
                    id="displayName"
                    placeholder="Come ti chiami?"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="locale">Lingua</Label>
                  <Input 
                    id="locale"
                    placeholder="it"
                    value={locale} 
                    onChange={(e) => setLocale(e.target.value)} 
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Avatar Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Avatar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center">
                  <Avatar className="w-24 h-24 md:w-32 md:h-32">
                    <AvatarImage 
                      src={previewUrl || avatarUrl || undefined}
                      alt="Avatar profilo"
                    />
                    <AvatarFallback className="text-lg md:text-xl">
                      <User className="w-8 h-8 md:w-12 md:h-12" />
                    </AvatarFallback>
                  </Avatar>
                </div>
                
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <Label 
                      htmlFor="avatar-upload"
                      className="flex items-center justify-center gap-2 h-10 px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Carica Immagine
                    </Label>
                  </div>
                  
                  {avatarUrl && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={handleRemoveAvatar}
                      className="w-full"
                    >
                      <Trash2 className="w-4 h-4" />
                      Rimuovi Avatar
                    </Button>
                  )}
                </div>
                
                {uploadingAvatar && (
                  <p className="text-sm text-muted-foreground text-center">
                    Caricamento in corso...
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Notification Settings */}
        <NotificationSettings />
      </div>
      
      <div className="flex justify-end mt-6">
        <Button 
          onClick={handleSave} 
          disabled={uploadingAvatar}
          size="lg"
        >
          {uploadingAvatar ? "Salvando..." : "Salva Modifiche"}
        </Button>
      </div>
    </div>
  );
};

export default Profile;
