import { APP_VERSION, BUILD_DATE } from "@/lib/version";
import { Link } from "@tanstack/react-router";

export function VersionFooter() {
  return (
    <div className="mt-8 flex flex-col gap-1 border-t pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Pratix <span className="font-mono">v{APP_VERSION}</span>
        <span className="mx-1.5">·</span>
        build {BUILD_DATE}
      </span>
      <Link to="/novita" className="underline-offset-2 hover:underline">
        Cosa è cambiato
      </Link>
    </div>
  );
}
