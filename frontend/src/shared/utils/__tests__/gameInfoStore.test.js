import { describe, it, expect, beforeEach } from 'vitest';
import {
  safeImageUrl,
  saveGameInfo,
  getTemplateGameInfo,
  getTemplateImageUrl,
} from '../gameInfoStore';

const THUMB = 'https://cf.geekdo-images.com/a__thumb/img/x.jpg';
const IMAGE = 'https://cf.geekdo-images.com/a__original/img/x.jpg';

describe('gameInfoStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('only allows https images from the BGG CDN', () => {
    expect(safeImageUrl(THUMB)).toBe(THUMB);
    expect(safeImageUrl('https://evil.example/x.jpg')).toBeNull();
    expect(safeImageUrl('http://cf.geekdo-images.com/x.jpg')).toBeNull();
    expect(safeImageUrl('javascript:alert(1)')).toBeNull();
    expect(safeImageUrl(undefined)).toBeNull();
  });

  it('prefers the template own game info over the device store', () => {
    saveGameInfo('Wizard', { thumbnailUrl: IMAGE });
    const template = { name: 'Wizard', gameInfo: { thumbnailUrl: THUMB } };
    expect(getTemplateGameInfo(template).thumbnailUrl).toBe(THUMB);
  });

  it('falls back to game info saved on this device by name', () => {
    saveGameInfo('Wizard', { bggId: 1465, thumbnailUrl: THUMB });
    expect(getTemplateGameInfo({ name: 'Wizard' }).bggId).toBe(1465);
    expect(getTemplateGameInfo({ name: 'Dutch' })).toBeNull();
  });

  it('picks the requested image size with fallbacks', () => {
    const template = { name: 'Catan', gameInfo: { thumbnailUrl: THUMB, imageUrl: IMAGE } };
    expect(getTemplateImageUrl(template)).toBe(THUMB);
    expect(getTemplateImageUrl(template, 'image')).toBe(IMAGE);
    expect(getTemplateImageUrl({ name: 'X', gameInfo: { imageUrl: IMAGE } })).toBe(IMAGE);
    expect(getTemplateImageUrl({ name: 'X', gameInfo: { thumbnailUrl: 'https://evil.example/a.png' } })).toBeNull();
  });
});
