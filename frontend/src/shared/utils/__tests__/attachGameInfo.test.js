import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/gameTemplateService', () => ({
  default: {
    shareSystemGameInfo: vi.fn(() => Promise.resolve(null)),
    suggestSystemBoxArt: vi.fn(() => Promise.resolve({ _id: 's1' })),
  },
}));

import gameTemplateService from '@/shared/api/gameTemplateService';
import { attachGameInfo, needsGameInfo } from '@/shared/utils/attachGameInfo';
import { getTemplateGameInfo, markGameInfoChecked } from '@/shared/utils/gameInfoStore';

const gameInfo = { bggId: 7, thumbnailUrl: 'https://cf.geekdo-images.com/t.jpg' };

describe('attachGameInfo', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shares art on a system game without any directly by default', () => {
    const result = attachGameInfo({ _id: 'sys1', type: 'system', name: 'Skat' }, gameInfo);

    expect(result).toBeNull();
    expect(gameTemplateService.shareSystemGameInfo).toHaveBeenCalledWith('sys1', gameInfo);
    expect(gameTemplateService.suggestSystemBoxArt).not.toHaveBeenCalled();
  });

  it('suggests the art to the admins instead with suggest, and still shows it on this device', async () => {
    const template = { _id: 'sys1', type: 'system', name: 'Skat' };
    const result = attachGameInfo(template, gameInfo, {}, { suggest: true });

    await expect(result).resolves.toEqual({ _id: 's1' });
    expect(gameTemplateService.suggestSystemBoxArt).toHaveBeenCalledWith('sys1', gameInfo);
    expect(gameTemplateService.shareSystemGameInfo).not.toHaveBeenCalled();
    expect(getTemplateGameInfo(template)).toEqual(gameInfo);
  });

  it('sends nothing to the server for a game that is only local', () => {
    const result = attachGameInfo({ name: 'Homebrew' }, gameInfo, {}, { suggest: true });

    expect(result).toBeNull();
    expect(gameTemplateService.suggestSystemBoxArt).not.toHaveBeenCalled();
    expect(gameTemplateService.shareSystemGameInfo).not.toHaveBeenCalled();
  });

  it('fills in BGG details an earlier lookup missed, keeping the art already there', () => {
    const template = { name: 'Skat' };
    const firstArt = { bggId: 7, thumbnailUrl: 'https://cf.geekdo-images.com/first.jpg' };
    attachGameInfo(template, firstArt);
    expect(needsGameInfo(template)).toBe(true);

    attachGameInfo(template, { ...gameInfo, playingTime: 30, minAge: 10 });

    expect(getTemplateGameInfo(template)).toEqual({ ...firstArt, playingTime: 30, minAge: 10 });
    expect(needsGameInfo(template)).toBe(false);
  });

  it('does not mix in details of a different game', () => {
    const template = { name: 'Skat' };
    attachGameInfo(template, gameInfo);

    attachGameInfo(template, { bggId: 8, playingTime: 30 });

    expect(getTemplateGameInfo(template)).toEqual(gameInfo);
  });

  it('fills in the shared copy of a system game whose art lacks BGG details', () => {
    const template = { _id: 'sys1', type: 'system', name: 'Skat', gameInfo };
    const detailed = { ...gameInfo, playingTime: 30 };

    attachGameInfo(template, detailed);

    expect(gameTemplateService.shareSystemGameInfo).toHaveBeenCalledWith('sys1', detailed);
    // This device shows the details right away, on top of the shared art
    expect(getTemplateGameInfo(template)).toEqual(detailed);
  });

  it('stops asking about a game once a lookup answered without BGG details', () => {
    const template = { name: 'Homebrew' };
    attachGameInfo(template, gameInfo);
    expect(needsGameInfo(template)).toBe(true);

    markGameInfoChecked('Homebrew');

    expect(needsGameInfo(template)).toBe(false);
  });
});
