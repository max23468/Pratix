import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type NavigationBlocker = {
  blockerFn: () => boolean | Promise<boolean>;
  enableBeforeUnload?: boolean;
};

type RouterHistory = {
  block?: (blocker: NavigationBlocker) => () => void;
};

type BlockerState = {
  status: "idle" | "blocked";
  proceed?: () => void;
  reset?: () => void;
};

type UnsavedChangesGuard = {
  formRef: RefObject<HTMLFormElement | null>;
  guardDialog: ReactNode;
  markDirty: () => void;
  finishSave: () => boolean;
};

export function useUnsavedChangesGuard({
  isSaving = false,
  disabled = false,
}: {
  isSaving?: boolean;
  disabled?: boolean;
} = {}): UnsavedChangesGuard {
  const router = useRouter({ warn: false });
  const formRef = useRef<HTMLFormElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [blocker, setBlocker] = useState<BlockerState>({ status: "idle" });
  const isDirtyRef = useRef(isDirty);
  const disabledRef = useRef(disabled);
  const saveRequestedFromDialogRef = useRef(false);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    const history = (router?.history ?? null) as RouterHistory | null;
    if (!history?.block) return;

    return history.block({
      blockerFn: async () => {
        if (!isDirtyRef.current || disabledRef.current) return false;

        return new Promise<boolean>((resolve) => {
          const settle = (shouldBlock: boolean) => {
            resolve(shouldBlock);
            setBlocker({ status: "idle" });
          };

          setBlocker({
            status: "blocked",
            proceed: () => settle(false),
            reset: () => settle(true),
          });
        });
      },
      enableBeforeUnload: false,
    });
  }, [router]);

  useEffect(() => {
    if (!isDirty || disabled) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [disabled, isDirty]);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const leaveWithoutSaving = useCallback(() => {
    saveRequestedFromDialogRef.current = false;
    setIsDirty(false);
    blocker.proceed?.();
  }, [blocker]);

  const stayHere = useCallback(() => {
    saveRequestedFromDialogRef.current = false;
    blocker.reset?.();
  }, [blocker]);

  const saveAndContinue = useCallback(() => {
    saveRequestedFromDialogRef.current = true;
    formRef.current?.requestSubmit();
  }, []);

  const finishSave = useCallback(() => {
    setIsDirty(false);
    if (saveRequestedFromDialogRef.current && blocker.status === "blocked") {
      saveRequestedFromDialogRef.current = false;
      blocker.proceed?.();
      return true;
    }

    saveRequestedFromDialogRef.current = false;
    return false;
  }, [blocker]);

  const guardDialog = (
    <AlertDialog open={blocker.status === "blocked"}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Modifiche non salvate</AlertDialogTitle>
          <AlertDialogDescription>
            Hai modificato dei dati senza salvarli. Puoi salvarli prima di uscire oppure restare su
            questa pagina.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={stayHere}>Resta qui</AlertDialogCancel>
          <Button type="button" variant="outline" onClick={leaveWithoutSaving}>
            Esci senza salvare
          </Button>
          <Button type="button" onClick={saveAndContinue} disabled={isSaving}>
            {isSaving ? "Salvataggio..." : "Salva"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { formRef, guardDialog, markDirty, finishSave };
}
