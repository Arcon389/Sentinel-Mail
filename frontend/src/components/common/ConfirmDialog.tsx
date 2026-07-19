import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface ConfirmOptions {
  /** Optional heading; falls back to a generic i18n title. */
  title?: string;
  /** The body text explaining what will happen. */
  message: string;
  /** Label of the confirming button; defaults to common.delete. */
  confirmLabel?: string;
  /** Label of the cancelling button; defaults to common.cancel. */
  cancelLabel?: string;
  /** Render the confirm button in danger (red) styling. */
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      setPending((current) => {
        current?.resolve(result);
        return null;
      });
    },
    [],
  );

  // Allow Escape to cancel and Enter to confirm while the dialog is open.
  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending &&
        createPortal(
          <div className="modal-overlay" onMouseDown={() => close(false)}>
            <div
              className="modal"
              role="alertdialog"
              aria-modal="true"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h2 className="modal-title">{pending.title ?? t("common.confirmTitle")}</h2>
              <p className="modal-message">{pending.message}</p>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => close(false)}>
                  {pending.cancelLabel ?? t("common.cancel")}
                </button>
                <button
                  type="button"
                  className={pending.danger ? "danger-button" : ""}
                  autoFocus
                  onClick={() => close(true)}
                >
                  {pending.confirmLabel ?? t("common.delete")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
