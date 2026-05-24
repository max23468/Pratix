import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  inputClassName?: string;
  id?: string;
};

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  id,
}: SearchInputProps) {
  return (
    <div className={cn("relative max-w-sm flex-1", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn("pl-9", inputClassName)}
      />
    </div>
  );
}
