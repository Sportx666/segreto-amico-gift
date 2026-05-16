import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

const CONFIRM_WORD = "DELETE";

export const DeleteAccountDialog = () => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        method: "POST",
      });
      if (error) throw error;
      toast.success(t("account.delete.success"));
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (err) {
      console.error(err);
      const description = err instanceof Error ? err.message : undefined;
      toast.error(t("account.delete.error"), { description });
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setConfirmText("");
          setOpen(true);
        }}
        className="w-full justify-start text-destructive hover:text-destructive/80 hover:bg-destructive/10 border-destructive/30"
      >
        <Trash2 className="w-4 h-4 mr-2" />
        {t("account.delete.button")}
      </Button>

      <AlertDialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {t("account.delete.title")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>{t("account.delete.intro")}</p>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  <li>{t("account.delete.warning_events")}</li>
                  <li>{t("account.delete.warning_data")}</li>
                  <li>{t("account.delete.warning_email")}</li>
                  <li className="font-semibold">{t("account.delete.warning_undo")}</li>
                </ul>
                <div className="space-y-2 pt-2">
                  <Label htmlFor="confirm-delete" className="text-foreground">
                    {t("account.delete.confirm_prompt").replace("{word}", CONFIRM_WORD)}
                  </Label>
                  <Input
                    id="confirm-delete"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={CONFIRM_WORD}
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>
              {t("account.delete.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={confirmText.trim() !== CONFIRM_WORD || submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? t("account.delete.deleting") : t("account.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DeleteAccountDialog;
