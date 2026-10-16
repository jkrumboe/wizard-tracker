import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BombIcon, CheckIcon, ChevronDownIcon, CloudIcon, ImagePlusIcon, PlusIcon, XIcon } from '@/components/ui/Icon';
import FindGameInfoModal from '@/components/modals/FindGameInfoModal';
import AddEditionModal from '@/components/modals/AddEditionModal';
import { SPECIAL_CARDS } from '@/shared/constants/specialCards';
import { STANDARD_EDITION_ID } from '@/shared/utils/gameEditions';
import { getTemplateImageUrl } from '@/shared/utils/gameInfoStore';
import { useModalDismiss } from '@/shared/hooks/useModalDismiss';
import { useUser } from '@/shared/hooks/useUser';
import '@/styles/components/modal.css';
import '@/styles/components/edition-picker.css';

const CARD_ICONS = { bomb: BombIcon, cloud: CloudIcon };

// Box art of an edition lives on its own template ("Wizard: Jubiläumsedition") when it
// has one, otherwise in the device store under this key (built-in and custom editions)
const artTemplateFor = (template, edition) => edition.sourceTemplate || { name: `${template.name}#${edition.id}` };

// The plain game shows the game's own box art
const isBaseEdition = (template, edition) => edition.id === STANDARD_EDITION_ID || edition.id === template.defaultEdition;

const getEditionArt = (template, edition) => {
  const own = isBaseEdition(template, edition) ? null : getTemplateImageUrl(artTemplateFor(template, edition));
  return { url: own || getTemplateImageUrl(template), isOwn: Boolean(own) };
};

const EditionArt = ({ url, label }) => (
  <span className="edition-art" aria-hidden="true">
    <span className="edition-art-initial">{label.charAt(0)}</span>
    {url && <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" />}
  </span>
);

const TrackedCardIcons = ({ edition }) => {
  const { t } = useTranslation();
  return edition.specialCards
    .filter((id) => SPECIAL_CARDS[id]?.effect && CARD_ICONS[id])
    .map((id) => {
      const Icon = CARD_ICONS[id];
      return <Icon key={id} size={14} className={`edition-card-icon ${id}`} aria-label={t(`editions.cards.${id}`)} />;
    });
};

/**
 * Edition selector on a game's page: shows the edition that "Start new game" and
 * the info page use, opens a list with each edition's box art to pick another,
 * and a + button to add an edition of your own.
 * @param {{ template: Object, editions: Array, value: string|null,
 *   onChange: (edition: Object) => void, onAdded: (editionId: string) => void }} props
 */
const EditionSwitcher = ({ template, editions, value, onChange, onAdded }) => {
  const { t } = useTranslation();
  const { user } = useUser();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  // Edition whose box art is being looked up
  const [findingArtFor, setFindingArtFor] = useState(null);

  const labelOf = (edition) => t(edition.nameKey, { defaultValue: edition.name || edition.id });
  const selected = editions.find((edition) => edition.id === value) || editions[0];

  const closePicker = () => setPickerOpen(false);
  useModalDismiss(pickerOpen && !findingArtFor, closePicker);

  const handlePick = (edition) => {
    onChange(edition);
    closePicker();
  };

  if (!selected) return null;
  const selectedLabel = labelOf(selected);

  return (
    <section className="edition-switcher" aria-label={t('editions.sectionLabel')}>
      <span className="games-section-label">{t('editions.sectionLabel')}</span>
      <div className="edition-switcher-row">
        <button
          type="button"
          className="edition-select"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
        >
          <EditionArt url={getEditionArt(template, selected).url} label={selectedLabel} />
          <span className="edition-select-name">{selectedLabel}</span>
          <TrackedCardIcons edition={selected} />
          <ChevronDownIcon size={18} className="edition-select-chevron" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="edition-add-btn"
          onClick={() => setAdding(true)}
          aria-label={t('editions.addEditionLong')}
          title={t('editions.addEditionLong')}
        >
          <PlusIcon size={18} aria-hidden="true" />
        </button>
      </div>

      {pickerOpen && (
        <div className="modal-overlay" onClick={closePicker}>
          <div className="modal-container edition-modal" role="dialog" aria-modal="true" aria-labelledby="edition-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="edition-modal-title">{t('editions.chooseTitle')}</h2>
              <button className="close-btn" onClick={closePicker} aria-label={t('common.close')}>
                <XIcon size={20} />
              </button>
            </div>
            <div className="modal-content">
              <div className="edition-choice-list" role="radiogroup" aria-label={t('editions.sectionLabel')}>
                {editions.map((edition) => {
                  const label = labelOf(edition);
                  const art = getEditionArt(template, edition);
                  const checked = edition.id === selected.id;
                  const canFindArt = Boolean(user) && !art.isOwn && !isBaseEdition(template, edition);
                  return (
                    <div key={edition.id} className={`edition-choice${checked ? ' checked' : ''}`}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        className="edition-choice-main"
                        onClick={() => handlePick(edition)}
                      >
                        <EditionArt url={art.url} label={label} />
                        <span className="edition-choice-text">
                          <span className="edition-choice-name">{label}</span>
                          <span className="edition-choice-cards">
                            <TrackedCardIcons edition={edition} />
                            {edition.specialCards.length === 0
                              ? t('editions.noSpecialCards')
                              : edition.specialCards.map((id) => t(`editions.cards.${id}`)).join(' · ')}
                          </span>
                        </span>
                        {checked && <CheckIcon size={18} className="edition-choice-check" aria-hidden="true" />}
                      </button>
                      {canFindArt && (
                        <button
                          type="button"
                          className="edition-choice-art-btn"
                          onClick={() => setFindingArtFor(edition)}
                          aria-label={t('gameType.findBoxArt')}
                          title={t('gameType.findBoxArt')}
                        >
                          <ImagePlusIcon size={18} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <AddEditionModal
        isOpen={adding}
        templateName={template.name}
        onClose={() => setAdding(false)}
        onAdded={onAdded}
      />

      <FindGameInfoModal
        isOpen={Boolean(findingArtFor)}
        onClose={() => setFindingArtFor(null)}
        template={findingArtFor ? artTemplateFor(template, findingArtFor) : null}
        displayName={findingArtFor ? `${template.name}: ${labelOf(findingArtFor)}` : undefined}
        initialQuery={findingArtFor ? `${template.name} ${labelOf(findingArtFor)}` : undefined}
        // Only an edition saved as its own game can be opened by a scanned barcode
        barcodeName={findingArtFor?.sourceTemplate?.name ?? null}
      />
    </section>
  );
};

export default EditionSwitcher;
