import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { priceItemKindLabels } from "@/lib/labels";
import type { PriceItemKind } from "@/lib/price-templates";
import type { PriceItemDraft } from "@/components/price-book-form";

type Props = {
  title: string;
  description: string;
  kind: PriceItemKind;
  items: PriceItemDraft[];
  onAdd: (kind: PriceItemKind) => void;
  onRemove: (index: number) => void;
  onUpdate: <K extends keyof PriceItemDraft>(
    index: number,
    key: K,
    value: PriceItemDraft[K],
  ) => void;
};

export function PriceItemsEditor({
  title,
  description,
  kind,
  items,
  onAdd,
  onRemove,
  onUpdate,
}: Props) {
  const editorId = useId();
  const sectionItems = items
    .flatMap((item, index) => (item.kind === kind ? [{ item, index }] : []))
    .sort((a, b) => a.item.sort_order - b.item.sort_order);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onAdd(kind)}>
            <Plus className="mr-1 size-4" /> Voce
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Codice</TableHead>
              <TableHead>Voce</TableHead>
              <TableHead>Prezzo</TableHead>
              <TableHead>Udienze</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectionItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Nessuna voce.
                </TableCell>
              </TableRow>
            ) : (
              sectionItems.map(({ item, index }) => {
                const enabledSwitchId = `${editorId}-price-item-${item.id ?? `${item.kind}-${index}`}-enabled`;
                return (
                  <TableRow key={item.id ?? `${item.kind}-${index}`}>
                    <TableCell>
                      <Input
                        value={item.code}
                        onChange={(event) =>
                          onUpdate(index, "code", event.target.value.toUpperCase())
                        }
                        className="min-w-40"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-72 flex-col gap-2">
                        <Input
                          value={item.name}
                          onChange={(event) => onUpdate(index, "name", event.target.value)}
                          placeholder={priceItemKindLabels[item.kind]}
                        />
                        <Input
                          value={item.invoice_description ?? ""}
                          onChange={(event) =>
                            onUpdate(index, "invoice_description", event.target.value)
                          }
                          placeholder="Es. Redazione diffida stragiudiziale"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.kind === "fee" ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price ?? 0}
                          onChange={(event) =>
                            onUpdate(index, "unit_price", Number(event.target.value))
                          }
                          className="min-w-28"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">Libero</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={item.requires_hearing_dates}
                        onCheckedChange={(checked) =>
                          onUpdate(index, "requires_hearing_dates", checked === true)
                        }
                        disabled={item.kind !== "fee"}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <Badge variant={item.is_enabled ? "outline" : "secondary"}>
                          {item.is_enabled ? "Abilitata" : "Disabilitata"}
                        </Badge>
                        {item.usedCount ? (
                          <span className="text-xs text-muted-foreground">
                            Usata {item.usedCount} volte
                          </span>
                        ) : null}
                        <label
                          htmlFor={enabledSwitchId}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <Switch
                            id={enabledSwitchId}
                            checked={item.is_enabled}
                            onCheckedChange={(checked) => onUpdate(index, "is_enabled", checked)}
                          />{" "}
                          Visibile
                        </label>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
