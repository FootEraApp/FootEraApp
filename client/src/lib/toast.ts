export type ToastType = "success" | "error" | "info";

export type ToastEvent = {
  id: number;
  message: string;
  type: ToastType;
};

type Listener = (event: ToastEvent) => void;

let idCounter = 0;
const listeners = new Set<Listener>();

function emit(message: string, type: ToastType) {
  const event: ToastEvent = { id: ++idCounter, message, type };
  listeners.forEach((listener) => listener(event));
}

export const toast = {
  success: (message: string) => emit(message, "success"),
  error: (message: string) => emit(message, "error"),
  info: (message: string) => emit(message, "info"),
};

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
