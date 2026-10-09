import { TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function NotificationsTab() {
  return (
    <TabsContent value="notifiche" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Notifiche</CardTitle>
          <CardDescription>
            Le notifiche di prodotto sono già attive: vedi un pallino sulla campanella in alto
            quando esce una nuova versione di Pratix.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            In futuro qui potrai gestire promemoria via email per fatture e aggiornamenti
            importanti.
          </p>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
