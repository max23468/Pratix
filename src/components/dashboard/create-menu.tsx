import { Link } from "@tanstack/react-router";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CREATE_ACTIONS } from "@/components/dashboard/types";

export function CreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" aria-label="Apri menu creazione">
          <Plus className="mr-1 size-4" />
          Crea
          <ChevronDown className="ml-1 size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Cosa vuoi creare?</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CREATE_ACTIONS.map((action) => (
          <DropdownMenuItem key={action.to} asChild>
            <Link to={action.to} className="items-start gap-3 py-2">
              <action.icon className="mt-0.5 size-4" strokeWidth={1.7} />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{action.title}</span>
                <span className="block text-xs text-muted-foreground">{action.description}</span>
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
