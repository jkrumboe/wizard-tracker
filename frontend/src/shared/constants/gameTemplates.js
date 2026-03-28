import { WIZARD_FORMULA } from '../utils/scoringFormulas';

export const WIZARD_TEMPLATE = {
  id: '__wizard__',
  name: 'Wizard',
  gameCategory: 'callAndMade',
  isBuiltin: true,
  scoringFormula: { ...WIZARD_FORMULA },
  roundPattern: 'pyramid',
  maxRounds: 20,
  hasDealerRotation: true,
  hasForbiddenCall: true,
  description: 'The classic Wizard card game',
};

// Built-in system templates that are always available offline.
// When the backend is reachable, server versions override these (e.g. with richer descriptions).
export const BUILTIN_SYSTEM_TEMPLATES = [
  {
    ...WIZARD_TEMPLATE,
    _id: '__builtin_wizard__',
  },
  {
    _id: '__builtin_volleyball__',
    name: 'Volleyball',
    gameCategory: 'table',
    isBuiltin: true,
    targetNumber: 25,
    lowIsBetter: false,
    scoreEntryMode: 'twoSideGesture',
    description: 'Two-side live scoreboard with tap and swipe controls.',
  },
  {
    _id: '__builtin_dutch__',
    name: 'Dutch',
    gameCategory: 'table',
    isBuiltin: true,
    targetNumber: 100,
    lowIsBetter: true,
    description: 'Classic Dutch card game — lowest score wins!',
  },
  {
    _id: '__builtin_flip7__',
    name: 'Flip 7',
    gameCategory: 'table',
    isBuiltin: true,
    targetNumber: null,
    lowIsBetter: true,
    description: 'Flip cards and try to stay under 7 points.',
  },
];
