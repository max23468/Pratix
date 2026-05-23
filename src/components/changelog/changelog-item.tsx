import { splitChangelogItem } from "@/components/changelog/changelog-utils";

export function ChangelogItem({ text }: { text: string }) {
  const parts = splitChangelogItem(text);

  return (
    <>
      {parts.map(({ key, part }) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={key} className="font-medium text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={key}>{part}</span>;
      })}
    </>
  );
}
