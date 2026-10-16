import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeBarcode,
  isValidBarcode,
  linkBarcode,
  unlinkBarcode,
  getTemplateNameForBarcode,
  getBarcodesForTemplate,
  findTemplateByBarcode,
} from '../barcodeTemplateMap';

const STORAGE_KEY = 'wizardTracker_barcodeMap';

const templates = [
  { _id: '__builtin_wizard__', name: 'Wizard', barcodes: [] },
  { _id: 'abc', name: 'Dutch', barcodes: ['4001234567890'] },
  { id: 'local_1', name: 'Rummy' },
];

describe('barcodeTemplateMap', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('normalizes and validates barcodes', () => {
    expect(normalizeBarcode(' 4001-2345 67890 ')).toBe('4001234567890');
    expect(isValidBarcode('4001234567890')).toBe(true);
    expect(isValidBarcode('12345670')).toBe(true);
    expect(isValidBarcode('1234')).toBe(false);
    expect(isValidBarcode('')).toBe(false);
  });

  it('links, looks up and unlinks a barcode', () => {
    linkBarcode('4009876543210', 'Wizard');
    expect(getTemplateNameForBarcode('4009876543210')).toBe('Wizard');
    expect(getBarcodesForTemplate('Wizard')).toEqual(['4009876543210']);

    unlinkBarcode('4009876543210');
    expect(getTemplateNameForBarcode('4009876543210')).toBeNull();
  });

  it('ignores invalid codes when linking', () => {
    linkBarcode('123', 'Wizard');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('treats UPC-A and its zero-padded EAN-13 as the same code', () => {
    linkBarcode('012345678905', 'Rummy');
    expect(getTemplateNameForBarcode('0012345678905')).toBe('Rummy');
  });

  it('survives corrupted storage', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(getTemplateNameForBarcode('4001234567890')).toBeNull();
  });

  it('finds a template by its shared barcodes', () => {
    expect(findTemplateByBarcode('4001234567890', templates)?.name).toBe('Dutch');
  });

  it('prefers a device link over shared barcodes', () => {
    linkBarcode('4001234567890', 'Rummy');
    expect(findTemplateByBarcode('4001234567890', templates)?.name).toBe('Rummy');
  });

  it('falls back to shared barcodes when the linked template no longer exists', () => {
    linkBarcode('4001234567890', 'Deleted Game');
    expect(findTemplateByBarcode('4001234567890', templates)?.name).toBe('Dutch');
  });

  it('returns null for unknown barcodes', () => {
    expect(findTemplateByBarcode('4000000000000', templates)).toBeNull();
  });
});
