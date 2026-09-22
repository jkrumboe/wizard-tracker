import { useEffect } from 'react';

/*
 * iOS keeps the layout viewport at full height when the software keyboard
 * opens and simply pans the whole web view up so the focused input stays
 * visible. Everything above the input scrolls off screen, and the pan is not
 * always undone when the keyboard closes.
 *
 * This hook publishes the *visual* viewport height as --app-height and marks
 * the document with data-keyboard="open" while a keyboard is covering part of
 * the screen, so pages can shrink themselves to the space that is actually
 * visible and the browser has no reason to pan them. The measurement is kept
 * deliberately steady: it ignores the pan offset and uses a wide open/close
 * margin, because a value that flickers mid-animation makes the page shake.
 */
export function useViewportKeyboard() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = globalThis.visualViewport;
    let keyboardOpen = false;
    let lastVisibleHeight = 0;

    // A keyboard takes a serious bite out of the viewport; browser chrome does
    // not. The gap between the two thresholds stops the state from flapping
    // while the keyboard animates.
    const KEYBOARD_OPEN_PX = 120;
    const KEYBOARD_CLOSED_PX = 60;

    const isTextEntryFocused = () => {
      const active = document.activeElement;
      if (!active) return false;
      return active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable;
    };

    const resetPagePan = () => {
      globalThis.scrollTo(0, 0);
      root.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    const applyViewportMetrics = () => {
      const layoutHeight = globalThis.innerHeight;
      const visibleHeight = viewport ? viewport.height : layoutHeight;
      // The pan offset is deliberately left out of this: it moves while the
      // browser is scrolling the focused field into view, and folding it in
      // would make the measurement oscillate during the animation.
      const keyboardInset = Math.max(0, layoutHeight - visibleHeight);

      if (keyboardInset > KEYBOARD_OPEN_PX) {
        keyboardOpen = true;
      } else if (keyboardInset < KEYBOARD_CLOSED_PX) {
        keyboardOpen = false;
      }

      const roundedHeight = Math.round(visibleHeight);
      if (roundedHeight !== lastVisibleHeight) {
        lastVisibleHeight = roundedHeight;
        root.style.setProperty('--app-height', `${roundedHeight}px`);
        root.style.setProperty('--keyboard-inset', `${Math.round(keyboardInset)}px`);
      }

      if (keyboardOpen) {
        root.dataset.keyboard = 'open';
      } else {
        delete root.dataset.keyboard;
      }
    };

    // Once the keyboard is gone and nothing is focused, undo any pan the
    // browser left behind. Waiting for the field to be released keeps this
    // clear of the browser's own scrolling, which is what causes the shake.
    const handleFocusOut = () => {
      setTimeout(() => {
        if (!isTextEntryFocused()) resetPagePan();
      }, 250);
    };

    applyViewportMetrics();

    globalThis.addEventListener('focusout', handleFocusOut);
    viewport?.addEventListener('resize', applyViewportMetrics);
    globalThis.addEventListener('resize', applyViewportMetrics);
    globalThis.addEventListener('orientationchange', applyViewportMetrics);

    return () => {
      globalThis.removeEventListener('focusout', handleFocusOut);
      viewport?.removeEventListener('resize', applyViewportMetrics);
      globalThis.removeEventListener('resize', applyViewportMetrics);
      globalThis.removeEventListener('orientationchange', applyViewportMetrics);
      root.style.removeProperty('--app-height');
      root.style.removeProperty('--keyboard-inset');
      delete root.dataset.keyboard;
    };
  }, []);
}

export default useViewportKeyboard;
