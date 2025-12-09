import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";

interface StatusChipProps {
  status: string;
}

const variants: Record<string, { symbol: string; variant: string }> = {
  invited: { symbol: "!", variant: "bg-yellow-100 text-yellow-800" },
  joined: { symbol: "✓", variant: "bg-green-100 text-green-800" },
  declined: { symbol: "✗", variant: "bg-red-100 text-red-800" },
  left: { symbol: "—", variant: "bg-gray-100 text-gray-800" },
};

export const StatusChip = ({ status }: StatusChipProps) => {
  const { t } = useI18n();
  const className = variants[status]?.variant || "bg-muted text-muted-foreground";
  const symbol = variants[status]?.symbol || "?";
  const label = status ? t(`status.${status}`) : "";
  return (
    <Badge className={className} title={label} aria-label={label}>
      <span className="sm:hidden">{symbol}</span>
      <span className="hidden sm:inline">{label || symbol}</span>
    </Badge>
  );
};
