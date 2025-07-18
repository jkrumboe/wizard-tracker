# Security Measures for Shared Game Links

## Overview

This document outlines the security measures implemented to protect against malicious shared game links and data injection attacks in the Wizard Tracker application.

## Security Threats Addressed

### 1. **Cross-Site Scripting (XSS)**
- **Risk**: Malicious HTML/JavaScript injection through player names, game names, or other user-controlled data
- **Mitigation**: All string data is sanitized by removing HTML tags, JavaScript protocols, and event handlers

### 2. **Code Injection**
- **Risk**: Execution of malicious code through crafted data structures
- **Mitigation**: 
  - Strict data structure validation
  - Removal of dangerous object properties (`constructor`, `__proto__`, `prototype`)
  - Sanitization of all string inputs

### 3. **Memory Exhaustion (DoS)**
- **Risk**: Large payloads designed to crash the application or browser
- **Mitigation**: 
  - Maximum file size limits (1MB for imports)
  - Maximum decoded data size limits
  - Limits on array/object sizes (players, rounds, etc.)

### 4. **LocalStorage Pollution**
- **Risk**: Filling up localStorage with malicious data
- **Mitigation**: 
  - Automatic cleanup of expired share keys
  - Size limits on stored data
  - Validation of share key formats

### 5. **Data Structure Tampering**
- **Risk**: Modified links with invalid or malicious data structures
- **Mitigation**: 
  - Comprehensive data structure validation
  - Required field validation
  - Type checking for all data fields

## Implementation Details

### ShareValidator Class

Located in `/src/utils/shareValidator.js`, this class provides:

#### Input Validation
- **Base64 Format Validation**: Ensures proper base64 encoding
- **Size Limits**: Prevents oversized payloads
- **JSON Structure Validation**: Validates JSON format before processing

#### Data Structure Validation
- **Required Fields**: Validates presence of mandatory fields (`id`, `players`, `total_rounds`)
- **Data Types**: Ensures correct types for all fields
- **Range Validation**: Validates numeric values are within reasonable ranges
- **Array Validation**: Validates player arrays and round data

#### Data Sanitization
- **String Sanitization**: Removes HTML tags, script content, and dangerous protocols
- **Numeric Clamping**: Ensures scores and other numeric values are within safe ranges
- **Property Filtering**: Removes potentially dangerous object properties

### Security Limits

```javascript
// Maximum sizes to prevent memory exhaustion
MAX_DECODED_SIZE = 1MB
MAX_PLAYER_NAME_LENGTH = 50 characters
MAX_GAME_NAME_LENGTH = 100 characters
MAX_PLAYERS = 20 players
MAX_ROUNDS = 1000 rounds
MAX_SCORE = 1,000,000 points

// Valid game modes (whitelist)
VALID_GAME_MODES = ['Local', 'Online', 'Tournament']
```

### Share Key Security

Share keys follow a specific format for validation:
```
share_[timestamp]_[9-character-random-string]
```

- Temporal validation prevents replay attacks
- Format validation prevents injection
- Automatic expiration (24 hours)
- Cross-device detection and appropriate error messaging

## Protected Entry Points

### 1. URL Parameter Imports
- `?importGame=<base64>` - Single game import from URL
- `?importGames=<base64>` - Multiple games import from URL
- `?shareKey=<key>` - Temporary share key import

### 2. File Imports
- JSON file upload validation
- File type checking
- File size limits
- Content validation before processing

### 3. Share Generation
- Data validation before creating share links
- Sanitization of outgoing data
- Prevention of sharing paused/incomplete games

## Error Handling

The security system provides user-friendly error messages while logging detailed information for debugging:

- **User Messages**: Clear, actionable error messages
- **Console Logging**: Detailed error information for developers
- **Graceful Degradation**: Fallback behaviors when validation fails

## Usage Examples

### Validating Encoded Game Data
```javascript
const validation = ShareValidator.validateEncodedGameData(encodedData);
if (!validation.isValid) {
  setMessage({ text: `Invalid shared link: ${validation.error}`, type: 'error' });
  return;
}
// Use validation.data (sanitized)
```

### Validating Share Keys
```javascript
if (!ShareValidator.isValidShareKey(shareKey)) {
  setMessage({ text: 'Invalid share link format.', type: 'error' });
  return;
}
```

## Best Practices

### For Developers
1. **Always validate** before processing any external data
2. **Sanitize data** before storing or displaying
3. **Use the validation results** rather than original data
4. **Log security events** for monitoring
5. **Provide clear error messages** to users

### For Users
1. **Only click trusted share links** from known players
2. **Be cautious** with links from unknown sources
3. **Report suspicious behavior** if encountered
4. **Use file download/upload** for cross-device sharing when possible

## Security Testing

To test the security measures:

1. **Invalid Base64**: Try sharing links with invalid base64 data
2. **Oversized Data**: Test with files larger than 1MB
3. **Invalid JSON**: Share links with malformed JSON
4. **XSS Attempts**: Try player names with HTML/JavaScript
5. **Invalid Share Keys**: Test with malformed share key formats

## Future Enhancements

Potential additional security measures to consider:

1. **Digital Signatures**: Cryptographic verification of shared data
2. **Rate Limiting**: Prevent spam sharing attempts
3. **Content Security Policy**: Additional XSS protection
4. **Audit Logging**: Track security events for analysis
5. **Encrypted Shares**: Optional encryption for sensitive game data

## Conclusion

The implemented security measures provide comprehensive protection against common attack vectors while maintaining usability. The validation system is designed to be both secure and user-friendly, providing clear feedback when issues are detected.

Regular security reviews and updates should be performed as new threats emerge or the application evolves.
