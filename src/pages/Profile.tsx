import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { uploadImage, resizeToWebP } from "@/lib/upload";
import { AVATAR_PLACEHOLDER } from "@/lib/placeholder";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

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
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Profilo</h1>
      <div className="space-y-2">
        <label className="text-sm">Email</label>
        <Input value={user.email ?? ""} disabled />
      </div>
      <div className="space-y-2">
        <label className="text-sm">Nome</label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm">Locale</label>
        <Input value={locale} onChange={(e) => setLocale(e.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="text-sm">Avatar</label>
        <img
          src={previewUrl || avatarUrl || AVATAR_PLACEHOLDER}
          alt="avatar"
          className="w-24 h-24 rounded-full object-cover"
        />
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {avatarUrl && (
            <Button type="button" variant="outline" onClick={handleRemoveAvatar}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      <Button onClick={handleSave} disabled={uploadingAvatar}>Salva</Button>
    </div>
  );
};

export default Profile;
