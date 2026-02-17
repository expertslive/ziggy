import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';

interface ToastMessage {
  id: number;
  type: 'success' | 'error';
  text: string;
}

interface ToastContextValue {
  toast: (type: 'success' | 'error', text: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const toast = useCallback((type: 'success' | 'error', text: string) => {
    const id = nextId++;
    setMessages((prev) => [...prev, { id, type, text }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {messages.map((msg) => (
          <ToastItem key={msg.id} message={msg} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ message, onDismiss }: { message: ToastMessage; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(message.id), 3000);
    return () => clearTimeout(timer);
  }, [message.id, onDismiss]);

  return (
    <div
      className={`rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg transition-all ${
        message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
      }`}
    >
      {message.text}
    </div>
  );
}
