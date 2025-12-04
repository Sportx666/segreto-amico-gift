import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  to: string;
  label?: string;
  className?: string;
}

export function BackButton({ to, label = "Torna indietro", className }: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <div className={cn("container max-w-6xl py-2 md:py-3", className)}>
      <Button
        variant="ghost"
        onClick={() => navigate(to)}
        className="text-muted-foreground hover:text-foreground focus-ring"
        aria-label={label}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {label}
      </Button>
    </div>
  );
}
