import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { EuroIcon, X, Filter } from "lucide-react";

interface PriceFilterProps {
  onFilter: (minPrice?: number, maxPrice?: number) => void;
  disabled?: boolean;
}

export const PriceFilter = ({ onFilter, disabled = false }: PriceFilterProps) => {
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [appliedFilter, setAppliedFilter] = useState<{min?: number, max?: number} | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleApplyFilter = () => {
    const min = minPrice ? parseFloat(minPrice) : undefined;
    const max = maxPrice ? parseFloat(maxPrice) : undefined;
    
    if (min && max && min > max) {
      return; // Invalid range
    }
    
    setAppliedFilter(min || max ? { min, max } : null);
    onFilter(min, max);
    setIsOpen(false);
  };

  const handleClearFilter = () => {
    setMinPrice("");
    setMaxPrice("");
    setAppliedFilter(null);
    onFilter(undefined, undefined);
    setIsOpen(false);
  };

  const formatPrice = (price: number) => `€${price}`;

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={disabled}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Prezzo
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Filtra per prezzo</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="min-price" className="text-xs text-muted-foreground">
                    Prezzo minimo
                  </Label>
                  <div className="relative">
                    <EuroIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="min-price"
                      type="number"
                      placeholder="0"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="pl-9"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="max-price" className="text-xs text-muted-foreground">
                    Prezzo massimo
                  </Label>
                  <div className="relative">
                    <EuroIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="max-price"
                      type="number"
                      placeholder="1000"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="pl-9"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClearFilter}
                className="flex-1"
              >
                Cancella
              </Button>
              <Button 
                size="sm" 
                onClick={handleApplyFilter}
                className="flex-1"
              >
                Applica
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      {appliedFilter && (
        <Badge variant="secondary" className="gap-1">
          {appliedFilter.min && formatPrice(appliedFilter.min)}
          {appliedFilter.min && appliedFilter.max && " - "}
          {appliedFilter.max && formatPrice(appliedFilter.max)}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilter}
            className="h-auto p-0 ml-1 hover:bg-transparent"
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}
    </div>
  );
};