import { useCallback, useEffect, useRef } from 'react';

// Open modals in the order they opened; only the topmost reacts to Escape,
// so closing a confirmation doesn't also close the modal beneath it.
const openModals = [];

/**
 * Shared dismiss behaviour for modals: Escape closes the topmost open modal,
 * and a click on the backdrop itself (not on the dialog) closes it.
 *
 * @param {boolean} isOpen - Whether the modal is currently shown
 * @param {() => void} onClose - Called to dismiss the modal
 * @param {{ disabled?: boolean }} [options] - disabled: ignore dismiss attempts (e.g. while saving)
 * @returns {{ onClick: (event: MouseEvent) => void }} Props to spread on the overlay element
 */
export function useModalDismiss(isOpen, onClose, { disabled = false } = {}) {
  const onCloseRef = useRef(onClose);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onCloseRef.current = onClose;
    disabledRef.current = disabled;
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    const token = {};
    openModals.push(token);

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' || openModals[openModals.length - 1] !== token) return;
      event.stopPropagation();
      if (!disabledRef.current) onCloseRef.current?.();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openModals.splice(openModals.indexOf(token), 1);
    };
  }, [isOpen]);

  const onClick = useCallback((event) => {
    if (event.target === event.currentTarget && !disabledRef.current) {
      onCloseRef.current?.();
    }
  }, []);

  return { onClick };
}

export default useModalDismiss;
