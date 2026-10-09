import { TabsContent } from "@/components/ui/tabs";
import { DataExportCard } from "@/components/account/data-export-card";
import { DeleteAccountCard } from "@/components/account/delete-account-card";

export function DataTab({ email, onDeleted }: { email: string; onDeleted: () => Promise<void> }) {
  return (
    <TabsContent value="dati" className="space-y-4">
      <DataExportCard />
      <DeleteAccountCard email={email} onDeleted={onDeleted} />
    </TabsContent>
  );
}
