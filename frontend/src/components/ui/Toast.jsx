import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const colors = {
    info:    'bg-blue-600/90 border-blue-500/50',
    success: 'bg-emerald-600/90 border-emerald-500/50',
    error:   'bg-red-600/90 border-red-500/50',
    warning: 'bg-amber-600/90 border-amber-500/50',
  };

  const icons = { info: 'ℹ', success: '✓', error: '✕', warning: '⚠' };

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-white text-sm shadow-xl animate-fadein ${colors[t.type]}`}
          >
            <span className="text-base">{icons[t.type]}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
