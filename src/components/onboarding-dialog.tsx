import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/**
 * Wizard mostrato al primo accesso: raccoglie i dati essenziali dello studio
 * (anagrafici, fiscali, IBAN). Tutto modificabile in seguito da Impostazioni.
 */
export function OnboardingDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [businessName, setBusinessName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressZip, setAddressZip] = useState("");
  const [addressProvince, setAddressProvince] = useState("");
  const [pec, setPec] = useState("");

  const [taxRegime, setTaxRegime] = useState<"ordinario" | "forfettario">("ordinario");
  const [applyWithholding, setApplyWithholding] = useState(true);
  const [iban, setIban] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      const { error } = await supabase
        .from("profiles")
        .update({
          business_name: businessName.trim() || null,
          vat_number: vatNumber.trim() || null,
          tax_code: taxCode.trim() || null,
          address_street: addressStreet.trim() || null,
          address_city: addressCity.trim() || null,
          address_zip: addressZip.trim() || null,
          address_province: addressProvince.trim() || null,
          pec: pec.trim() || null,
          tax_regime: taxRegime,
          apply_withholding: taxRegime === "forfettario" ? false : applyWithholding,
          iban: iban.trim() || null,
          invoice_number_prefix: invoicePrefix.trim() || null,
          onboarding_completed: true,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurazione completata");
      qc.invalidateQueries({ queryKey: ["profile"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleNext = (e: FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (!businessName.trim() && !taxCode.trim()) {
        toast.error("Inserisci almeno la ragione sociale o il codice fiscale");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else {
      mutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* non chiudibile finché non si completa */ }}>
      <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Benvenuto in Pratix</DialogTitle>
          <DialogDescription>
            Configura il tuo studio in tre brevi passaggi. Potrai modificare tutto in seguito.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleNext} className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={step >= 1 ? "font-semibold text-foreground" : ""}>1. Anagrafica</span>
            <span>›</span>
            <span className={step >= 2 ? "font-semibold text-foreground" : ""}>2. Fiscale</span>
            <span>›</span>
            <span className={step >= 3 ? "font-semibold text-foreground" : ""}>3. Pagamenti</span>
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="bn">Ragione sociale / Nome studio</Label>
                <Input id="bn" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Studio Legale Rossi" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vat">P.IVA</Label>
                  <Input id="vat" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tc">Codice fiscale</Label>
                  <Input id="tc" value={taxCode} onChange={(e) => setTaxCode(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="addr">Indirizzo</Label>
                <Input id="addr" value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder="Via..." />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="city">Città</Label>
                  <Input id="city" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">CAP</Label>
                  <Input id="zip" value={addressZip} onChange={(e) => setAddressZip(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov">Provincia (sigla)</Label>
                <Input id="prov" value={addressProvince} maxLength={2} onChange={(e) => setAddressProvince(e.target.value.toUpperCase())} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="pec">PEC</Label>
                <Input id="pec" type="email" value={pec} onChange={(e) => setPec(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="regime">Regime fiscale</Label>
                <Select value={taxRegime} onValueChange={(v) => setTaxRegime(v as "ordinario" | "forfettario")}>
                  <SelectTrigger id="regime">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordinario">Ordinario</SelectItem>
                    <SelectItem value="forfettario">Forfettario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {taxRegime === "ordinario" && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label className="text-sm">Applica ritenuta d'acconto (20%)</Label>
                    <p className="text-xs text-muted-foreground">Standard per professionisti in regime ordinario.</p>
                  </div>
                  <Switch checked={applyWithholding} onCheckedChange={setApplyWithholding} />
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input id="iban" value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefix">Prefisso numerazione fatture (opz.)</Label>
                <Input id="prefix" value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} placeholder="es. FT" />
                <p className="text-xs text-muted-foreground">Es. con prefisso "FT" la prima fattura sarà FT-1/2026.</p>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => setStep((s) => (s === 3 ? 2 : 1))}>
                Indietro
              </Button>
            ) : <div />}
            <Button type="submit" disabled={mutation.isPending}>
              {step < 3 ? "Continua" : mutation.isPending ? "Salvataggio…" : "Inizia ad usare Pratix"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
