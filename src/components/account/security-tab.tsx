import { TabsContent } from "@/components/ui/tabs";
import { EmailAccessCard } from "@/components/account/email-access-card";
import { PasskeyAccessCard } from "@/components/account/passkey-access-card";

export function SecurityTab({ userId, email }: { userId: string; email: string }) {
  return (
    <TabsContent value="sicurezza" className="space-y-4">
      <EmailAccessCard key={email} email={email} />
      <PasskeyAccessCard userId={userId} />
    </TabsContent>
  );
}
