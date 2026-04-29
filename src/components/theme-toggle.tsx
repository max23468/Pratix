import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type ThemeMode } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  /** "icon" mostra solo l'icona (compatto, ideale in topbar / sidebar collapsed). "full" mostra anche label. */
  variant?: "icon" | "full";
  className?: string;
};

const labels: Record<ThemeMode, string> = {
  light: "Chiaro",
  dark: "Scuro",
  system: "Sistema",
};

export function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
  const { mode, resolved, setMode } = useTheme();
  const Icon = resolved === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={variant === "icon" ? "icon" : "sm"}
          aria-label="Cambia tema"
          className={cn(
            variant === "icon" ? "h-9 w-9" : "h-9 gap-2 px-2",
            className,
          )}
        >
          <Icon className="h-4 w-4" />
          {variant === "full" && (
            <span className="text-sm font-medium">{labels[mode]}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as ThemeMode)}
        >
          <DropdownMenuRadioItem value="light">
            <Sun className="mr-2 h-4 w-4" /> Chiaro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="mr-2 h-4 w-4" /> Scuro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="mr-2 h-4 w-4" /> Sistema
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
