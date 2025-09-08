import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  children,
  className
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col items-center justify-center space-y-4 py-12 px-6 text-center">
        {icon && (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary">
            {icon}
          </div>
        )}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold tracking-tight md:text-xl">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground md:text-base max-w-md">
              {description}
            </p>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}