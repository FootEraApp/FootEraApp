import { useEffect, useState } from "react";
import { subscribeToast, type ToastEvent } from "@/lib/toast";

const DURATION_MS = 4000;

const STYLES: Record<ToastEvent["type"], string> = {
  success: "bg-green-700",
  error: "bg-red-600",
  info: "bg-gray-800",
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastEvent[]>([]);

  useEffect(() => {
    return subscribeToast((event) => {
      setToasts((prev) => [...prev, event]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== event.id));
      }, DURATION_MS);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none px-4 w-full">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-white text-sm font-medium max-w-[90vw] text-center ${STYLES[t.type]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
