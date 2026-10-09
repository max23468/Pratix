import { createFileRoute } from "@tanstack/react-router";
import { useProfileForm } from "@/components/account/helpers";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Tabs } from "@/components/ui/tabs";
import { AccountTabsList } from "@/components/account/account-tabs-list";
import { ProfileTab } from "@/components/account/profile-tab";
import { SecurityTab } from "@/components/account/security-tab";
import { AppearanceTab } from "@/components/account/appearance-tab";
import { NotificationsTab } from "@/components/account/notifications-tab";
import { DataTab } from "@/components/account/data-tab";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/account")({
  validateSearch: (search: Record<string, unknown>): AccountSearch => ({
    tab: parseAccountTab(search.tab),
  }),
  head: () => ({
    meta: [
      { title: "Account · Pratix" },
      {
        name: "description",
        content: "Profilo, accesso, aspetto, notifiche e dati del tuo account Pratix.",
      },
      { property: "og:title", content: "Account · Pratix" },
      {
        property: "og:description",
        content: "Profilo, accesso, aspetto, notifiche e dati del tuo account Pratix.",
      },
    ],
  }),
  component: AccountPage,
});

const accountTabs = ["profilo", "sicurezza", "aspetto", "notifiche", "dati"] as const;

type AccountTab = (typeof accountTabs)[number];

type AccountSearch = {
  tab?: AccountTab;
};

function parseAccountTab(tab: unknown) {
  return accountTabs.includes(tab as AccountTab) ? (tab as AccountTab) : undefined;
}

function AccountPage() {
  const profile = useProfileForm();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const activeTab = search.tab ?? "profilo";

  return (
    <AppLayout>
      <PageHeader
        title="Account"
        description="Profilo, accesso, aspetto, notifiche e dati personali del professionista."
      />

      <Tabs
        value={activeTab}
        onValueChange={(nextTab) => {
          navigate({
            search: { tab: parseAccountTab(nextTab) },
            replace: true,
          });
        }}
        className="space-y-4"
      >
        <AccountTabsList />
        <ProfileTab profile={profile} />
        <SecurityTab userId={user?.id ?? ""} email={user?.email ?? ""} />
        <AppearanceTab />
        <NotificationsTab />
        <DataTab
          email={user?.email ?? ""}
          onDeleted={async () => {
            qc.clear();
            await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
            navigate({ to: "/" });
          }}
        />
      </Tabs>
    </AppLayout>
  );
}
