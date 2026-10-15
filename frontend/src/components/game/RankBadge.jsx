import { CrownIcon } from '@/components/ui/Icon';

const MEDALS = { 1: 'gold', 2: 'silver', 3: 'bronze' };

/**
 * Placement shown in game standings: a crown for 1st, medal-tinted numbers
 * for 2nd and 3rd, plain numbers for everyone else.
 * @param {{ rank: number }} props
 */
const RankBadge = ({ rank }) => (
  <div className={`rank-col ${MEDALS[rank] || ''}`}>
    {rank === 1 ? <CrownIcon size={18} strokeWidth={2.25} role="img" aria-label="1" /> : rank}
  </div>
);

export default RankBadge;
