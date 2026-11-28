import { type ReactNode, useEffect, useRef } from "react";

/**
 * A modal panel (#61): a dialog on wide screens, a bottom sheet on phones. The browser traps focus
 * in it, and puts focus back where it was when it closes. Esc calls `onClose`; without one the
 * dialog can't be dismissed (a payment or response the game is waiting on).
 */
export function Dialog(props: { label: string; onClose?: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={props.label}
      onCancel={(e) => {
        e.preventDefault();
        props.onClose?.();
      }}
    >
      {props.children}
    </dialog>
  );
}
