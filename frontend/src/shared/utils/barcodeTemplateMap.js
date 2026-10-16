// Maps game box barcodes (EAN/UPC) to game template names for scan-to-start.
// Links made on this device live in localStorage so scanning works offline;
// system templates can additionally carry shared `barcodes` from the server.

const STORAGE_KEY = 'wizardTracker_barcodeMap';

/**
 * Strip whitespace and anything that isn't a digit.
 * @param {string} code
 * @returns {string}
 */
export const normalizeBarcode = (code) => String(code ?? '').replace(/\D/g, '');

/**
 * Whether a code looks like an EAN-8/UPC-A/EAN-13/GTIN-14 barcode.
 * @param {string} code
 * @returns {boolean}
 */
export const isValidBarcode = (code) => /^\d{8,14}$/.test(normalizeBarcode(code));

// UPC-A (12 digits) and EAN-13 with a leading 0 are the same product
const barcodeVariants = (code) => {
  const normalized = normalizeBarcode(code);
  if (normalized.length === 12) return [normalized, `0${normalized}`];
  if (normalized.length === 13 && normalized.startsWith('0')) return [normalized, normalized.slice(1)];
  return [normalized];
};

const readMap = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('Could not read barcode map:', error);
    return {};
  }
};

const writeMap = (map) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (error) {
    console.warn('Could not save barcode map:', error);
  }
};

/**
 * Look up the template name linked to a barcode on this device.
 * @param {string} code
 * @returns {string|null}
 */
export const getTemplateNameForBarcode = (code) => {
  const map = readMap();
  for (const variant of barcodeVariants(code)) {
    if (map[variant]) return map[variant];
  }
  return null;
};

/**
 * Link a barcode to a template name on this device.
 * @param {string} code
 * @param {string} templateName
 */
export const linkBarcode = (code, templateName) => {
  const normalized = normalizeBarcode(code);
  if (!isValidBarcode(normalized) || !templateName) return;
  const map = readMap();
  map[normalized] = templateName;
  writeMap(map);
};

/**
 * Remove a barcode link from this device.
 * @param {string} code
 */
export const unlinkBarcode = (code) => {
  const map = readMap();
  for (const variant of barcodeVariants(code)) delete map[variant];
  writeMap(map);
};

/**
 * All barcodes linked to a template on this device.
 * @param {string} templateName
 * @returns {string[]}
 */
export const getBarcodesForTemplate = (templateName) => (
  Object.entries(readMap())
    .filter(([, name]) => name === templateName)
    .map(([code]) => code)
);

// A template and the "<game>: <edition>" templates folded into it
const withEditionSources = (template) => [template, ...(template.editionSources || [])];

/**
 * Find the template for a scanned barcode. Device links win over shared
 * template barcodes so a user can override a wrong shared mapping. A barcode
 * of an edition ("Wizard: Jubiläumsedition") finds the game it belongs to.
 * @param {string} code
 * @param {Array} templates - Startable templates (see templateResolver.loadAllTemplates)
 * @returns {Object|null}
 */
export const findTemplateByBarcode = (code, templates) => findStartForBarcode(code, templates)?.template || null;

/**
 * Like findTemplateByBarcode, plus the name to start it with: the edition's
 * name when the barcode belongs to an edition, so setup preselects it.
 * @param {string} code
 * @param {Array} templates
 * @returns {{ template: Object, startName: string }|null}
 */
export const findStartForBarcode = (code, templates) => {
  const linkedName = getTemplateNameForBarcode(code);
  if (linkedName) {
    const linked = templates.find((t) => withEditionSources(t).some((source) => source.name === linkedName));
    if (linked) return { template: linked, startName: linkedName };
  }

  const variants = new Set(barcodeVariants(code));
  for (const template of templates) {
    const source = withEditionSources(template)
      .find((t) => (t.barcodes || []).some((b) => variants.has(normalizeBarcode(b))));
    if (source) return { template, startName: source.name };
  }
  return null;
};
