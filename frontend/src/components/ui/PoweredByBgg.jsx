import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import poweredByBggLogo from '@/assets/powered-by-bgg.svg';
import '@/styles/components/powered-by-bgg.css';

/**
 * The "Powered by BGG" logo linking back to BoardGameGeek. BGG's XML API terms
 * require it wherever the app shows data from their API.
 */
const PoweredByBgg = ({ className = '' }) => {
  const { t } = useTranslation();
  return (
    <a
      className={['powered-by-bgg', className].filter(Boolean).join(' ')}
      href="https://boardgamegeek.com"
      target="_blank"
      rel="noopener noreferrer"
    >
      <img src={poweredByBggLogo} alt={t('common.poweredByBgg')} width="144" height="32" />
    </a>
  );
};

PoweredByBgg.propTypes = {
  className: PropTypes.string,
};

export default PoweredByBgg;
