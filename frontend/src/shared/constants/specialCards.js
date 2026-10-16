// Special cards that game editions can add to the deck.
// `effect` marks cards that change how a round is scored, so the game screen
// offers a switch for them. Cards without one only change how tricks are played
// and need no tracking.
export const SPECIAL_CARD_EFFECTS = {
  // One trick is destroyed: the round has one trick fewer to win
  REDUCE_TRICKS: 'reduceTricks',
  // A player changes their call by one, so calls may exceed the round and no call is forbidden
  ADJUST_CALL: 'adjustCall',
};

export const SPECIAL_CARDS = {
  bomb: { id: 'bomb', effect: SPECIAL_CARD_EFFECTS.REDUCE_TRICKS },
  cloud: { id: 'cloud', effect: SPECIAL_CARD_EFFECTS.ADJUST_CALL },
  dragon: { id: 'dragon', effect: null },
  fairy: { id: 'fairy', effect: null },
  juggler: { id: 'juggler', effect: null },
  werewolf: { id: 'werewolf', effect: null },
  shapeshifter: { id: 'shapeshifter', effect: null },
  vampire: { id: 'vampire', effect: null },
  witch: { id: 'witch', effect: null },
};

// Cards that have a switch on the game screen, in display order
export const TRACKED_SPECIAL_CARDS = Object.values(SPECIAL_CARDS)
  .filter((card) => card.effect)
  .map((card) => card.id);
