import { useEffect, useMemo, useRef, useState, type CSSProperties, type PropsWithChildren, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type TooltipActivation = 'hover' | 'click';

export interface TooltipSection {
  title: string;
  content: ReactNode;
}

export interface TooltipPlacement {
  top: number;
  left: number;
  width: number;
  maxWidth: number;
}

export function resolveTooltipPlacement(
  triggerRect: DOMRect | { left: number; right: number; top: number; bottom: number; width: number; height: number },
  popoverRect: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 12
): TooltipPlacement {
  const openRight = triggerRect.left <= viewport.width / 2;
  const horizontalSpace = openRight
    ? viewport.width - triggerRect.left - gap
    : triggerRect.right - gap;
  const width = Math.min(popoverRect.width, Math.max(240, horizontalSpace));
  const maxWidth = Math.min(popoverRect.width, viewport.width - gap * 2);
  const left = openRight
    ? Math.min(triggerRect.left, Math.max(gap, viewport.width - width - gap))
    : Math.max(gap, Math.min(triggerRect.right - width, viewport.width - width - gap));

  const openDown = triggerRect.top <= viewport.height / 2;
  const verticalSpace = openDown
    ? viewport.height - triggerRect.bottom - gap
    : triggerRect.top - gap;
  const fitsBelow = verticalSpace >= popoverRect.height || !openDown;
  const top = fitsBelow
    ? Math.min(triggerRect.bottom + gap, Math.max(gap, viewport.height - popoverRect.height - gap))
    : Math.max(gap, triggerRect.top - popoverRect.height - gap);

  return {
    top,
    left,
    width,
    maxWidth
  };
}

interface TooltipProps extends PropsWithChildren {
  label: string;
  icon: ReactNode;
  activation?: TooltipActivation;
  className?: string;
  popoverClassName?: string;
  ariaLabel?: string;
}

export function Tooltip({ label, icon, activation = 'hover', className, popoverClassName, ariaLabel, children }: TooltipProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [placement, setPlacement] = useState<TooltipPlacement | null>(null);

  const isInteractive = activation === 'click' || pinned;

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const updatePlacement = () => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) {
      return;
    }

    const nextPlacement = resolveTooltipPlacement(trigger.getBoundingClientRect(), popover.getBoundingClientRect(), {
      width: window.innerWidth,
      height: window.innerHeight
    });
    setPlacement(nextPlacement);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    updatePlacement();
  }, [open, children]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleResize = () => updatePlacement();
    const handleScroll = () => updatePlacement();
    const handlePointerDown = (event: PointerEvent) => {
      if (!isInteractive) {
        return;
      }
      const target = event.target as Node | null;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setPinned(false);
      setOpen(false);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isInteractive, open]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, []);

  const showTooltip = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const hideTooltip = () => {
    if (pinned) {
      return;
    }
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 80);
  };

  const togglePinned = () => {
    clearCloseTimer();
    setPinned((value) => {
      const next = !value;
      setOpen(next || open);
      return next;
    });
  };

  const popoverStyle = useMemo(() => {
    if (!placement) {
      return undefined;
    }

    return {
      top: `${placement.top}px`,
      left: `${placement.left}px`,
      width: `${placement.width}px`,
      maxWidth: `${placement.maxWidth}px`
    } satisfies CSSProperties;
  }, [placement]);

  return (
    <span className={`wayfarer-tooltip${className ? ` ${className}` : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className="wayfarer-tooltip__trigger system-health-affordance"
        aria-label={ariaLabel ?? label}
        aria-expanded={open}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        onClick={activation === 'click' ? togglePinned : showTooltip}
      >
        {icon}
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popoverRef}
              className={`wayfarer-tooltip__popover system-health-popover${popoverClassName ? ` ${popoverClassName}` : ''}`}
              role="dialog"
              aria-label={label}
              style={popoverStyle}
              onMouseEnter={showTooltip}
              onMouseLeave={hideTooltip}
            >
              {children}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
