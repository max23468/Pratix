import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme, type ThemeMode } from "@/lib/theme-context";

const options: { value: ThemeMode; label: string; description: string }[] = [
  { value: "light", label: "Chiaro", description: "Sfondo panna, inchiostro come primario." },
  { value: "dark", label: "Scuro", description: "Inchiostro profondo, terracotta come accento." },
  { value: "system", label: "Sistema", description: "Segue le preferenze del tuo dispositivo." },
];

export function AppearanceCard() {
  const { mode, setMode, resolved } = useTheme();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tema</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          {options.map((opt) => {
            const active = mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  active
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <p className="font-display text-sm font-semibold text-foreground">{opt.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{opt.description}</p>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Tema attivo: <strong className="text-foreground">{resolved === "dark" ? "Scuro" : "Chiaro"}</strong>
          {mode === "system" ? " (da sistema)" : ""}.
        </p>
      </CardContent>
    </Card>
  );
}
