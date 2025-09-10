/**
 * Product wishlist selection dialog component
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { type Product, type Wishlist } from '@/services/wishlist';

interface ProductSelectionDialogProps {
  product: Product | null;
  wishlists: Wishlist[];
  open: boolean;
  onClose: () => void;
  onConfirm: (wishlistId: string) => void;
}

export function ProductSelectionDialog({
  product,
  wishlists,
  open,
  onClose,
  onConfirm,
}: ProductSelectionDialogProps) {
  const { t } = useI18n();
  const [selectedWishlistId, setSelectedWishlistId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!selectedWishlistId || !product) return;
    
    setSaving(true);
    try {
      onConfirm(selectedWishlistId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('wishlist.choose_list') || "Scegli una lista"}</DialogTitle>
          <DialogDescription>
            {t('wishlist.choose_list_desc') || "Seleziona la lista desideri dove aggiungere il prodotto."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3">
          <Select 
            value={selectedWishlistId ?? undefined} 
            onValueChange={(v) => setSelectedWishlistId(v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Scegli lista" />
            </SelectTrigger>
            <SelectContent>
              {wishlists.map(w => (
                <SelectItem key={w.id} value={w.id}>
                  {w.title || 'Senza titolo'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel') || "Annulla"}
          </Button>
          <Button
            disabled={!selectedWishlistId || !product || saving}
            onClick={handleConfirm}
          >
            {saving ? (t('common.adding') || 'Aggiungendo...') : (t('wishlist.add') || 'Aggiungi')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}