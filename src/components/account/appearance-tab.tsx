import { TabsContent } from "@/components/ui/tabs";
import { AppearanceCard } from "@/components/appearance-card";

export function AppearanceTab() {
  return (
    <TabsContent value="aspetto" className="space-y-4">
      <AppearanceCard />
    </TabsContent>
  );
}
