import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function PrincipalEconomicRules({
  feesEnabled,
  expensesEnabled,
  generalExpensesRate,
  cassaRate,
  onFeesChange,
  onExpensesChange,
  onGeneralExpensesChange,
  onCassaChange,
}: {
  feesEnabled: boolean;
  expensesEnabled: boolean;
  generalExpensesRate: number;
  cassaRate: number;
  onFeesChange: (value: boolean) => void;
  onExpensesChange: (value: boolean) => void;
  onGeneralExpensesChange: (value: number) => void;
  onCassaChange: (value: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Regole economiche</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="fees_enabled">Compensi</Label>
              <p className="text-xs text-muted-foreground">Abilita voci imponibili.</p>
            </div>
            <Switch id="fees_enabled" checked={feesEnabled} onCheckedChange={onFeesChange} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="expense_reimbursements_enabled">Rimborsi spese</Label>
              <p className="text-xs text-muted-foreground">Abilita anticipazioni Art. 15.</p>
            </div>
            <Switch
              id="expense_reimbursements_enabled"
              checked={expensesEnabled}
              onCheckedChange={onExpensesChange}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="general_expenses">Spese generali (%)</Label>
            <Input
              id="general_expenses"
              type="number"
              min="0"
              step="0.01"
              value={generalExpensesRate}
              onChange={(event) => onGeneralExpensesChange(Number(event.target.value))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cassa_rate">Cassa forense (%)</Label>
            <Input
              id="cassa_rate"
              type="number"
              min="0"
              step="0.01"
              value={cassaRate}
              onChange={(event) => onCassaChange(Number(event.target.value))}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
