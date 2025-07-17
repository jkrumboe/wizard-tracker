/**
 * Example demonstrations of the security validation system
 * This file shows how the security measures protect against various attacks
 */

import { ShareValidator } from '../src/utils/shareValidator';

// Example 1: XSS Attack Prevention
console.log("=== XSS Attack Prevention ===");

const maliciousGameData = {
  id: "game123",
  players: [
    { 
      id: "player1", 
      name: "<script>alert('XSS')</script>Evil Player" 
    },
    { 
      id: "player2", 
      name: "Normal Player" 
    }
  ],
  total_rounds: 5,
  round_data: [],
  created_at: new Date().toISOString(),
  game_mode: "Local"
};

const validation1 = ShareValidator.validateGameDataStructure(maliciousGameData);
if (validation1.isValid) {
  const sanitized = ShareValidator.sanitizeGameData(maliciousGameData);
  console.log("Original player name:", maliciousGameData.players[0].name);
  console.log("Sanitized player name:", sanitized.players[0].name);
  // Output: "Evil Player" (script tags removed)
}

// Example 2: Data Structure Validation
console.log("\n=== Data Structure Validation ===");

const invalidGameData = {
  id: "game456",
  // Missing required 'players' field
  total_rounds: "not a number", // Wrong type
  round_data: [],
  created_at: new Date().toISOString(),
  game_mode: "InvalidMode" // Not in whitelist
};

const validation2 = ShareValidator.validateGameDataStructure(invalidGameData);
console.log("Validation result:", validation2);
// Output: { isValid: false, error: "Missing required field: players" }

// Example 3: Size Limit Protection
console.log("\n=== Size Limit Protection ===");

const oversizedData = "a".repeat(ShareValidator.MAX_DECODED_SIZE + 1);
const encodedOversized = btoa(oversizedData);

const validation3 = ShareValidator.validateEncodedGameData(encodedOversized);
console.log("Oversized data validation:", validation3.error);
// Output: "Data too large"

// Example 4: Base64 Validation
console.log("\n=== Base64 Format Validation ===");

const invalidBase64 = "This is not base64!@#$%";
const validation4 = ShareValidator.validateEncodedGameData(invalidBase64);
console.log("Invalid base64 validation:", validation4.error);
// Output: "Invalid data format"

// Example 5: Share Key Validation
console.log("\n=== Share Key Validation ===");

const validShareKey = "share_1234567890123_abcdefghi";
const invalidShareKey = "malicious_key_format";

console.log("Valid share key:", ShareValidator.isValidShareKey(validShareKey));
// Output: true

console.log("Invalid share key:", ShareValidator.isValidShareKey(invalidShareKey));
// Output: false

// Example 6: Numeric Value Clamping
console.log("\n=== Numeric Value Clamping ===");

const gameWithExtremeValues = {
  id: "game789",
  players: [{ id: "p1", name: "Player 1" }],
  total_rounds: 999999, // Exceeds MAX_ROUNDS
  round_data: [],
  final_scores: {
    "p1": 999999999 // Exceeds MAX_SCORE
  },
  created_at: new Date().toISOString(),
  game_mode: "Local"
};

const validation6 = ShareValidator.validateGameDataStructure(gameWithExtremeValues);
if (validation6.isValid) {
  const sanitized = ShareValidator.sanitizeGameData(gameWithExtremeValues);
  console.log("Original rounds:", gameWithExtremeValues.total_rounds);
  console.log("Clamped rounds:", sanitized.total_rounds);
  console.log("Original score:", gameWithExtremeValues.final_scores.p1);
  console.log("Clamped score:", sanitized.final_scores.p1);
}

// Example 7: Property Injection Prevention
console.log("\n=== Property Injection Prevention ===");

const maliciousGameObject = {
  id: "game999",
  players: [{ id: "p1", name: "Player 1" }],
  total_rounds: 5,
  round_data: [],
  created_at: new Date().toISOString(),
  game_mode: "Local",
  constructor: "malicious",
  __proto__: { evil: true },
  prototype: { hack: true }
};

const sanitizedGame = ShareValidator.sanitizeGameObject(maliciousGameObject);
console.log("Has constructor property:", 'constructor' in sanitizedGame);
console.log("Has __proto__ property:", '__proto__' in sanitizedGame);
console.log("Has prototype property:", 'prototype' in sanitizedGame);
// All should output: false

export { ShareValidator };
