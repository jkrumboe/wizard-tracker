import { useEffect } from 'react';

/*
 * Marks a page that must stay pinned to the viewport: the app shell around it
 * is locked by CSS so it cannot scroll, and only the page's own scroll region
 * moves. Without it the shell can end up scrolled - iOS scrolls whatever it can
 * reach to keep a focused input visible - which drags the page header off
 * screen and leaves it there after the keyboard closes.
 *
 * The lock is deliberately passive. Correcting the scroll position while the
 * keyboard is opening would fight the browser's own adjustment and make the
 * screen shake, so the shell is only straightened out when the page is entered.
 */
export function useFixedViewportPage() {
  useEffect(() => {
    const body = document.body;
    body.dataset.fixedViewport = 'true';

    const resetShellScroll = () => {
      globalThis.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      body.scrollTop = 0;
      const shell = document.querySelector('.main-container');
      if (shell) shell.scrollTop = 0;
    };

    resetShellScroll();
    globalThis.addEventListener('orientationchange', resetShellScroll);

    return () => {
      delete body.dataset.fixedViewport;
      globalThis.removeEventListener('orientationchange', resetShellScroll);
    };
  }, []);
}

export default useFixedViewportPage;
