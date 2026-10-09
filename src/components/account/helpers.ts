import { type ProfileRow, type ProfileForm } from "@/components/account/types";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useSubmitLock } from "@/lib/submit-lock";
import { toast } from "sonner";

export function profileFormFromRow(row: ProfileRow): ProfileForm {
  return {
    full_name: row.full_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
  };
}

export function useProfileData() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile-account", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useSyncedProfileForm(data: ProfileRow | undefined) {
  const [form, setForm] = useState<ProfileForm>({ full_name: "", email: "", phone: "" });
  const [loadedProfileKey, setLoadedProfileKey] = useState<string | null>(null);

  const nextForm = data ? profileFormFromRow(data) : null;
  const profileKey = nextForm ? Object.values(nextForm).join("|") : null;

  if (nextForm && profileKey !== loadedProfileKey) {
    setForm(nextForm);
    setLoadedProfileKey(profileKey);
  }

  return [form, setForm] as const;
}

export function useSaveProfile(form: ProfileForm) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const saveLock = useSubmitLock();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Utente non autenticato");
      const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profilo aggiornato");
      qc.invalidateQueries({ queryKey: ["profile-account"] });
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["profile-full"] });
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: saveLock.release,
  });

  const save = () => {
    if (saveLock.acquire()) saveMutation.mutate();
  };

  return { isSaving: saveMutation.isPending, save };
}

export function useProfileForm() {
  const { data, isLoading } = useProfileData();
  const [form, setForm] = useSyncedProfileForm(data);
  const { isSaving, save } = useSaveProfile(form);
  return { form, setForm, isLoading, isSaving, save };
}
