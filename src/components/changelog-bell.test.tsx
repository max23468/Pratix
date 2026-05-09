// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { changelogState } = vi.hoisted(() => ({
  changelogState: { hasUnread: false },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/use-unread-changelog", () => ({
  useUnreadChangelog: () => changelogState,
}));

import { ChangelogBell } from "./changelog-bell";

describe("ChangelogBell", () => {
  beforeEach(() => {
    changelogState.hasUnread = false;
  });

  it("usa aria-label diversi per novità lette e non lette", () => {
    const { rerender } = render(<ChangelogBell />);
    expect(screen.getByRole("link", { name: "Novità" }).getAttribute("href")).toBe("/novita");

    changelogState.hasUnread = true;
    rerender(<ChangelogBell />);

    expect(screen.getByRole("link", { name: "Novità disponibili" })).toBeTruthy();
  });
});
