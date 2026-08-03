export interface Focusable { focus: () => void }
export interface FocusableElement extends Focusable {}

export const FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([hidden])',
  'a[href]',
  'input:not([disabled]):not([hidden])',
  'select:not([disabled]):not([hidden])',
  'textarea:not([disabled]):not([hidden])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function visibleFocusables(root: ParentNode): FocusableElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((el) => el.offsetParent !== null);
}

export function nextTabbable(elements: FocusableElement[], active: FocusableElement | null, shiftKey: boolean): FocusableElement | null {
  if (elements.length === 0) return null;
  const index = active ? elements.indexOf(active) : -1;
  if (shiftKey) return index <= 0 ? elements[elements.length - 1]! : elements[index - 1]!;
  if (index === elements.length - 1) return elements[0]!;
  return elements[index + 1] ?? elements[0]!;
}
