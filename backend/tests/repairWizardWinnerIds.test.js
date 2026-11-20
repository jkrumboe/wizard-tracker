const { repairWizardWinnerIds } = require('../utils/gameHelpers');

describe('repairWizardWinnerIds', () => {
  const players = [
    { id: 'u1', name: 'A', originalId: 'old1' },
    { id: 'u2', name: 'B', originalId: 'old2' },
  ];

  it('returns null when winners already match players', () => {
    expect(repairWizardWinnerIds({ players, winner_id: ['u1'] })).toBeNull();
  });

  it('returns null when there is no winner', () => {
    expect(repairWizardWinnerIds({ players })).toBeNull();
  });

  it('recomputes from final scores (highest wins, ties share)', () => {
    const gameData = { players, winner_id: ['old1'], final_scores: { u1: 50, u2: 50 } };
    expect(repairWizardWinnerIds(gameData)).toEqual(['u1', 'u2']);
  });

  it('maps through originalId when scores are incomplete', () => {
    const gameData = { players, winner_id: ['old2', 'gone'], final_scores: { u1: 10 } };
    expect(repairWizardWinnerIds(gameData)).toEqual(['u2']);
  });

  it('handles a string winner_id', () => {
    const gameData = { players, winner_id: 'old1', final_scores: { u1: 90, u2: 10 } };
    expect(repairWizardWinnerIds(gameData)).toEqual(['u1']);
  });
});
