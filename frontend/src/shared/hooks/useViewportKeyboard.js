import { useEffect } from 'react';

/*
 * Publishes the height of the area the software keyboard leaves visible as
 * --app-height, and marks the document with data-keyboard="open" while the
 * keyboard is up, so pages can shrink to the space that is actually there and
 * get their fixed chrome out of the way.
 *
 * Detecting the keyboard is the awkward part, because browsers disagree about
 * what moves:
 *
 *  - Classic iOS leaves the layout viewport at full height and pans the web
 *    view, so only visualViewport.height shrinks.
 *  - With interactive-widget=resizes-content (which this app asks for in its
 *    viewport meta) the layout viewport shrinks too, so innerHeight follows
 *    visualViewport.height down and the gap between them stays near zero.
 *
 * Comparing the two therefore only finds the keyboard on the first kind of
 * browser. Instead we remember how tall the viewport is when no field is
 * focused and measure the drop from that, which holds either way. The drop is
 * only read as a keyboard when a text field actually has focus, so the address
 * bar sliding in and out cannot be mistaken for one.
 */
export function useViewportKeyboard() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = globalThis.visualViewport;
    let keyboardOpen = false;
    let lastVisibleHeight = 0;
    let lastInset = -1;
    // The unobstructed height, remembered from moments when nothing is focused.
    let baseHeight = 0;

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
      const typing = isTextEntryFocused();

      // Whenever no field is focused there is no keyboard, so whatever is
      // visible now is the unobstructed height. Tracking it rather than keeping
      // the tallest ever seen matters because the address bar legitimately
      // comes and goes: a remembered peak would leave the baseline permanently
      // too high and make an ordinary layout look like a keyboard.
      if (!typing) baseHeight = visibleHeight;

      const keyboardInset = Math.max(0, baseHeight - visibleHeight);

      if (!typing) {
        keyboardOpen = false;
      } else if (keyboardInset > KEYBOARD_OPEN_PX) {
        keyboardOpen = true;
      } else if (keyboardInset < KEYBOARD_CLOSED_PX) {
        keyboardOpen = false;
      }

      // Whether the layout viewport shrank for the keyboard is simply whether it
      // still stands taller than the visible area. If it followed the keyboard
      // down the two heights agree; if it stayed put, the gap between them is
      // the keyboard. Read directly rather than against the baseline, which
      // depends on when it happened to be taken.
      //
      // What the page is sized to follows from that. Where the layout viewport
      // shrank, the visible area is the whole of it and the page belongs there.
      // Where it did not, the browser will let the visible window be panned
      // across the full layout viewport whatever height the document is given -
      // shortening the document does not shorten the pan, it only decides
      // whether what you pan onto is page or bare canvas. So the page is built
      // to the layout viewport, and the pan stays on the page.
      const layoutShrinks = layoutHeight - visibleHeight < KEYBOARD_CLOSED_PX;
      const pageHeight = keyboardOpen && !layoutShrinks ? layoutHeight : visibleHeight;

      const roundedHeight = Math.round(pageHeight);
      const roundedInset = Math.round(keyboardOpen ? keyboardInset : 0);
      if (roundedHeight !== lastVisibleHeight || roundedInset !== lastInset) {
        lastVisibleHeight = roundedHeight;
        lastInset = roundedInset;
        root.style.setProperty('--app-height', `${roundedHeight}px`);
        root.style.setProperty('--keyboard-inset', `${roundedInset}px`);
      }

      if (keyboardOpen) {
        root.dataset.keyboard = 'open';
        // Published so the CSS - and the debug readout - can tell the two
        // apart. It says nothing while the keyboard is down.
        root.dataset.keyboardMode = layoutShrinks ? 'resize' : 'pan';
      } else {
        delete root.dataset.keyboard;
        delete root.dataset.keyboardMode;
      }
    };

    // Focus and blur are what actually drive the keyboard, so remeasure on
    // both. The resize that follows lands a frame or two later and refines the
    // numbers; this just means the page reacts as the field is tapped.
    const handleFocusIn = () => applyViewportMetrics();

    // Once the keyboard is gone and nothing is focused, undo any pan the
    // browser left behind. Waiting for the field to be released keeps this
    // clear of the browser's own scrolling, which is what causes the shake.
    const handleFocusOut = () => {
      applyViewportMetrics();
      setTimeout(() => {
        if (!isTextEntryFocused()) {
          applyViewportMetrics();
          resetPagePan();
        }
      }, 250);
    };

    // A rotation invalidates the remembered height, so drop it and let the next
    // unfocused measurement establish the new one.
    const handleOrientationChange = () => {
      baseHeight = 0;
      applyViewportMetrics();
    };

    applyViewportMetrics();

    globalThis.addEventListener('focusin', handleFocusIn);
    globalThis.addEventListener('focusout', handleFocusOut);
    viewport?.addEventListener('resize', applyViewportMetrics);
    globalThis.addEventListener('resize', applyViewportMetrics);
    globalThis.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      globalThis.removeEventListener('focusin', handleFocusIn);
      globalThis.removeEventListener('focusout', handleFocusOut);
      viewport?.removeEventListener('resize', applyViewportMetrics);
      globalThis.removeEventListener('resize', applyViewportMetrics);
      globalThis.removeEventListener('orientationchange', handleOrientationChange);
      root.style.removeProperty('--app-height');
      root.style.removeProperty('--keyboard-inset');
      delete root.dataset.keyboard;
      delete root.dataset.keyboardMode;
    };
  }, []);
}

export default useViewportKeyboard;
