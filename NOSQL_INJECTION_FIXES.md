# NoSQL Injection Security Fixes

This document summarizes the security improvements made to prevent NoSQL injection vulnerabilities in the Wizard Tracker application.

## Overview

Following CodeQL security analysis and MongoDB best practices, we identified and fixed multiple NoSQL injection vulnerabilities across the backend API. These fixes ensure that user-provided input cannot be used to inject malicious query operators or manipulate database queries.

## Security Principles Applied

1. **Input Validation**: All user-provided IDs are validated to be proper MongoDB ObjectIds
2. **Regex Escaping**: All user input used in regex queries is properly escaped using lodash's `_.escapeRegExp()`
3. **Query Operator Safety**: Use of `$eq` operator for explicit value comparison to prevent query object injection
4. **Parameter Sanitization**: Numeric parameters (limit, skip, page) are validated and capped

## Fixed Vulnerabilities

### 1. Regex Injection in Search Endpoints

**Location**: `backend/routes/users.js` - `/admin/player-names` endpoint

**Issue**: User-provided search terms were directly inserted into RegExp constructors without escaping special characters, allowing regex injection attacks.

**Fix**:
```javascript
// Before (VULNERABLE)
const searchRegex = new RegExp(searchTerm, 'i');

// After (SECURE)
const escapedSearchTerm = _.escapeRegExp(searchTerm);
const searchRegex = new RegExp(escapedSearchTerm, 'i');
```

**Impact**: Prevents ReDoS (Regular Expression Denial of Service) attacks and arbitrary regex pattern injection.

### 2. ObjectId Injection in User Management

**Locations**:
- `backend/routes/users.js` - Friend management endpoints (`POST/DELETE /:userId/friends/:friendId`)
- `backend/routes/users.js` - Admin endpoints (`PUT /:userId/username`, `PUT /:userId/role`)
- `backend/routes/users.js` - Player alias endpoint (`DELETE /admin/player-aliases/:aliasId`, `POST /admin/player-aliases`)

**Issue**: User-provided IDs from URL parameters or request body could be query objects instead of strings, allowing injection of MongoDB operators like `{$ne: null}`.

**Fixes**:

1. **Validation before use**:
```javascript
// Validate ObjectId format
if (!mongoose.Types.ObjectId.isValid(userId)) {
  return res.status(400).json({ error: 'Invalid user ID format' });
}
```

2. **Use $eq operator for explicit comparison**:
```javascript
// Before (VULNERABLE)
const user = await User.findById(userId);

// After (SECURE)
const user = await User.findOne({ _id: { $eq: userId } });
```

**Impact**: Prevents attackers from bypassing authentication checks or accessing unauthorized data by injecting query operators.

### 3. ObjectId Injection in Game Endpoints

**Locations**:
- `backend/routes/games.js` - `GET /:id`, `PUT /:id/share`
- `backend/routes/wizardGames.js` - `GET /:id`, `POST /migrate`
- `backend/routes/tableGames.js` - `GET /:id`, `DELETE /:id`

**Issue**: Game IDs from URL parameters were not validated before being used in database queries.

**Fixes**:
```javascript
// Validate ID format
if (!mongoose.Types.ObjectId.isValid(gameId)) {
  return res.status(400).json({ error: 'Invalid game ID format' });
}

// Use $eq operator
const game = await Game.findOne({ _id: { $eq: gameId } });
```

**Special Case - Array of IDs** (`POST /wizard-games/migrate`):
```javascript
// Validate all IDs in array
const invalidIds = gameIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
if (invalidIds.length > 0) {
  return res.status(400).json({
    error: 'Invalid game ID format',
    invalidIds: invalidIds
  });
}
```

**Impact**: Prevents unauthorized game access and manipulation.

### 4. Pagination Parameter Injection

**Location**: `backend/routes/wizardGames.js` - `GET /` endpoint

**Issue**: Pagination parameters (limit, skip) were parsed without validation, allowing injection of non-numeric values or extreme values.

