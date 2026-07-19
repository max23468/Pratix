/**
 * Helper per gli insert Supabase su tabelle con colonne generate da trigger.
 *
 * Alcune colonne (`public_code`) sono `NOT NULL` senza `DEFAULT` a schema e
 * vengono popolate da un trigger `BEFORE INSERT` (`assign_public_code`).
 * Il generatore di tipi Supabase legge solo lo schema e non i trigger, quindi
 * le marca obbligatorie nel tipo `Insert`: il payload applicativo, che
 * correttamente non le valorizza, verrebbe rifiutato in fase di type-check.
 *
 * Questo helper dichiara quell'invariante in un punto solo, invece di
 * disseminare cast nei form. Non altera il valore a runtime.
 *
 * Vedi `supabase/schema.sql` (funzione `public.assign_public_code`) e
 * `docs/data-model.md`.
 */
export function withTriggerGeneratedCode<T extends object>(
  payload: T,
): T & { public_code: string } {
  return payload as T & { public_code: string };
}
