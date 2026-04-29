import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

type Props = {
  title: string;
  description?: string;
  children?: ReactNode;
};

export function ComingSoon({ title, description, children }: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Construction className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
