import { Link } from "@tanstack/react-router";
import { Bell, Database, Fingerprint, LogOut, Palette, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";

const accountItems = [
  { label: "Profilo", tab: "profilo", icon: UserCircle },
  { label: "Accesso e sicurezza", tab: "sicurezza", icon: Fingerprint },
  { label: "Aspetto", tab: "aspetto", icon: Palette },
  { label: "Notifiche", tab: "notifiche", icon: Bell },
  { label: "Dati", tab: "dati", icon: Database },
] as const;

/**
 * Menu utente discreto in topbar: avatar circolare con iniziale,
 * porta alle sezioni personali di /account.
 */
export function UserMenu() {
  const { user, signOut } = useAuth();
  const email = user?.email ?? "";
  const initial = (email[0] || "?").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Apri menu account"
          className="relative size-11 rounded-full sm:size-8"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary sm:size-7">
            {initial}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-xs text-muted-foreground">Connesso come</p>
          <p className="truncate text-sm font-medium text-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accountItems.map(({ label, tab, icon: Icon }) => (
          <DropdownMenuItem asChild key={tab}>
            <Link to="/account" search={{ tab }}>
              <Icon className="mr-2 size-4" />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut()}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 size-4" />
          Esci
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
