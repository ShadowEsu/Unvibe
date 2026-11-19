import { createContext, useContext, useEffect, useLayoutEffect, type ReactNode } from 'react';

/**
 * The main window's shell (companion.tsx) owns the rail, the top bar and the 296 px right side. Pages publish into
 * it through this context instead of threading props: a page that has a right side calls `useRightPane(node)` while
 * it is mounted (null or no call = no right side, and the shell hides the side's button); a flow that wants the rail
 * folded while it runs (the Quiz's check) calls `useRailFolded(true)`; a flow that needs its own top bar (the Quiz's
 * "Quiz › lesson … Leave esc") calls `useTopBar(node)`, which replaces the page title and "Explain" in the 40 px bar.
 * Folding this way never touches the saved `settings.sidebarHidden`; the rail opens again when the flow unmounts.
 */
export interface ShellApi {
  setRightPane: (node: ReactNode | null) => void;
  setRailFolded: (folded: boolean) => void;
  setTopBar: (node: ReactNode | null) => void;
}

export const ShellContext = createContext<ShellApi>({ setRightPane: () => {}, setRailFolded: () => {}, setTopBar: () => {} });

/** Publish `node` as the right side for as long as the caller is mounted (and whenever `node` changes). */
export function useRightPane(node: ReactNode | null): void {
  const { setRightPane } = useContext(ShellContext);
  useLayoutEffect(() => {
    setRightPane(node);
    return () => setRightPane(null);
  }, [node, setRightPane]);
}

/** Keep the rail at its 56 px width while `folded` is true and the caller is mounted. */
export function useRailFolded(folded: boolean): void {
  const { setRailFolded } = useContext(ShellContext);
  useEffect(() => {
    setRailFolded(folded);
    return () => setRailFolded(false);
  }, [folded, setRailFolded]);
}

/** Replace the top bar's title and "Explain" with `node` for as long as the caller is mounted (null = the default bar). */
export function useTopBar(node: ReactNode | null): void {
  const { setTopBar } = useContext(ShellContext);
  useLayoutEffect(() => {
    setTopBar(node);
    return () => setTopBar(null);
  }, [node, setTopBar]);
}
