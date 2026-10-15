import '@/styles/components/statTiles.css';

/**
 * A labelled number tile. `tone` ('good' | 'bad' | 'warn') colours the value.
 * Lay several out with a `.stats-tiles` wrapper.
 */
const StatTile = ({ label, value, unit, tone }) => (
  <div className={`stats-tile${tone ? ` is-${tone}` : ''}`}>
    <span className="stats-tile-label">{label}</span>
    <span className="stats-tile-value">
      {value}
      {unit && <span className="stats-tile-unit"> {unit}</span>}
    </span>
  </div>
);

export default StatTile;
