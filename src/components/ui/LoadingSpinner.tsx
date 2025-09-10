/**
 * Reusable loading spinner component
 */
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'white';
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8', 
  lg: 'h-12 w-12'
};

const variantMap = {
  primary: 'border-primary',
  secondary: 'border-muted-foreground',
  white: 'border-white'
};

export function LoadingSpinner({ 
  className, 
  size = 'md', 
  variant = 'primary' 
}: LoadingSpinnerProps) {
  return (
    <div 
      className={cn(
        "animate-spin rounded-full border-2 border-t-transparent",
        sizeMap[size],
        variantMap[variant],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}