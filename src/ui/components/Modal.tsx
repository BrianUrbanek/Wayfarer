import { useEffect, useRef } from 'react';
import type { PropsWithChildren } from 'react';

interface ModalProps extends PropsWithChildren {
  open: boolean;
  title: string;
  onClose: () => void;
  placement?: 'center' | 'top';
  className?: string;
}

export function Modal({ open, title, onClose, children, placement = 'center', className }: ModalProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    bodyRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={`overlay overlay--modal ${placement === 'top' ? 'overlay--modal-top' : ''}`}
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className={`modal ${placement === 'top' ? 'modal--top' : ''}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <p className="modal__eyebrow">Selection</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <div ref={bodyRef} className="modal__body">{children}</div>
      </div>
    </div>
  );
}
