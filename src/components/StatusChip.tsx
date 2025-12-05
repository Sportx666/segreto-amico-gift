import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";

interface StatusChipProps {
  status: string;
}

const variants: Record<string, string> = {
  invited: "bg-yellow-100 text-yellow-800",
  joined: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  left: "bg-gray-100 text-gray-800",
};

export const StatusChip = ({ status }: StatusChipProps) => {
  const { t } = useI18n();
  const className = variants[status] || "bg-muted text-muted-foreground";
  const label = status ? t(`status.${status}`) : "";
  return <Badge className={className}>{label}</Badge>;
};
