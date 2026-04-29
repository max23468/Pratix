import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/impostazioni")({
  component: () => (
    <AppLayout>
      <PageHeader
        title="Impostazioni"
        description="Dati dello studio, regime fiscale, IBAN e parametri di fatturazione."
      />
      <ComingSoon
        title="Pagina impostazioni in arrivo"
        description="Qui potrai aggiornare i dati dell'onboarding e gestire le preferenze del tuo studio."
      />
    </AppLayout>
  ),
});
