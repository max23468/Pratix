import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AccountTabsList() {
  return (
    <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:w-auto">
      <TabsTrigger value="profilo" className="min-w-0 whitespace-normal text-center">
        Profilo
      </TabsTrigger>
      <TabsTrigger value="sicurezza" className="min-w-0 whitespace-normal text-center">
        Accesso e sicurezza
      </TabsTrigger>
      <TabsTrigger value="aspetto" className="min-w-0 whitespace-normal text-center">
        Aspetto
      </TabsTrigger>
      <TabsTrigger value="notifiche" className="min-w-0 whitespace-normal text-center">
        Notifiche
      </TabsTrigger>
      <TabsTrigger value="dati" className="min-w-0 whitespace-normal text-center">
        Dati
      </TabsTrigger>
    </TabsList>
  );
}
