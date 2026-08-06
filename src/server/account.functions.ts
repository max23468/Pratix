import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ACCOUNT_DATA_DELETE_TABLE_ORDER,
  accountStoragePrefix,
  mergeStoragePaths,
  ownedStoragePaths,
  PRATIX_DOCUMENTS_BUCKET,
  validateDeleteAccountInput,
} from "@/server/account-deletion.logic";

type StorageListItem = {
  id?: string | null;
  name: string;
  metadata?: unknown;
};

async function listStoragePaths(prefix: string): Promise<string[]> {
  const pageSize = 1000;
  const listPage = async (offset: number): Promise<string[]> => {
    const { data, error } = await supabaseAdmin.storage
      .from(PRATIX_DOCUMENTS_BUCKET)
      .list(prefix, { limit: pageSize, offset });
    if (error) throw error;

    const page = (data ?? []) as StorageListItem[];
    const paths = (
      await Promise.all(
        page.map(async (item) => {
          const path = `${prefix}/${item.name}`;
          const isFolder = !item.id && !item.metadata;
          return isFolder ? listStoragePaths(path) : [path];
        }),
      )
    ).flat();
    return page.length < pageSize ? paths : [...paths, ...(await listPage(offset + pageSize))];
  };

  return listPage(0);
}

async function removeStoragePaths(paths: string[]) {
  await Promise.all(
    Array.from({ length: Math.ceil(paths.length / 100) }, (_, index) =>
      paths.slice(index * 100, (index + 1) * 100),
    ).map(async (chunk) => {
      const { error } = await supabaseAdmin.storage.from(PRATIX_DOCUMENTS_BUCKET).remove(chunk);
      if (error) throw error;
    }),
  );
}

async function tryRemoveStoragePaths(paths: string[]) {
  if (paths.length === 0) {
    return { removedStorageObjects: 0, storageCleanupCompleted: true };
  }

  try {
    await removeStoragePaths(paths);
    return { removedStorageObjects: paths.length, storageCleanupCompleted: true };
  } catch {
    return { removedStorageObjects: 0, storageCleanupCompleted: false };
  }
}

async function knownStoragePaths(userId: string) {
  const [attachmentsResult, exportsResult, importsResult] = await Promise.all([
    supabaseAdmin.from("activity_attachments").select("storage_path").eq("user_id", userId),
    supabaseAdmin.from("billing_exports").select("storage_path").eq("user_id", userId),
    supabaseAdmin.from("imports").select("source_storage_path").eq("user_id", userId),
  ]);

  for (const result of [attachmentsResult, exportsResult, importsResult]) {
    if (result.error) throw result.error;
  }

  return mergeStoragePaths(
    (attachmentsResult.data ?? []).map((row) => row.storage_path),
    (exportsResult.data ?? []).map((row) => row.storage_path),
    (importsResult.data ?? []).map((row) => row.source_storage_path),
  );
}

async function deleteAccountData(userId: string) {
  const deleteAt = async (index: number): Promise<void> => {
    const table = ACCOUNT_DATA_DELETE_TABLE_ORDER[index];
    if (!table) return;
    // `profiles` è l'unica tabella chiavata su `id` (pari all'id utente auth);
    // tutte le altre su `user_id`. I due rami restano separati perché
    // TypeScript non correla il nome della tabella alla colonna owner
    // all'interno di una singola chiamata generica. Ordine invariato.
    const { error } =
      table === "profiles"
        ? await supabaseAdmin.from(table).delete().eq("id", userId)
        : await supabaseAdmin.from(table).delete().eq("user_id", userId);
    if (error) throw error;
    await deleteAt(index + 1);
  };
  await deleteAt(0);
}

export const deleteAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateDeleteAccountInput)
  .handler(async ({ context }) => {
    const userId = context.userId;
    const prefix = accountStoragePrefix(userId);
    const paths = ownedStoragePaths(
      userId,
      await knownStoragePaths(userId),
      await listStoragePaths(prefix),
    );

    await deleteAccountData(userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return { deleted: true, ...(await tryRemoveStoragePaths(paths)) };
  });
