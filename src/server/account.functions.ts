import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ACCOUNT_DATA_DELETE_TABLE_ORDER,
  type AccountDataDeleteTable,
  accountStoragePrefix,
  mergeStoragePaths,
  PRATIX_DOCUMENTS_BUCKET,
  validateDeleteAccountInput,
} from "@/server/account-deletion.logic";

type StorageListItem = {
  id?: string | null;
  name: string;
  metadata?: unknown;
};

async function listStoragePaths(prefix: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.storage
    .from(PRATIX_DOCUMENTS_BUCKET)
    .list(prefix, { limit: 1000 });
  if (error) throw error;

  const paths: string[] = [];
  for (const item of (data ?? []) as StorageListItem[]) {
    const path = `${prefix}/${item.name}`;
    const isFolder = !item.id && !item.metadata;
    if (isFolder) {
      paths.push(...(await listStoragePaths(path)));
      continue;
    }
    paths.push(path);
  }

  return paths;
}

async function removeStoragePaths(paths: string[]) {
  for (let index = 0; index < paths.length; index += 100) {
    const chunk = paths.slice(index, index + 100);
    if (chunk.length === 0) continue;
    const { error } = await supabaseAdmin.storage.from(PRATIX_DOCUMENTS_BUCKET).remove(chunk);
    if (error) throw error;
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
  for (const table of ACCOUNT_DATA_DELETE_TABLE_ORDER) {
    const ownerColumn = ownerColumnFor(table);
    const { error } = await supabaseAdmin.from(table).delete().eq(ownerColumn, userId);
    if (error) throw error;
  }
}

function ownerColumnFor(table: AccountDataDeleteTable) {
  return table === "profiles" ? "id" : "user_id";
}

export const deleteAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateDeleteAccountInput)
  .handler(async ({ context }) => {
    const userId = context.userId;
    const prefix = accountStoragePrefix(userId);
    const paths = mergeStoragePaths(
      await knownStoragePaths(userId),
      await listStoragePaths(prefix),
    );

    await deleteAccountData(userId);

    if (paths.length > 0) {
      await removeStoragePaths(paths);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return { deleted: true, removedStorageObjects: paths.length };
  });
