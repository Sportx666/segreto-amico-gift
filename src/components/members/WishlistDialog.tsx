import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, ExternalLink, ShoppingBag, Check } from "lucide-react";
import { useFullMemberWishlist } from "@/hooks/useFullMemberWishlist";
import { useI18n } from "@/i18n";

interface WishlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantId: string;
  eventId: string;
  memberName: string;
}

export function WishlistDialog({
  open,
  onOpenChange,
  participantId,
  eventId,
  memberName,
}: WishlistDialogProps) {
  const { t } = useI18n();
  const { data: wishlist, isLoading } = useFullMemberWishlist(
    participantId,
    eventId,
    open
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
            <span className="break-words">{memberName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-16 h-16 rounded-md flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : !wishlist || wishlist.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="break-words">{t('wishlist_preview.no_items')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {wishlist.items.map((item) => (
                <div
                  key={item.id}
                  className={`flex gap-3 p-3 rounded-lg border border-border/50 bg-muted/30 ${
                    item.is_purchased ? 'opacity-60' : ''
                  }`}
                >
                  <div className="relative w-16 h-16 flex-shrink-0 bg-background rounded-md overflow-hidden border border-border/50">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title || 'Wishlist item'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    {item.is_purchased && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <Check className="w-6 h-6 text-primary" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-2 break-words">
                      {item.title || t('wishlist_preview.untitled_item')}
                    </p>
                    {item.price_snapshot && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.price_snapshot}
                      </p>
                    )}
                    {item.affiliate_url && (
                      <a
                        href={item.affiliate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {t('wishlist_preview.view_product')}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
