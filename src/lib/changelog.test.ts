import { describe, expect, it } from "vitest";

import { compareVersions, hasUnreadChangelog, parseChangelog } from "./changelog";

describe("parseChangelog", () => {
  it("estrae versioni, data, intro, sezioni e voci bullet", () => {
    const entries = parseChangelog(`
# Changelog

## [Non rilasciato]

### Non versionato

- Piano test interno.

## [0.12.0] — 2026-05-08
Versione di recupero crediti.

### Novità

- Nuova sezione Attività.
- Rendiconto Excel.

### Correzioni

* Stato vuoto più chiaro.
`);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      version: "Non rilasciato",
      date: null,
      unreleased: true,
      nonVersioned: false,
    });
    expect(entries[0].sections).toEqual([
      {
        title: "Non versionato",
        items: ["Piano test interno."],
      },
    ]);
    expect(entries[1]).toMatchObject({
      version: "0.12.0",
      date: "2026-05-08",
      unreleased: false,
      nonVersioned: false,
      intro: "Versione di recupero crediti.",
    });
    expect(entries[1].sections).toEqual([
      {
        title: "Novità",
        items: ["Nuova sezione Attività.", "Rendiconto Excel."],
      },
      {
        title: "Correzioni",
        items: ["Stato vuoto più chiaro."],
      },
    ]);
  });

  it("tronca il blocco al separatore orizzontale", () => {
    const entries = parseChangelog(`
## [0.12.7] — 2026-05-09

### Sotto il cofano

- Voce pubblica.

---

Nota interna da ignorare.
`);

    expect(entries[0].sections[0].items).toEqual(["Voce pubblica."]);
  });

  it("ricompone le voci bullet mandate a capo nel markdown", () => {
    const entries = parseChangelog(`
## [1.11.0] — 2026-05-22

### Novità

- **Attività**: gli importi da controllare si possono segnare come “da
  verificare”, filtrare e riconoscere nelle liste.
- **Pratiche**: la sezione Attività è stata spostata subito dopo il cruscotto
  della Pratica.
`);

    expect(entries[0].sections[0].items).toEqual([
      "**Attività**: gli importi da controllare si possono segnare come “da verificare”, filtrare e riconoscere nelle liste.",
      "**Pratiche**: la sezione Attività è stata spostata subito dopo il cruscotto della Pratica.",
    ]);
  });
});

describe("compareVersions", () => {
  it("confronta versioni SemVer tollerando segmenti mancanti o non numerici", () => {
    expect(compareVersions("0.12.7", "0.12.6")).toBe(1);
    expect(compareVersions("0.12", "0.12.0")).toBe(0);
    expect(compareVersions("0.12.beta", "0.12.1")).toBe(-1);
  });
});

describe("hasUnreadChangelog", () => {
  it("considera non letto se manca l'ultima versione vista o se la corrente è più recente", () => {
    expect(hasUnreadChangelog("0.12.7", null)).toBe(true);
    expect(hasUnreadChangelog("0.12.7", "")).toBe(true);
    expect(hasUnreadChangelog("0.12.7", "0.12.6")).toBe(true);
    expect(hasUnreadChangelog("0.12.7", "0.12.7")).toBe(false);
  });
});
