import { WIZARD_FORMULA } from '../utils/scoringFormulas';

const WIZARD_20_SPECIAL_CARDS = ['bomb', 'cloud', 'dragon', 'fairy', 'juggler', 'werewolf'];
const WIZARD_25_SPECIAL_CARDS = [...WIZARD_20_SPECIAL_CARDS, 'shapeshifter'];
const WIZARD_30_SPECIAL_CARDS = [...WIZARD_25_SPECIAL_CARDS, 'vampire', 'witch'];

// Editions of Wizard. All are played and listed as "Wizard"; the edition only
// decides which special cards are in the deck (see constants/specialCards.js).
export const WIZARD_EDITIONS = [
  { id: 'classic', nameKey: 'editions.wizard.classic', specialCards: [] },
  { id: 'anniversary20', nameKey: 'editions.wizard.anniversary20', specialCards: WIZARD_20_SPECIAL_CARDS },
  { id: 'anniversary25', nameKey: 'editions.wizard.anniversary25', specialCards: WIZARD_25_SPECIAL_CARDS },
  { id: 'anniversary30', nameKey: 'editions.wizard.anniversary30', specialCards: WIZARD_30_SPECIAL_CARDS },
];

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
  minPlayers: 3,
  maxPlayers: 6,
  description: 'The classic Wizard card game',
  editions: WIZARD_EDITIONS,
  defaultEdition: 'classic',
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
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Two-side live scoreboard with tap and swipe controls.',
  },
  {
    _id: '__builtin_basketball__',
    name: 'Basketball',
    gameCategory: 'table',
    isBuiltin: true,
    targetNumber: null,
    lowIsBetter: false,
    scoreEntryMode: 'twoSideGesture',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Two-side live scoreboard with +2/+3 and revert controls.',
  },
  {
    _id: '__builtin_dutch__',
    name: 'Dutch',
    gameCategory: 'table',
    isBuiltin: true,
    targetNumber: 100,
    lowIsBetter: true,
    minPlayers: 2,
    maxPlayers: 8,
    description: 'Classic Dutch card game — lowest score wins!',
  },
  {
    _id: '__builtin_flip7__',
    name: 'Flip 7',
    gameCategory: 'table',
    isBuiltin: true,
    targetNumber: null,
    lowIsBetter: true,
    minPlayers: 2,
    maxPlayers: 8,
    description: 'Flip cards and try to stay under 7 points.',
  },
];
