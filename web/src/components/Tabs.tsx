import { useId, useRef } from 'react';
import type { ReactNode } from 'react';

export function Tabs<Value extends string>({ items, value, onChange, label, className, panelId }: {
  items: readonly { value: Value; label: ReactNode; name: string }[]; value: Value; onChange: (value: Value) => void;
  label: string; className: string; panelId: string;
}) {
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return <div role="tablist" aria-label={label} className={className}>
    {items.map((item, index) => <button key={item.value} ref={button => { buttons.current[index] = button; }}
      id={`${id}-${item.value}`} role="tab" aria-label={item.name} aria-selected={value === item.value} aria-controls={panelId}
      tabIndex={value === item.value ? 0 : -1} className={value === item.value ? 'active' : ''}
      onClick={() => onChange(item.value)} onKeyDown={event => {
        let next: number;
        if (event.key === 'ArrowRight') next = (index + 1) % items.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = items.length - 1;
        else return;
        event.preventDefault(); onChange(items[next].value); buttons.current[next]?.focus();
      }}>{item.label}</button>)}
  </div>;
}
