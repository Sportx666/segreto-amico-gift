import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, ExternalLink, Plus, ShoppingBag } from "lucide-react";
import { useMemberWishlist } from "@/hooks/useMemberWishlist";
import { useI18n } from "@/i18n";
import { WishlistDialog } from "./WishlistDialog";

interface MemberWishlistPreviewProps {
  participantId: string;
  eventId: string;
  isCurrentUser: boolean;
  memberStatus: string;
  memberName?: string;
}

export function MemberWishlistPreview({
  participantId,
  eventId,
  isCurrentUser,
  memberStatus,
  memberName = "Wishlist",
}: MemberWishlistPreviewProps) {
  const { t } = useI18n();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: wishlist, isLoading } = useMemberWishlist(
    memberStatus === 'joined' ? participantId : null,
    eventId
  );

  // Don't show for non-joined members
  if (memberStatus !== 'joined') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-12 w-12 rounded" />
          <Skeleton className="h-12 w-12 rounded" />
          <Skeleton className="h-12 w-12 rounded" />
        </div>
      </div>
    );
  }

  // No wishlist exists
  if (!wishlist) {
    if (isCurrentUser) {
      return (
        <div className="mt-3 pt-3 border-t border-border/50">
          <Link to="/wishlist">
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              {t('wishlist_preview.create_wishlist')}
            </Button>
          </Link>
        </div>
      );
    }
    return (
      <div className="mt-3 pt-3 border-t border-border/50">
        <p className="text-xs text-muted-foreground flex items-start gap-1">
          <Heart className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span className="break-words whitespace-normal">{t('wishlist_preview.no_items')}</span>
        </p>
      </div>
    );
  }

  // Wishlist exists but is empty
  if (wishlist.items.length === 0) {
    if (isCurrentUser) {
      return (
        <div className="mt-3 pt-3 border-t border-border/50">
          <Link to="/wishlist">
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              {t('wishlist_preview.add_items')}
            </Button>
          </Link>
        </div>
      );
    }
    return (
      <div className="mt-3 pt-3 border-t border-border/50">
        <p className="text-xs text-muted-foreground flex items-start gap-1">
          <Heart className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span className="break-words whitespace-normal">{t('wishlist_preview.no_items')}</span>
        </p>
      </div>
    );
  }

  // Has items - show preview
  return (
    <>
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setDialogOpen(true)}
            className="text-xs font-medium text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
          >
            <Heart className="w-3 h-3" />
            {t('wishlist_preview.title')}
          </button>
          {isCurrentUser && (
            <Link to="/wishlist">
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                {t('wishlist_preview.view_full')}
              </Button>
            </Link>
          )}
        </div>
        
        <button
          onClick={() => setDialogOpen(true)}
          className="flex gap-2 overflow-x-auto pb-1 w-full cursor-pointer"
        >
          {wishlist.items.map((item) => (
            <div
              key={item.id}
              className="relative flex-shrink-0 group"
            >
              <div className="w-14 h-14 bg-muted rounded-md overflow-hidden border border-border/50">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title || 'Wishlist item'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              {item.is_purchased && (
                <div className="absolute inset-0 bg-background/80 rounded-md flex items-center justify-center">
                  <span className="text-xs font-medium text-primary">✓</span>
                </div>
              )}
              {item.affiliate_url && !isCurrentUser && (
                <a
                  href={item.affiliate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-0 bg-background/0 hover:bg-background/50 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ExternalLink className="w-4 h-4 text-foreground" />
                </a>
              )}
            </div>
          ))}
        </button>
        
        {/* Price hint for first visible item */}
        {wishlist.items[0]?.price_snapshot && (
          <p className="text-xs text-muted-foreground mt-1 break-words">
            {wishlist.items[0].price_snapshot}
            {wishlist.items.length > 1 && ` + ${wishlist.items.length - 1} ${t('wishlist_preview.more_items')}`}
          </p>
        )}
      </div>

      <WishlistDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        participantId={participantId}
        eventId={eventId}
        memberName={memberName}
      />
    </>
  );
}
