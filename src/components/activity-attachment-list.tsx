import { Download, Eye, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PRATIX_DOCUMENTS_BUCKET } from "@/lib/storage-paths";

export type ActivityAttachment = {
  id: string;
  storage_path: string;
  display_name: string;
  document_type: string | null;
  original_file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  preview_available: boolean;
};

export function ActivityAttachmentList({ attachments }: { attachments: ActivityAttachment[] }) {
  if (attachments.length === 0)
    return <span className="text-sm text-muted-foreground">Nessun allegato</span>;
  return (
    <div className="flex flex-col gap-1">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex items-center gap-1">
          <Paperclip className="size-3.5 text-muted-foreground" />
          <span className="max-w-36 truncate text-xs">{attachment.display_name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => openAttachment(attachment, "preview")}
          >
            <Eye className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => openAttachment(attachment, "download")}
          >
            <Download className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

async function openAttachment(attachment: ActivityAttachment, mode: "preview" | "download") {
  const { data, error } = await supabase.storage
    .from(PRATIX_DOCUMENTS_BUCKET)
    .createSignedUrl(
      attachment.storage_path,
      60,
      mode === "download" ? { download: attachment.display_name } : undefined,
    );
  if (error) return void toast.error(error.message);
  if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}
