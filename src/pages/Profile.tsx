import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useI18n } from "@/i18n";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { uploadImage, resizeToWebP } from "@/lib/upload";
import { toast } from "sonner";
import { Trash2, Upload, User } from "lucide-react";
import AccountSettings from "@/components/AccountSettings";
import { NotificationSettings } from '@/components/NotificationSettings';

const Profile = () => {
  // Authentication guard - will redirect if not authenticated
  const { user, loading: authLoading, isAuthenticated } = useAuthGuard();
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, address, city, postal_code, country, phone, avatar_url")
        .eq("id", user.id)
        .single();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setAddress(data.address ?? "");
        setCity(data.city ?? "");
        setPostalCode(data.postal_code ?? "");
        setCountry(data.country ?? "");
        setPhone(data.phone ?? "");
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
        .update({ 
          display_name: displayName, 
          address, 
          city, 
          postal_code: postalCode, 
          country, 
          phone, 
          avatar_url: url 
        })
        .eq("id", user.id);
      if (error) throw error;
      setAvatarUrl(url);
      setFile(null);
      toast.success(t('common.success'));
      window.location.href = "/";
    } catch (err) {
      console.error(err);
      toast.error(t('common.error'));
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

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Auth guard will handle redirects, this won't be reached if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
      <PageHeader 
        title={t('profile.title')} 
        description={t('profile.description')}
      />
      
      <div className="grid gap-6 md:gap-8">
        {/* Profile Form */}
        <div className="grid gap-6 md:gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('profile.personal_info')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('profile.email')}</Label>
                  <Input 
                    id="email"
                    value={user.email ?? ""} 
                    disabled 
                    className="bg-muted"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="displayName">{t('profile.display_name')}</Label>
                  <Input
                    id="displayName"
                    placeholder={t('profile.display_name')}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('profile.phone')}</Label>
                  <Input 
                    id="phone"
                    placeholder={t('profile.phone')}
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                  />
                </div>
              </CardContent>
            </Card>

            {/* Shipping Information */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">{t('profile.shipping_info')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="address">{t('profile.address')}</Label>
                  <Input
                    id="address"
                    placeholder={t('profile.address')}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">{t('profile.city')}</Label>
                    <Input
                      id="city"
                      placeholder={t('profile.city')}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">{t('profile.postal_code')}</Label>
                    <Input
                      id="postalCode"
                      placeholder={t('profile.postal_code')}
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="country">{t('profile.country')}</Label>
                  <Input
                    id="country"
                    placeholder={t('profile.country')}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Avatar Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('profile.avatar')}</CardTitle>
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
                      {t('profile.upload_image')}
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
                      {t('profile.remove_avatar')}
                    </Button>
                  )}
                </div>
                
                {uploadingAvatar && (
                  <p className="text-sm text-muted-foreground text-center">
                    {t('common.loading')}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Notification Settings */}
        <NotificationSettings />

        {/* Account Settings */}
        <AccountSettings />
      </div>
      
      <div className="flex justify-end mt-6">
        <Button 
          onClick={handleSave} 
          disabled={uploadingAvatar}
          size="lg"
        >
          {uploadingAvatar ? t('profile.saving') : t('profile.save_changes')}
        </Button>
      </div>
    </div>
  );
};

export default Profile;
