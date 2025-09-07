import { Badge } from "@/components/ui/badge";

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
  const className = variants[status] || "bg-muted text-muted-foreground";
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "";
  return <Badge className={className}>{label}</Badge>;
};
