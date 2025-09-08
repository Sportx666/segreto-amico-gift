import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonGridProps {
  count?: number;
  columns?: "1" | "2" | "3" | "4";
  className?: string;
}

export function SkeletonGrid({ 
  count = 6, 
  columns = "3",
  className 
}: SkeletonGridProps) {
  const gridCols = {
    "1": "grid-cols-1",
    "2": "grid-cols-1 md:grid-cols-2", 
    "3": "grid-cols-2 md:grid-cols-3",
    "4": "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}