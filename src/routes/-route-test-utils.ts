import type { ComponentType } from "react";

/**
 * Accessori tipizzati per i test sulle route TanStack.
 *
 * `createFileRoute` assegna `component` e `head` sull'oggetto Route a runtime,
 * ma il tipo pubblico `Route<...>` non li espone: leggerli direttamente nei
 * test produce TS2339. Passare da `Route.options` non è equivalente a runtime
 * (le proprietà lì non sono valorizzate), quindi l'accesso resta diretto e il
 * cast è isolato qui invece di essere ripetuto in ogni file di test.
 */
type RouteHead = { meta: Array<Record<string, string>> };

export function routeComponent(route: unknown): ComponentType {
  return (route as { component: ComponentType }).component;
}

export function routeHead(route: unknown): () => RouteHead {
  return (route as { head: () => RouteHead }).head;
}
