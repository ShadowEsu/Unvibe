"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const COPY_TOAST_MS = 3000;

type CopyToastContextValue = {
  showCopyToast: (message: string) => void;
};

const CopyToastContext = createContext<CopyToastContextValue>({
  showCopyToast: () => undefined,
});

export function useCopyToast() {
  return useContext(CopyToastContext);
}

export function CopyToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const showCopyToast = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismiss, COPY_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast, dismiss]);

  return (
    <CopyToastContext.Provider value={{ showCopyToast }}>
      {children}
      {toast ? (
        <div className="paper-copy-toast" role="status" aria-live="polite" key={toast.id}>
          <CopyMark />
          <p>{toast.message}</p>
          <button type="button" aria-label="Dismiss" onClick={dismiss}>
            <CloseMark />
          </button>
          <span className="paper-copy-toast__meter" aria-hidden="true" />
        </div>
      ) : null}
    </CopyToastContext.Provider>
  );
}

function CopyMark() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CloseMark() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
