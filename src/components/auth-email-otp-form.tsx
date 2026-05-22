import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { OTP_CODE_LENGTH, oneTimeCodeSchema } from "@/lib/auth-schemas";

type AuthEmailOtpFormProps = {
  email: string | null;
  onVerified: () => void;
};

function normalizeCodeInput(value: string) {
  return value.replace(/\D/g, "").slice(0, OTP_CODE_LENGTH);
}

function getOtpErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (/expired|invalid|token|otp|code/.test(message)) {
    return "Il codice non è valido o è scaduto. Controlla le cifre oppure richiedi un nuovo link.";
  }

  return "Non siamo riusciti a verificare il codice. Riprova tra poco.";
}

export function AuthEmailOtpForm({ email, onVerified }: AuthEmailOtpFormProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!email) {
      toast.error("Richiedi un nuovo link prima di inserire il codice.");
      return;
    }

    const parsed = oneTimeCodeSchema.safeParse(code);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Codice non valido");
      return;
    }

    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: parsed.data,
        type: "email",
      });

      if (error) throw error;

      onVerified();
    } catch (error) {
      toast.error(getOtpErrorMessage(error));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div className="space-y-2">
        <Label htmlFor="one-time-code">Codice monouso</Label>
        <Input
          id="one-time-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={OTP_CODE_LENGTH}
          value={code}
          onChange={(event) => setCode(normalizeCodeInput(event.target.value))}
          placeholder="123456"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={verifying}>
        {verifying ? "Verifica codice…" : "Entra con codice"}
      </Button>
    </form>
  );
}
