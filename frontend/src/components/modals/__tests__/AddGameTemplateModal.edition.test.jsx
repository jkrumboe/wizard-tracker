import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

import AddGameTemplateModal from '../AddGameTemplateModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const GAMES = [
  { name: 'Wizard', gameCategory: 'callAndMade' },
  { name: 'Skull King', gameCategory: 'callAndMade' },
  { name: 'Flip 7', gameCategory: 'table' },
];

let cleanup = () => {};

const mount = (props = {}) => {
  const onSave = vi.fn();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(createElement(AddGameTemplateModal, {
    isOpen: true,
    onClose: () => {},
    onSave,
    existingGames: GAMES,
    ...props,
  })));
  cleanup = () => {
    act(() => root.unmount());
    host.remove();
  };
  return { host, onSave };
};

const typeName = (host, value) => {
  const input = host.querySelector('#game-name-input');
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  act(() => {
    setValue.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const click = (element) => act(() => element.click());
const editionCheckbox = (host) => host.querySelector('.agm-edition-check input');
const save = (host) => click(host.querySelector('.save-btn'));

afterEach(() => cleanup());

describe('AddGameTemplateModal editions', () => {
  it('asks whether a name starting with an existing game is an edition of it', () => {
    const { host } = mount();
    typeName(host, 'Wizard Jubiläumsedition');
    expect(host.querySelector('.agm-edition-prompt')).not.toBeNull();
  });

  it('does not ask for unrelated names or names already written as "<game>: <edition>"', () => {
    const { host } = mount();
    typeName(host, 'Wizardry');
    expect(host.querySelector('.agm-edition-prompt')).toBeNull();
    typeName(host, 'Wizard: Jubiläumsedition');
    expect(host.querySelector('.agm-edition-prompt')).toBeNull();
  });

  it('matches multi-word games, preferring the longest one', () => {
    const { host } = mount();
    typeName(host, 'Skull King Deluxe');
    click(host.querySelector('.agm-edition-yes'));
    expect(editionCheckbox(host).checked).toBe(true);
    expect(host.querySelector('#base-game-select').value).toBe('Skull King');
    expect(host.querySelector('#game-name-input').value).toBe('Deluxe');
  });

  it('saves an accepted edition as "<game>: <edition>"', () => {
    const { host, onSave } = mount();
    typeName(host, 'Wizard Jubiläumsedition');
    click(host.querySelector('.agm-edition-yes'));
    save(host);
    expect(onSave).toHaveBeenCalledWith('Wizard: Jubiläumsedition', expect.objectContaining({ gameCategory: 'callAndMade' }));
  });

  it('keeps the typed name when the user says it is a separate game', () => {
    const { host, onSave } = mount();
    typeName(host, 'Wizard Jubiläumsedition');
    click(host.querySelector('.agm-edition-no'));
    expect(host.querySelector('.agm-edition-prompt')).toBeNull();
    save(host);
    expect(onSave).toHaveBeenCalledWith('Wizard Jubiläumsedition', expect.any(Object));
  });

  it('lets the user mark any new game as an edition with the checkbox', () => {
    const { host, onSave } = mount();
    click(editionCheckbox(host));
    const select = host.querySelector('#base-game-select');
    act(() => {
      select.value = 'Flip 7';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    typeName(host, 'Party');
    save(host);
    expect(onSave).toHaveBeenCalledWith('Flip 7: Party', expect.objectContaining({ gameCategory: 'table' }));
  });

  it('only offers games of the locked type and hides the checkbox without games', () => {
    const { host } = mount({ templateType: 'table' });
    click(editionCheckbox(host));
    const options = [...host.querySelectorAll('#base-game-select option')].map((o) => o.value);
    expect(options).toEqual(['Flip 7']);
    cleanup();

    const empty = mount({ existingGames: null });
    expect(editionCheckbox(empty.host)).toBeNull();
  });
});
