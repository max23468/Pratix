import type { KeyboardEvent, MouseEvent } from "react";

const INTERACTIVE_ROW_SELECTOR = 'a,button,input,select,textarea,[role="button"],[role="link"]';

function hasNestedInteractiveTarget(
  target: EventTarget | null,
  currentTarget: HTMLTableRowElement,
) {
  if (!(target instanceof Element)) return false;
  const interactiveTarget = target.closest(INTERACTIVE_ROW_SELECTOR);
  return Boolean(interactiveTarget && interactiveTarget !== currentTarget);
}

export function handleClickableTableRowClick(
  event: MouseEvent<HTMLTableRowElement>,
  openRow: () => void,
) {
  if (hasNestedInteractiveTarget(event.target, event.currentTarget)) return;
  openRow();
}

export function handleClickableTableRowKeyDown(
  event: KeyboardEvent<HTMLTableRowElement>,
  openRow: () => void,
) {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (hasNestedInteractiveTarget(event.target, event.currentTarget)) return;

  event.preventDefault();
  openRow();
}
