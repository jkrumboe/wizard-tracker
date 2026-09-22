"use client"

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/shared/hooks/useTheme';
import { CheckMarkIcon, ChevronRightIcon } from '@/components/ui/Icon';
import {
  CUSTOM_ACCENT_ID,
  DEFAULT_ACCENT_ID,
  normalizeHex,
  previewColor,
} from '@/shared/theme/palettes';
import '@/styles/components/accent-picker.css';

/**
 * Accent colour chooser: ten curated presets plus a free colour input.
 *
 * Collapsed by default so it reads as one more settings row; the row itself
 * carries the current colour and name, so the choice stays visible without
 * having to open the panel.
 *
 * Swatches render the colour as it will actually appear in the *current* theme
 * (the derived `--primary`, not the raw seed), so what you tap is what you get.
 */
const AccentColorPicker = () => {
  const { t } = useTranslation();
  const {
    theme,
    accentId,
    setAccent,
    customAccent,
    setCustomAccent,
    resetAccent,
    accentPresets,
  } = useTheme();

  const colorInputRef = useRef(null);
  const inputId = useId();
  const panelId = `${inputId}-panel`;
  const [open, setOpen] = useState(false);
  // Mirrored so typing a partial hex in the text field does not repaint the app
  // on every keystroke; we only commit once the value parses.
  const [hexDraft, setHexDraft] = useState(customAccent);

  useEffect(() => {
    setHexDraft(customAccent);
  }, [customAccent]);

  const presetName = (preset) =>
    t(`account.accents.${preset.id}`, { defaultValue: preset.name });

  const commitHex = (value) => {
    const normalized = normalizeHex(value);
    if (normalized) {
      setCustomAccent(normalized);
    } else {
      setHexDraft(customAccent);
    }
  };

  const isCustom = accentId === CUSTOM_ACCENT_ID;
  const activePreset = accentPresets.find((preset) => preset.id === accentId);
  const activeName = isCustom ? t('account.accents.custom') : activePreset ? presetName(activePreset) : '';
  // Presets show the colour they resolve to; the custom swatch shows the raw
  // pick, so it always matches the colour input and hex field beside it.
  const activeColor = isCustom ? customAccent : previewColor(activePreset?.seed, theme);
  // Stated outright rather than only when the shift is large: there is no clean
  // cutoff between "tuned" and "rescued", and saying it every time also explains
  // why the same pick looks different in light and dark mode.
  const appliedCustom = previewColor(customAccent, theme);

  return (
    <div className="accent-setting">
      <button
        type="button"
        className="settings-row settings-row-clickable accent-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <div className="settings-row-left">
          <span>{t('account.accentTitle')}</span>
        </div>
        <span className="accent-toggle-right">
          <span className="accent-toggle-swatch" style={{ '--swatch': activeColor }} />
          <span className="accent-toggle-value">{activeName}</span>
          <ChevronRightIcon
            size={18}
            className={`settings-row-chevron accent-toggle-chevron ${open ? 'accent-toggle-chevron-open' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="accent-picker" id={panelId}>
          <p className="accent-picker-description">{t('account.accentDescription')}</p>

          <div className="accent-swatches" role="radiogroup" aria-label={t('account.accentTitle')}>
            {accentPresets.map((preset) => {
              const selected = accentId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={presetName(preset)}
                  title={presetName(preset)}
                  className={`accent-swatch ${selected ? 'accent-swatch-selected' : ''}`}
                  style={{ '--swatch': previewColor(preset.seed, theme) }}
                  onClick={() => setAccent(preset.id)}
                >
                  <span className="accent-swatch-dot">
                    {selected && <CheckMarkIcon size={16} />}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              role="radio"
              aria-checked={isCustom}
              aria-label={t('account.accentCustom')}
              title={t('account.accentCustom')}
              className={`accent-swatch accent-swatch-custom ${isCustom ? 'accent-swatch-selected' : ''}`}
              style={{ '--swatch': customAccent }}
              onClick={() => {
                setAccent(CUSTOM_ACCENT_ID);
                colorInputRef.current?.click();
              }}
            >
              <span className="accent-swatch-dot">
                {isCustom && <CheckMarkIcon size={16} />}
              </span>
            </button>
          </div>

          <div className="accent-custom-row">
            <label className="accent-custom-label" htmlFor={inputId}>
              {t('account.accentCustomLabel')}
            </label>
            <div className="accent-custom-controls">
              <input
                id={inputId}
                ref={colorInputRef}
                type="color"
                className="accent-color-input"
                value={customAccent}
                onChange={(event) => setCustomAccent(event.target.value)}
              />
              <input
                type="text"
                className="accent-hex-input"
                value={hexDraft}
                spellCheck="false"
                autoComplete="off"
                maxLength={7}
                aria-label={t('account.accentCustomLabel')}
                onChange={(event) => setHexDraft(event.target.value)}
                onBlur={(event) => commitHex(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitHex(event.currentTarget.value);
                  }
                }}
              />
            </div>
          </div>

          {isCustom && (
            <p className="accent-adjusted-note">
              {t('account.accentAdjusted', { color: appliedCustom })}
            </p>
          )}

          <div className="accent-preview" aria-hidden="true">
            <span className="accent-preview-label">{t('account.accentPreview')}</span>
            <div className="accent-preview-items">
              <span className="accent-preview-button">{t('account.accentPreviewButton')}</span>
              <span className="accent-preview-chip">{t('account.accentPreviewLink')}</span>
            </div>
          </div>

          {accentId !== DEFAULT_ACCENT_ID && (
            <button type="button" className="accent-reset" onClick={resetAccent}>
              {t('account.accentReset')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AccentColorPicker;
