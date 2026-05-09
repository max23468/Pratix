import { describe, expect, it, vi } from "vitest";

const { createRouter, routeTree } = vi.hoisted(() => ({
  createRouter: vi.fn((options: unknown) => ({ options })),
  routeTree: { id: "root" },
}));

vi.mock("@tanstack/react-router", () => ({ createRouter }));

vi.mock("./routeTree.gen", () => ({ routeTree }));

import { DefaultErrorComponent } from "@/components/default-error";
import { getRouter } from "./router";

describe("getRouter", () => {
  it("crea il router TanStack con configurazione applicativa", () => {
    const router = getRouter();

    expect(createRouter).toHaveBeenCalledWith(
      expect.objectContaining({
        routeTree,
        scrollRestoration: true,
        defaultPreloadStaleTime: 0,
        defaultErrorComponent: DefaultErrorComponent,
      }),
    );
    expect(router).toEqual({ options: expect.any(Object) });
  });
});
