import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "accent" }) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="card modal card-pad" onClick={(e) => e.stopPropagation()}>
        <div className="page-head">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <Button variant="ghost" className="btn-sm" onClick={onClose} type="button">
            Đóng
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="toast">{message}</div>;
}

export function Spinner({ label = "Đang tải..." }: { label?: string }) {
  return <div className="empty">{label}</div>;
}

export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  return {
    toast,
    show: (m: string) => setToast(m),
    node: toast ? <Toast message={toast} onDone={() => setToast(null)} /> : null,
  };
}
