import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { uploadImage, resizeToWebP } from "@/lib/upload";
import { AVATAR_PLACEHOLDER } from "@/lib/placeholder";
import { toast } from "sonner";

const Profile = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [locale, setLocale] = useState("it");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

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
          src={avatarUrl || AVATAR_PLACEHOLDER}
          alt="avatar"
          className="w-24 h-24 rounded-full object-cover"
        />
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>
      <Button onClick={handleSave}>Salva</Button>
    </div>
  );
};

export default Profile;
