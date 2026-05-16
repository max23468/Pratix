import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/import-archivio")({
  beforeLoad: () => {
    throw redirect({ to: "/creazione-guidata" });
  },
});
