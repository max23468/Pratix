import { useMutation } from "@tanstack/react-query";
import { Download, FileArchive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { downloadBytes } from "@/lib/file-downloads";
import {
  buildPersonalDataCsvArchive,
  buildPersonalDataJson,
  PERSONAL_DATA_TABLES,
  type PersonalDataPayload,
  type PersonalDataTable,
} from "@/lib/personal-data-export";

export function DataExportCard() {
  const fetchTableRows = async (table: PersonalDataTable) => {
    const pageSize = 1000;
    const rows: unknown[] = [];

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;

      const page = (data ?? []) as unknown[];
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  };

  const buildPayload = async (): Promise<PersonalDataPayload> => {
    const entries = await Promise.all(
      PERSONAL_DATA_TABLES.map(async (table) => {
        return [table, await fetchTableRows(table)] as const;
      }),
    );

    return {
      exportedAt: new Date().toISOString(),
      product: "Pratix",
      tables: Object.fromEntries(entries),
    };
  };

  const exportMutation = useMutation({
    mutationFn: async (format: "json" | "csv") => {
      const payload = await buildPayload();
      const date = new Date().toISOString().slice(0, 10);

      if (format === "json") {
        const file = buildPersonalDataJson(payload);
        downloadBytes({
          bytes: file.bytes,
          fileName: `pratix-export-dati-${date}.json`,
          mimeType: file.mimeType,
        });
        return "json";
      }

      const archive = buildPersonalDataCsvArchive(payload);
      downloadBytes({
        bytes: archive.bytes,
        fileName: `pratix-export-dati-${date}.zip`,
        mimeType: archive.mimeType,
      });
      return "csv";
    },
    onSuccess: (format) =>
      toast.success(format === "json" ? "Export JSON generato" : "Archivio CSV generato"),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="size-4 text-muted-foreground" />
          Export dati
        </CardTitle>
        <CardDescription>
          Scarica una copia dei dati personali e operativi in formato JSON o CSV.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={() => exportMutation.mutate("json")}
          disabled={exportMutation.isPending}
        >
          <Download className="mr-2 size-4" />
          {exportMutation.isPending ? "Preparazione…" : "Scarica JSON"}
        </Button>
        <Button
          variant="outline"
          onClick={() => exportMutation.mutate("csv")}
          disabled={exportMutation.isPending}
        >
          <FileArchive className="mr-2 size-4" />
          {exportMutation.isPending ? "Preparazione…" : "Scarica CSV"}
        </Button>
      </CardContent>
    </Card>
  );
}
