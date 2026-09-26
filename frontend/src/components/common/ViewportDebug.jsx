import { useEffect, useState } from 'react';

/*
 * A temporary on-screen readout of the viewport numbers, for working out what
 * the software keyboard is doing on a device that cannot be reached with a
 * desktop debugger. Off unless the URL carries ?vpdebug=1, and inert - it
 * cannot be tapped and is not in the layout - so it cannot become the thing it
 * is trying to measure.
 */
const FLAG = 'keepwiz:vpdebug';

// ?vpdebug=1 turns it on and ?vpdebug=0 turns it off again, and the answer is
// remembered. A home screen PWA has no address bar to type a query string into,
// so without that it could only ever be switched on in the browser.
const isEnabled = () => {
  try {
    const params = new URLSearchParams(globalThis.location.search);
    if (params.has('vpdebug')) {
      const on = params.get('vpdebug') !== '0';
      globalThis.localStorage?.setItem(FLAG, on ? '1' : '0');
      return on;
    }
    return globalThis.localStorage?.getItem(FLAG) === '1';
  } catch {
    return false;
  }
};

// Whatever hangs below the visible area is what the page can be panned down
// into, so these are the elements worth naming.
const findOverhang = (visibleBottom) => {
  const results = [];
  for (const el of document.querySelectorAll('body, .main-container, .main-container *')) {
    const { bottom, height } = el.getBoundingClientRect();
    if (height > 0 && bottom > visibleBottom + 2) {
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
      results.push({ name: `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`, bottom: Math.round(bottom) });
    }
  }
  return results.sort((a, b) => b.bottom - a.bottom).slice(0, 5);
};

const readMetrics = () => {
  const root = document.documentElement;
  const vv = globalThis.visualViewport;
  const shell = document.querySelector('.main-container');
  const visibleBottom = vv ? vv.height : globalThis.innerHeight;
  return {
    inner: Math.round(globalThis.innerHeight),
    visual: vv ? Math.round(vv.height) : -1,
    offsetTop: vv ? Math.round(vv.offsetTop) : -1,
    appHeight: root.style.getPropertyValue('--app-height') || 'unset',
    keyboard: root.dataset.keyboard || 'no',
    mode: root.dataset.keyboardMode || 'unset',
    fixed: document.body.dataset.fixedViewport || 'no',
    scrollY: Math.round(globalThis.scrollY),
    htmlBody: `${Math.round(root.getBoundingClientRect().height)}/${Math.round(document.body.getBoundingClientRect().height)}`,
    docScroll: `${root.scrollHeight}/${root.clientHeight}`,
    shellHeight: shell ? Math.round(shell.getBoundingClientRect().height) : -1,
    shellScroll: shell ? `${shell.scrollHeight}/${shell.clientHeight}` : 'n/a',
    focus: document.activeElement ? document.activeElement.tagName.toLowerCase() : 'none',
    overhang: findOverhang(visibleBottom),
  };
};

export function ViewportDebug() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!isEnabled()) return undefined;

    let frame = 0;
    const sample = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setMetrics(readMetrics()));
    };

    // First reading goes in straight away so the panel is there on load; later
    // ones are coalesced into a frame because resize and scroll fire in bursts.
    setMetrics(readMetrics());
    const timer = setInterval(sample, 500);
    const events = ['resize', 'scroll', 'focusin', 'focusout', 'orientationchange'];
    for (const type of events) globalThis.addEventListener(type, sample, true);
    globalThis.visualViewport?.addEventListener('resize', sample);
    globalThis.visualViewport?.addEventListener('scroll', sample);

    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      for (const type of events) globalThis.removeEventListener(type, sample, true);
      globalThis.visualViewport?.removeEventListener('resize', sample);
      globalThis.visualViewport?.removeEventListener('scroll', sample);
    };
  }, []);

  if (!metrics) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
        pointerEvents: 'none',
        background: 'rgba(0, 0, 0, 0.82)',
        color: '#7CFF9E',
        font: '11px/1.35 ui-monospace, monospace',
        padding: '4px 6px',
        whiteSpace: 'pre-wrap',
      }}
    >
      {[
        `inner:${metrics.inner} visual:${metrics.visual} offTop:${metrics.offsetTop}`,
        `--app-height:${metrics.appHeight} kbd:${metrics.keyboard} mode:${metrics.mode}`,
        `fixedViewport:${metrics.fixed}`,
        `scrollY:${metrics.scrollY} doc:${metrics.docScroll} focus:${metrics.focus}`,
        `html/body:${metrics.htmlBody}`,
        `shell h:${metrics.shellHeight} scroll:${metrics.shellScroll}`,
        `below fold: ${metrics.overhang.map((o) => `${o.name}@${o.bottom}`).join(' ') || 'none'}`,
      ].join('\n')}
    </div>
  );
}

export default ViewportDebug;
