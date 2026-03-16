const BUILTIN_SYSTEM_TEMPLATES = [
  {
    _id: '__builtin_wizard__',
    name: 'Wizard',
    targetNumber: null,
    lowIsBetter: false,
    gameCategory: 'callAndMade',
    scoringFormula: {
      baseCorrect: 20,
      bonusPerTrick: 10,
      penaltyPerDiff: -10,
    },
    roundPattern: 'pyramid',
    maxRounds: 20,
    hasDealerRotation: true,
    hasForbiddenCall: true,
    description: 'The classic Wizard card game',
    descriptionMarkdown: '',
    isBuiltin: true,
  },
  {
    _id: '__builtin_dutch__',
    name: 'Dutch',
    targetNumber: 100,
    lowIsBetter: true,
    gameCategory: 'table',
    scoringFormula: null,
    roundPattern: null,
    maxRounds: null,
    hasDealerRotation: true,
    hasForbiddenCall: true,
    description: 'Classic Dutch card game - lowest score wins!',
    descriptionMarkdown: '',
    isBuiltin: true,
  },
  {
    _id: '__builtin_flip7__',
    name: 'Flip 7',
    targetNumber: null,
    lowIsBetter: true,
    gameCategory: 'table',
    scoringFormula: null,
    roundPattern: null,
    maxRounds: null,
    hasDealerRotation: true,
    hasForbiddenCall: true,
    description: 'Flip cards and try to stay under 7 points.',
    descriptionMarkdown: '',
    isBuiltin: true,
  },
];

function getBuiltinSystemTemplateById(id) {
  return BUILTIN_SYSTEM_TEMPLATES.find((template) => template._id === id) || null;
}

module.exports = {
  BUILTIN_SYSTEM_TEMPLATES,
  getBuiltinSystemTemplateById,
};