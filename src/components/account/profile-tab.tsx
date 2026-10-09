import { useProfileForm } from "@/components/account/helpers";
import { TabsContent } from "@/components/ui/tabs";
import { ProfileFieldsCard } from "@/components/account/profile-fields-card";
import { ProfileSaveButton } from "@/components/account/profile-save-button";
import { VersionFooter } from "@/components/account/version-footer";

export function ProfileTab({ profile }: { profile: ReturnType<typeof useProfileForm> }) {
  const { form, setForm, isLoading, isSaving, save } = profile;
  return (
    <TabsContent value="profilo" className="space-y-4">
      <ProfileFieldsCard
        form={form}
        onChange={(field, value) => setForm((s) => ({ ...s, [field]: value }))}
      />
      <ProfileSaveButton isSaving={isSaving} isLoading={isLoading} onSave={save} />
      <VersionFooter />
    </TabsContent>
  );
}
