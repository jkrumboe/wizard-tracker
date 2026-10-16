import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BombIcon, CloudIcon, RotateCcwIcon } from '@/components/ui/Icon';
import { SPECIAL_CARDS } from '@/shared/constants/specialCards';
import { setEditionCards, resetEditionCards } from '@/shared/utils/gameEditions';
import '@/styles/components/edition-picker.css';

const CARD_ICONS = { bomb: BombIcon, cloud: CloudIcon };
const ALL_CARDS = Object.keys(SPECIAL_CARDS);

/**
 * The special cards of one edition, each with what it does, on the edition's
 * info page. "Edit cards" lets the user choose which cards the edition has.
 * @param {{ templateName: string, edition: Object, onChange: () => void }} props
 */
const EditionCards = ({ templateName, edition, onChange }) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const cards = ALL_CARDS.filter((id) => edition.specialCards.includes(id));

  const toggleCard = (cardId) => {
    const next = cards.includes(cardId) ? cards.filter((id) => id !== cardId) : [...cards, cardId];
    // Keep the catalog order so lists read the same everywhere
    setEditionCards(templateName, edition.id, ALL_CARDS.filter((id) => next.includes(id)));
    onChange();
  };

  const handleReset = () => {
    resetEditionCards(templateName, edition.id);
    onChange();
  };

  return (
    <section className="game-type-section edition-cards-section" aria-labelledby="edition-cards-title">
      <div className="edition-cards-head">
        <span id="edition-cards-title" className="games-section-label">{t('editions.specialCardsTitle')}</span>
        {edition.cardsEdited && !editing && (
          <button
            type="button"
            className="edition-text-btn"
            onClick={handleReset}
          >
            <RotateCcwIcon size={14} aria-hidden="true" />
            {t('editions.reset')}
          </button>
        )}
        <button
          type="button"
          className="edition-text-btn"
          onClick={() => setEditing((value) => !value)}
          aria-expanded={editing}
        >
          {editing ? t('editions.doneEditing') : t('editions.editCards')}
        </button>
      </div>

      {editing ? (
        <div className="edition-card-toggles" role="group" aria-label={t('editions.specialCardsTitle')}>
          {ALL_CARDS.map((cardId) => {
            const Icon = CARD_ICONS[cardId];
            const active = cards.includes(cardId);
            return (
              <button
                key={cardId}
                type="button"
                className={`edition-card-toggle ${cardId}${active ? ' active' : ''}`}
                aria-pressed={active}
                onClick={() => toggleCard(cardId)}
              >
                {Icon && <Icon size={14} aria-hidden="true" />}
                {t(`editions.cards.${cardId}`)}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          {cards.length === 0 && <p className="edition-cards-empty">{t('editions.noSpecialCardsInfo')}</p>}
          {cards.length > 0 && (
            <ul className="edition-card-list">
              {cards.map((cardId) => {
                const Icon = CARD_ICONS[cardId];
                const tracked = Boolean(SPECIAL_CARDS[cardId].effect);
                return (
                  <li key={cardId} className={`edition-card-item ${cardId}`}>
                    <span className="edition-card-item-name">
                      {Icon && <Icon size={16} aria-hidden="true" />}
                      {t(`editions.cards.${cardId}`)}
                      {tracked && <span className="edition-card-switch">{t('editions.hasSwitch')}</span>}
                    </span>
                    <span className="edition-card-item-rule">{t(`editions.cardRules.${cardId}`)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
};

export default EditionCards;
