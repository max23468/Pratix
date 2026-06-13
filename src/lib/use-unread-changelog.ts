import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { APP_VERSION } from "@/lib/version";
import { hasUnreadChangelog } from "@/lib/changelog";

/**
 * Hook che indica se l'utente ha novità non lette nel changelog,
 * confrontando `APP_VERSION` con `profiles.last_seen_changelog_version`.
 *
 * Espone anche `markAsRead()` che persiste la versione corrente sul profilo.
 */
export function useUnreadChangelog() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const profileId = session?.user.id;

  const { data: lastSeen, isLoading } = useQuery({
    enabled: !!profileId,
    queryKey: ["changelog-last-seen", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("last_seen_changelog_version")
        .eq("id", profileId!)
        .maybeSingle();
      if (error) throw error;
      return data?.last_seen_changelog_version ?? null;
    },
  });

  const { mutate: markAsRead } = useMutation({
    mutationFn: async () => {
      if (!profileId) return;
      const { error } = await supabase
        .from("profiles")
        .update({ last_seen_changelog_version: APP_VERSION })
        .eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changelog-last-seen", profileId] });
    },
  });

  const hasUnread = !isLoading && hasUnreadChangelog(APP_VERSION, lastSeen);

  return {
    hasUnread,
    isLoading,
    lastSeen,
    currentVersion: APP_VERSION,
    markAsRead,
  };
}
