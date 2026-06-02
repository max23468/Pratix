// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShieldCheck, Wrench } from "lucide-react";

import { ReleaseCard } from "./changelog/release-card";
import { ReleasePanel } from "./changelog/release-panel";
import {
  formatChangelogDate,
  groupItemsByArea,
  groupSections,
  sectionIcon,
  splitChangelogItem,
} from "./changelog/changelog-utils";
import { APP_VERSION } from "@/lib/version";

const differentVersion = APP_VERSION === "0.0.1" ? "0.0.2" : "0.0.1";

afterEach(() => {
  cleanup();
});

describe("componenti changelog", () => {
  it("renderizza una release completa con badge, gruppi area e note interne", () => {
    render(
      <ReleaseCard
        entry={{
          version: APP_VERSION,
          date: "2026-06-03",
          unreleased: true,
          nonVersioned: false,
          intro: "Riallineamento coverage e verifiche locali.",
          sections: [
            {
              title: "Novità",
              items: ["**Coverage**: nuovi test su Pratiche e Prezzi"],
            },
            {
              title: "Sicurezza",
              items: ["**Accesso**: gestione più chiara delle sessioni duplicate"],
            },
            {
              title: "Sotto il cofano",
              items: ["**Test**: suite changelog renderizzata e raggruppata per area"],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText(`v${APP_VERSION}`)).toBeTruthy();
    expect(screen.getByText("In uso")).toBeTruthy();
    expect(screen.getByText("In preparazione")).toBeTruthy();
    expect(screen.getByText("Riallineamento coverage e verifiche locali.")).toBeTruthy();
    expect(screen.getByText("Novità")).toBeTruthy();
    expect(screen.getByText("Correzioni")).toBeTruthy();
    expect(screen.getByText("Sotto il cofano · 1 voce")).toBeTruthy();
    expect(screen.getAllByText("Coverage").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Accesso").length).toBeGreaterThan(0);
    expect(screen.getByText("nuovi test su Pratiche e Prezzi")).toBeTruthy();
  });

  it("renderizza il pannello compatto e il fallback quando una release non ha dettagli", () => {
    render(
      <ReleasePanel
        entry={{
          version: differentVersion,
          date: null,
          unreleased: false,
          nonVersioned: false,
          sections: [],
        }}
      />,
    );

    expect(screen.getByText(`v${differentVersion}`)).toBeTruthy();
    expect(screen.getByText("Nessun dettaglio per questa versione.")).toBeTruthy();
    expect(screen.queryByText("In uso")).toBeNull();
    expect(screen.queryByText("In preparazione")).toBeNull();
  });

  it("raggruppa e formatta le sezioni del changelog in modo coerente", () => {
    const sections = [
      { title: "Novità", items: ["**Dashboard**: nuova coda"] },
      { title: "Sicurezza", items: ["**Accesso**: hardening sessione"] },
      { title: "Aggiornato", items: ["Voce libera"] },
      { title: "Sotto il cofano", items: ["**Test**: suite estesa"] },
    ];

    const grouped = groupSections(sections);
    const areaGroups = groupItemsByArea(sections);

    expect(grouped.highlight).toHaveLength(1);
    expect(grouped.fix).toHaveLength(2);
    expect(grouped.internal).toHaveLength(1);
    expect(sectionIcon(grouped.fix)).toBe(ShieldCheck);
    expect(sectionIcon(grouped.internal)).toBe(Wrench);
    expect(areaGroups).toEqual([
      { area: "Dashboard", items: ["nuova coda"] },
      { area: "Accesso", items: ["hardening sessione"] },
      { area: "Generale", items: ["Voce libera"] },
      { area: "Test", items: ["suite estesa"] },
    ]);
    expect(splitChangelogItem("Voce **in evidenza** finale")).toEqual([
      { key: "0:Voce ", part: "Voce " },
      { key: "5:**in evidenza**", part: "**in evidenza**" },
      { key: "20: finale", part: " finale" },
    ]);
    expect(formatChangelogDate("2026-06-03")).toContain("2026");
    expect(formatChangelogDate("non-data")).toBe("non-data");
    expect(formatChangelogDate(null)).toBeNull();
  });
});
