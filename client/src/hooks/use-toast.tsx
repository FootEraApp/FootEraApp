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
        className={`fixed top-4 right-4 p-3 rounded shadow-lg text-white z-50 ${
          toast.type === "success" ? "bg-green-500" : "bg-red-500"
        }`}
      >
        {toast.message}
      </div>
    );
  }

  return { showToast, ToastComponent };
}