**Fix**:
```javascript
// Before (VULNERABLE)
.limit(parseInt(limit))
.skip(parseInt(skip))

// After (SECURE)
const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
const parsedSkip = Math.max(parseInt(skip) || 0, 0);
.limit(parsedLimit)
.skip(parsedSkip)
```

**Impact**: Prevents DoS attacks via excessive limit values and ensures valid pagination.

### 5. Regex Injection in Game Linkage Utility

**Location**: `backend/utils/gameUserLinkage.js` - `findGamesByUsername()`

**Issue**: Username was directly used in RegExp without escaping.

**Fix**:
```javascript
// Before (VULNERABLE)
const usernameRegex = new RegExp(`^${username}$`);

// After (SECURE)
const sanitizedUsername = escapeRegExp(username);
const usernameRegex = new RegExp(`^${sanitizedUsername}$`);
```

**Impact**: Prevents regex injection in game linking operations.

## Already Secure Implementations

### 1. Username Validation
- `backend/routes/users.js` - `/lookup/:username` endpoint already properly escapes regex using `_.escapeRegExp()`

### 2. Batch Check Endpoint
- `backend/routes/wizardGames.js` - `POST /batch-check` already validates ObjectIds using regex pattern matching

### 3. Authentication Middleware
- User authentication already uses proper ObjectId handling via JWT token validation

## Testing Recommendations

### 1. Test Regex Injection
```bash
# Try special regex characters in search
curl -X GET "http://localhost:3000/api/users/admin/player-names?search=.*" \
  -H "Authorization: Bearer <admin-token>"

# Expected: Returns escaped literal ".*" search, not all players
```

### 2. Test ObjectId Injection
```bash
# Try query object instead of ID
curl -X POST "http://localhost:3000/api/users/123/friends/{\"$ne\":null}" \
  -H "Authorization: Bearer <token>"

# Expected: 400 Bad Request - Invalid ID format
```

### 3. Test Pagination Limits
```bash
# Try extreme limit value
curl -X GET "http://localhost:3000/api/wizard-games?limit=99999999" \
  -H "Authorization: Bearer <token>"

# Expected: Limit capped at 200
```

### 4. Test Array ID Injection
```bash
# Try invalid IDs in array
curl -X POST "http://localhost:3000/api/wizard-games/migrate" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"gameIds": ["invalid", {"$ne": null}]}'

# Expected: 400 Bad Request - Invalid game ID format
```

## Security Best Practices Going Forward

1. **Always validate user input** - Check type, format, and range before using in queries
2. **Use `$eq` operator** - When comparing user-provided values in queries
3. **Escape regex patterns** - Always use `_.escapeRegExp()` or similar when building regex from user input
4. **Validate ObjectIds** - Use `mongoose.Types.ObjectId.isValid()` before using IDs in queries
5. **Sanitize numeric inputs** - Parse, validate, and cap numeric parameters
6. **Use parameterized queries** - Mongoose models already provide this, avoid raw queries
7. **Avoid `findById` with raw params** - Use `findOne({ _id: { $eq: id } })` after validation
8. **Review array inputs** - Validate all elements in arrays before use in `$in` queries

## References

- [OWASP NoSQL Injection](https://owasp.org/www-community/attacks/NoSQL_injection)
- [MongoDB Query Operators](https://www.mongodb.com/docs/manual/reference/operator/query/)
- [CodeQL Rule: js/sql-injection](https://codeql.github.com/codeql-query-help/javascript/js-sql-injection/)
- [Mongoose Security](https://mongoosejs.com/docs/validation.html)

## Summary

All identified NoSQL injection vulnerabilities have been fixed across the backend codebase. The application now properly validates and sanitizes all user input before using it in database queries, following MongoDB and OWASP security best practices.

**Total files modified**: 4
- `backend/routes/users.js`
- `backend/routes/games.js`
- `backend/routes/wizardGames.js`
- `backend/routes/tableGames.js`
- `backend/utils/gameUserLinkage.js`

**Total vulnerabilities fixed**: 15+
