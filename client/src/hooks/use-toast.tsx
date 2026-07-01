import { useState } from "react";

type ToastType = "success" | "error";

interface ToastData {
  message: string;
  type: ToastType;
}

export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  function ToastComponent() {
    if (!toast) return null;

    return (
      <div
        className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-lg text-white z-50 text-sm font-medium max-w-[90vw] text-center ${
          toast.type === "success" ? "bg-green-700" : "bg-red-600"
        }`}
      >
        {toast.message}
      </div>
    );
  }

  return { showToast, ToastComponent };
}
