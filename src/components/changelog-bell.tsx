import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnreadChangelog } from "@/lib/use-unread-changelog";

/**
 * Campanella discreta in topbar: mostra un puntino terracotta quando
 * c'è una versione del prodotto più recente di quella già vista dall'utente.
 */
export function ChangelogBell() {
  const { hasUnread } = useUnreadChangelog();

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      aria-label={hasUnread ? "Novità disponibili" : "Novità"}
      className="relative h-8 w-8"
    >
      <Link to="/novita">
        <Bell className="h-4 w-4" />
        {hasUnread && (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 inline-flex h-2 w-2 rounded-full bg-[var(--brand-gold)] ring-2 ring-background"
          />
        )}
      </Link>
    </Button>
  );
}
