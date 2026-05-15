import { Link } from "@tanstack/react-router";
import { UserCircle, LogOut, Settings, KeyRound, FileInput } from "lucide-react";
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

/**
 * Menu utente discreto in topbar: avatar circolare con iniziale,
 * porta a /account (profilo, sicurezza, aspetto, notifiche).
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
          className="relative size-8 rounded-full"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
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
        <DropdownMenuItem asChild>
          <Link to="/account">
            <UserCircle className="mr-2 size-4" />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/account">
            <KeyRound className="mr-2 size-4" />
            Cambia password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/impostazioni">
            <Settings className="mr-2 size-4" />
            Impostazioni
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/import-archivio">
            <FileInput className="mr-2 size-4" />
            Import archivio
          </Link>
        </DropdownMenuItem>
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
