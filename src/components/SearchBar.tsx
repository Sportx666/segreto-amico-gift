import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  disabled?: boolean;
  value?: string; // controlled value (optional)
  onChangeText?: (value: string) => void; // controlled change handler (optional)
}

export const SearchBar = ({ 
  onSearch, 
  placeholder = "Cerca prodotti su Amazon...", 
  disabled = false,
  value,
  onChangeText,
}: SearchBarProps) => {
  const [inner, setInner] = useState("");
  const isControlled = value !== undefined;
  const query = isControlled ? (value as string) : inner;
  const setQuery = (v: string) => {
    if (isControlled) {
      onChangeText?.(v);
    } else {
      setInner(v);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleClear = () => setQuery("");

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
      <div className="relative flex-1">
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-10"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Button 
        type="submit" 
        disabled={disabled || !query.trim()}
        className="px-6"
      >
        <Search className="w-4 h-4 mr-2" />
        Cerca
      </Button>
    </form>
  );
};

