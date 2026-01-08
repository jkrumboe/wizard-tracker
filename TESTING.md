# Testing Setup

This document describes the automated testing infrastructure for the Wizard Tracker project.

## Test Execution

Tests are automatically executed in the following scenarios:

### 1. GitHub Actions (CI/CD)

Tests run automatically on every push to `main` or `develop` branches and on pull requests.

**Workflow File:** `.github/workflows/test.yml`

**Jobs:**
- **test-backend**: Runs backend tests with MongoDB and Redis services
- **test-frontend**: Runs frontend tests and linting
- **integration-tests**: Runs full integration tests after backend and frontend tests pass

**View Results:** Check the "Actions" tab in GitHub after pushing code.

### 2. Run Tests Task (VS Code)

Run all tests manually using the "Run Tests" task.

**Task:** `Run Tests` (workspace root)

This task runs all backend and frontend tests without modifying any files. Use this when you want to verify tests pass without updating version numbers.

**Keyboard Shortcut:** You can run this with `Ctrl+Shift+P` → "Tasks: Run Test Task"

### 3. Update Version Task (VS Code)

Tests run automatically after executing the "Update Version" task in VS Code.

**Task:** `Update Version` (workspace root)

When you run this task:
1. Updates version numbers in all frontend files
2. Runs all backend and frontend tests automatically from workspace root
3. Reports any failures

**Note:** Tests are NOT run during Docker builds. The Docker build process only updates version numbers and builds the application. Tests run locally via VS Code task or in CI/CD only.

This ensures version updates are only applied when all tests pass.

## Manual Test Execution

### Prerequisites for API Tests

The `api.test.js` tests require MongoDB and Redis to be running. You have two options:

1. **Run Docker Containers** (Recommended):
   ```bash
   docker compose up -d
   ```
   This starts MongoDB and Redis in the background.

2. **Skip API Tests**: If MongoDB/Redis are not available, the API tests will automatically skip with warnings. Other tests will still run.

### Run All Tests
```bash
npm test
```

### Run Backend Tests Only
```bash
npm run test:backend
# or
cd backend && npm test
```

### Run Frontend Tests Only
```bash
npm run test:frontend
# or
cd frontend && npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Specific Test File
```bash
# Backend
cd backend && npm test -- tests/api.test.js

# Frontend
cd frontend && npm test -- src/shared/utils/__tests__/wizardGameFormatter.test.js
```

## Test Files

### Backend Tests
Located in `backend/tests/`:
- `api.test.js` - API endpoint tests
- `wizardGameSchema.test.js` - Game schema validation tests
- `wizardGameIntegration.test.js` - Integration tests
- `wizardGameMigration.test.js` - Migration tests
- `realWorldMigration.test.js` - Real-world migration scenarios

### Frontend Tests
Located in `frontend/src/`:
- `shared/utils/__tests__/wizardGameFormatter.test.js` - Game formatting tests

## Test Configuration

### Backend (Jest)
Configuration in `backend/package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch"
  }
}
```

### Frontend
Configuration in `frontend/package.json`:
```json
{
  "scripts": {
    "test": "echo 'No frontend tests configured yet' && exit 0"
  }
}
```

## Environment Variables for Tests

Tests use the following environment variables:
- `NODE_ENV=test` - Set test environment
- `MONGODB_URI` - Test database connection (uses separate test DB)
- `REDIS_URL` - Redis connection for tests
- `JWT_SECRET` - Test JWT secret

## CI/CD Environment

GitHub Actions provides:
- MongoDB 7 service container
- Redis 7 service container
- Node.js 18 runtime
- Isolated test environment

## Troubleshooting

### Tests Fail Locally But Pass in CI
- Check environment variables
- Ensure MongoDB and Redis are running locally
- Verify Node.js version matches CI (18+)

### Tests Fail During Version Update
The version will not be updated if tests fail. Fix the failing tests and run the task again.

## Adding New Tests

### Backend Test Template
```javascript
const request = require('supertest');
const app = require('../server');

describe('Feature Name', () => {
  test('should do something', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .expect(200);
    
    expect(response.body).toHaveProperty('data');
  });
});
```

### Frontend Test Template
```javascript
import { describe, it, expect } from 'vitest';
import { functionToTest } from '../module';

describe('Feature Name', () => {
  it('should do something', () => {
    const result = functionToTest(input);
    expect(result).toBe(expectedOutput);
  });
});
```

## Best Practices

1. **Write tests for new features** before merging to main
2. **Run tests locally** before pushing
3. **Keep tests fast** - mock external services
4. **Use descriptive test names** - explain what's being tested
5. **Test edge cases** - not just happy paths
6. **Update tests** when changing functionality

## Future Improvements

- [ ] Add Vitest configuration for frontend tests
- [ ] Add E2E tests with Playwright
- [ ] Add code coverage reporting
- [ ] Add performance benchmarks
- [ ] Add visual regression testing
