import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className="dialog" onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="dialog-title"
    onClick={event => { if (event.target === ref.current) onClose(); }}>
    <div className="dialog-header"><h2 id="dialog-title">{title}</h2><button aria-label="Close dialog" className="icon-button" onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}
