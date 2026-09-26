import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { useViewportKeyboard } from '../useViewportKeyboard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The hook is a bare effect, so it only needs somewhere to be mounted. Pulling
// in a renderer library for that would be a new dependency for one test file.
const mountHook = (hook) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(createElement(function Probe() {
    hook();
    return null;
  })));
  return () => act(() => root.unmount());
};

const FULL_HEIGHT = 800;
const KEYBOARD_HEIGHT = 330;

/*
 * A stand-in for the two ways a browser can react to the software keyboard.
 * `resizesContent` is what interactive-widget=resizes-content asks for and what
 * the app actually runs against: the layout viewport shrinks along with the
 * visual one, so window.innerHeight follows visualViewport.height down.
 */
const makeViewport = ({ resizesContent }) => {
  const listeners = new Set();
  globalThis.visualViewport = {
    height: FULL_HEIGHT,
    addEventListener: (type, fn) => type === 'resize' && listeners.add(fn),
    removeEventListener: (type, fn) => listeners.delete(fn),
  };
  globalThis.innerHeight = FULL_HEIGHT;

  return (visibleHeight) => {
    globalThis.visualViewport.height = visibleHeight;
    if (resizesContent) globalThis.innerHeight = visibleHeight;
    act(() => {
      for (const fn of listeners) fn();
    });
  };
};

const focusField = () => {
  const input = document.createElement('input');
  document.body.append(input);
  act(() => {
    input.focus();
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  });
  return input;
};

const blurField = (input) => {
  act(() => {
    input.blur();
    input.remove();
    globalThis.dispatchEvent(new FocusEvent('focusout'));
  });
};

const keyboardState = () => document.documentElement.dataset.keyboard;

describe('useViewportKeyboard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete document.documentElement.dataset.keyboard;
  });

  afterEach(() => {
    delete globalThis.visualViewport;
  });

  it('sizes the page to the layout viewport when only the visual one shrinks', () => {
    // The browser pans the visible window across the whole layout viewport here
    // however tall the document is, so the page is built to fill it. Sizing to
    // the visible area does not shorten the pan, it just means panning lands on
    // bare canvas instead of on the page.
    const resize = makeViewport({ resizesContent: false });
    mountHook(useViewportKeyboard);

    focusField();
    resize(FULL_HEIGHT - KEYBOARD_HEIGHT);

    expect(document.documentElement.dataset.keyboardMode).toBe('pan');
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe(`${FULL_HEIGHT}px`);
    // The keyboard is still reported at its true size for anything that needs it.
    expect(document.documentElement.style.getPropertyValue('--keyboard-inset')).toBe('330px');
  });

  it('sizes the page to the visible area when the layout viewport shrinks too', () => {
    const resize = makeViewport({ resizesContent: true });
    mountHook(useViewportKeyboard);

    focusField();
    resize(FULL_HEIGHT - KEYBOARD_HEIGHT);

    expect(document.documentElement.dataset.keyboardMode).toBe('resize');
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('470px');
  });

  it('flags the keyboard when the layout viewport shrinks with it', () => {
    const resize = makeViewport({ resizesContent: true });
    mountHook(useViewportKeyboard);
    expect(keyboardState()).toBeUndefined();

    const input = focusField();
    resize(FULL_HEIGHT - KEYBOARD_HEIGHT);

    expect(keyboardState()).toBe('open');
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('470px');
    expect(document.documentElement.style.getPropertyValue('--keyboard-inset')).toBe('330px');

    blurField(input);
    resize(FULL_HEIGHT);
    expect(keyboardState()).toBeUndefined();
  });

  it('flags the keyboard when only the visual viewport shrinks', () => {
    const resize = makeViewport({ resizesContent: false });
    mountHook(useViewportKeyboard);

    const input = focusField();
    resize(FULL_HEIGHT - KEYBOARD_HEIGHT);
    expect(keyboardState()).toBe('open');

    blurField(input);
    resize(FULL_HEIGHT);
    expect(keyboardState()).toBeUndefined();
  });

  it('does not mistake the address bar collapsing for a keyboard', () => {
    const resize = makeViewport({ resizesContent: true });
    mountHook(useViewportKeyboard);

    // No field is focused, so this is just browser chrome coming and going.
    resize(FULL_HEIGHT - 90);
    expect(keyboardState()).toBeUndefined();

    // And with a field focused, a drop that small is still not a keyboard.
    focusField();
    resize(FULL_HEIGHT - 90);
    expect(keyboardState()).toBeUndefined();
  });

  it('reads the mode from the real numbers, not from an older baseline', () => {
    // Taken from a device: the layout viewport stands at 714 while only 384 is
    // visible, so the keyboard plainly did not shrink it. Reported as a resize
    // once, because the baseline had been captured while the address bar was
    // out of the way and the drop since then looked like the layout moving.
    const resize = makeViewport({ resizesContent: false });
    mountHook(useViewportKeyboard);

    // Address bar out of the way, nothing focused: a tall baseline.
    globalThis.innerHeight = 874;
    resize(874);
    // Address bar comes back, still nothing focused.
    globalThis.innerHeight = 714;
    resize(714);

    focusField();
    resize(384);

    expect(keyboardState()).toBe('open');
    expect(document.documentElement.dataset.keyboardMode).toBe('pan');
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('714px');
  });

  it('clears the flag as soon as the field is released', () => {
    const resize = makeViewport({ resizesContent: true });
    mountHook(useViewportKeyboard);

    const input = focusField();
    resize(FULL_HEIGHT - KEYBOARD_HEIGHT);
    expect(keyboardState()).toBe('open');

    // The keyboard animates away after the blur, so the flag has to drop on the
    // blur itself - otherwise the page stays collapsed under a closing keyboard.
    blurField(input);
    expect(keyboardState()).toBeUndefined();
  });
});
