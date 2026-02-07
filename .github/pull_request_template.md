# Pull Request

## Description

Please include a summary of the changes and the related issue. Include relevant motivation and context.

Fixes # (issue)

## Type of Change

Please delete options that are not relevant.

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Code refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Dependency update
- [ ] Configuration change
- [ ] Other (please describe):

## Component(s) Affected

- [ ] Frontend
- [ ] Backend
- [ ] Database/Models
- [ ] API/Routes
- [ ] Authentication
- [ ] Sync Engine
- [ ] Service Worker/PWA
- [ ] Docker/Deployment
- [ ] Documentation
- [ ] Tests

## How Has This Been Tested?

Please describe the tests that you ran to verify your changes. Provide instructions so we can reproduce.

- [ ] Manual testing (please describe scenarios)
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Tested on multiple browsers
- [ ] Tested on mobile devices
- [ ] Tested offline functionality (if applicable)
- [ ] Tested sync functionality (if applicable)

**Test Configuration:**
- Browser(s): [e.g., Chrome 120, Firefox 121]
- OS: [e.g., Windows 11, macOS 14]
- Node version: [e.g., 18.19.0]
- MongoDB version: [e.g., 7.0.4]

## Checklist

### Code Quality

- [ ] My code follows the style guidelines of this project (see docs/DEVELOPMENT.md)
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] My code is modular and follows existing patterns in the codebase
- [ ] I have removed any console.logs or debugging code
- [ ] I have checked for and fixed any linting errors

### Documentation

- [ ] I have made corresponding changes to the documentation
- [ ] I have updated the CHANGELOG.md (if applicable)
- [ ] I have added JSDoc comments to new functions/components
- [ ] I have updated the README.md (if applicable)
- [ ] I have updated API documentation (if API changes were made)

### Testing

- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] I have tested the feature/fix in both online and offline modes (if applicable)
- [ ] I have tested on multiple browsers (Chrome, Firefox, Safari, Edge)
- [ ] I have tested the responsive design on mobile devices

### Dependencies

- [ ] I have not added unnecessary dependencies
- [ ] Any new dependencies are well-maintained and trustworthy
- [ ] I have updated package-lock.json (if dependencies changed)
- [ ] I have documented why new dependencies were needed (in PR description)

### Security

- [ ] I have considered security implications of my changes
- [ ] I have not exposed any sensitive information (API keys, passwords, etc.)
- [ ] I have validated and sanitized all user inputs (if applicable)
- [ ] I have not introduced any SQL injection or XSS vulnerabilities

### Breaking Changes

- [ ] My changes do not break existing functionality
- [ ] If breaking changes exist, I have documented them clearly
- [ ] I have provided migration instructions (if applicable)
- [ ] I have updated the version number appropriately

### Git

- [ ] My commits are atomic and have descriptive commit messages
- [ ] I have rebased my branch on the latest main branch
- [ ] I have resolved all merge conflicts
- [ ] My branch name follows the convention: `feature/`, `bugfix/`, `hotfix/`, or `docs/`

## Screenshots (if applicable)

If your changes include UI modifications, please provide before/after screenshots:

### Before
[Add screenshot]

### After
[Add screenshot]

### Mobile View (if applicable)
[Add screenshot]

## Performance Impact

- [ ] This change improves performance
- [ ] This change has no noticeable performance impact
- [ ] This change may impact performance (please explain):

## Database Changes

If this PR includes database schema changes:

- [ ] I have created a migration script
- [ ] I have documented the migration process
- [ ] I have tested the migration on a copy of production data
- [ ] Backward compatibility is maintained (or breaking change is documented)

## Deployment Notes

Any special deployment considerations or steps:

```
Add deployment steps here if needed
```

## Additional Notes

Add any additional notes, concerns, or questions for reviewers here.

## Related Issues/PRs

List related issues or pull requests:

- Related to #
- Depends on #
- Blocked by #

---

## For Reviewers

- [ ] Code quality and style are acceptable
- [ ] Changes align with project architecture
- [ ] All tests pass
- [ ] Documentation is adequate
- [ ] No security concerns identified
- [ ] Performance impact is acceptable
