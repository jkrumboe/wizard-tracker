import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { useVisualViewportRect } from '../useVisualViewportRect';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountHook = (active) => {
  const result = { current: undefined };
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const render = (isActive) => act(() => root.render(createElement(function Probe() {
    result.current = useVisualViewportRect(isActive);
    return null;
  })));
  render(active);
  return { result, rerender: render, unmount: () => act(() => root.unmount()) };
};

const makeViewport = () => {
  const listeners = new Set();
  const viewport = {
    height: 800,
    offsetTop: 0,
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
  };
  globalThis.visualViewport = viewport;
  const emit = (changes) => {
    Object.assign(viewport, changes);
    act(() => {
      listeners.forEach((fn) => fn());
      vi.runAllTimers();
    });
  };
  return { emit, listeners };
};

describe('useVisualViewportRect', () => {
  let originalViewport;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    originalViewport = globalThis.visualViewport;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.visualViewport = originalViewport;
  });

  it('follows the visible area while active, e.g. when the keyboard opens and iOS pans', () => {
    const { emit } = makeViewport();
    const { result, unmount } = mountHook(true);
    act(() => vi.runAllTimers());
    expect(result.current).toEqual({ top: 0, height: 800 });

    emit({ height: 470, offsetTop: 120.4 });
    expect(result.current).toEqual({ top: 120, height: 470 });
    unmount();
  });

  it('returns null and stops listening when inactive', () => {
    const { listeners } = makeViewport();
    const { result, rerender, unmount } = mountHook(true);
    expect(listeners.size).toBe(1);

    rerender(false);
    expect(result.current).toBeNull();
    expect(listeners.size).toBe(0);
    unmount();
  });

  it('returns null when visualViewport is unavailable', () => {
    globalThis.visualViewport = undefined;
    const { result, unmount } = mountHook(true);
    expect(result.current).toBeNull();
    unmount();
  });
});
