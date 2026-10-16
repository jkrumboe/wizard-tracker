import { useTranslation } from 'react-i18next';
import { BombIcon, CloudIcon } from '@/components/ui/Icon';
import { SPECIAL_CARDS } from '@/shared/constants/specialCards';
import '@/styles/components/edition-picker.css';

const CARD_ICONS = { bomb: BombIcon, cloud: CloudIcon };

/**
 * Pick which edition of a game is played. Each option lists the edition's
 * special cards; the ones the scoreboard tracks are marked with their icon.
 * `showCards` is off for games without special cards (table games).
 * @param {{ editions: Array, value: string|null, onChange: (edition: Object) => void, name?: string, showCards?: boolean }} props
 */
const EditionPicker = ({ editions, value, onChange, name = 'edition', showCards = true }) => {
  const { t } = useTranslation();

  if (!editions?.length) return null;

  return (
    <div className="edition-picker" role="radiogroup" aria-label={t('editions.label')}>
      {editions.map((edition) => {
        const checked = edition.id === value;
        const tracked = edition.specialCards.filter((id) => SPECIAL_CARDS[id]?.effect);
        const others = edition.specialCards.filter((id) => !SPECIAL_CARDS[id]?.effect);
        return (
          <label key={edition.id} className={`edition-option${checked ? ' checked' : ''}`}>
            <input
              type="radio"
              className="edition-radio"
              name={name}
              value={edition.id}
              checked={checked}
              onChange={() => onChange(edition)}
            />
            <span className="edition-name">{t(edition.nameKey, { defaultValue: edition.name || edition.id })}</span>
            {showCards && (
              <span className="edition-cards">
                {edition.specialCards.length === 0 && t('editions.noSpecialCards')}
                {tracked.map((id) => {
                  const Icon = CARD_ICONS[id];
                  return (
                    <span key={id} className={`edition-card tracked ${id}`}>
                      {Icon && <Icon size={14} aria-hidden="true" />}
                      {t(`editions.cards.${id}`)}
                    </span>
                  );
                })}
                {others.length > 0 && (
                  <span className="edition-card">
                    {others.map((id) => t(`editions.cards.${id}`)).join(' · ')}
                  </span>
                )}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
};

export default EditionPicker;
