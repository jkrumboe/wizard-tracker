# Contributing to KeepWiz

First off, thank you for considering contributing to KeepWiz! It's people like you that make KeepWiz such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct. Please report unacceptable behavior.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report. Following these guidelines helps maintainers understand your report and reproduce the issue.

Before creating bug reports, please:
- Check the issue tracker to see if the problem has already been reported.
- If you're unable to find an open issue addressing the problem, open a new one.

**How to Submit A Good Bug Report:**

- Use a clear and descriptive title
- Describe the exact steps which reproduce the problem
- Provide specific examples to demonstrate the steps
- Describe the behavior you observed after following the steps
- Explain which behavior you expected to see instead
- Include screenshots if applicable

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion, including completely new features and minor improvements to existing functionality.

**How to Submit A Good Enhancement Suggestion:**

- Use a clear and descriptive title
- Provide a step-by-step description of the suggested enhancement
- Provide specific examples to demonstrate the enhancement
- Describe the current behavior and explain which behavior you expected to see instead
- Explain why this enhancement would be useful

### Pull Requests

- Fill in the required template
- Do not include issue numbers in the PR title
- Include screenshots and GIFs in your pull request whenever possible
- Follow the JavaScript style guide
- Include unit tests when possible
- Document new code based on the project documentation style
- End all files with a newline

## Development Environment Setup

### Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose (if using the containerized setup)
- PostgreSQL (if running locally without Docker)

### Setup Steps

1. Fork the repository
2. Clone your fork locally
   ```bash
   git clone https://github.com/jkrumboe/wizard-tracker.git
   cd wizard-tracker
   ```

3. Install dependencies
   ```bash
   # For backend
   cd backend
   npm install
   
   # For frontend
   cd ../frontend
   npm install
   ```

4. Set up environment variables
   - Copy `frontend/env-config.js.template` to `frontend/env-config.js`
   - Update the values with your Appwrite endpoint and project ID

5. Start the development servers
   ```bash
   # Option 1: Using Docker Compose
   docker compose up
   
   # Option 2: Running locally
   # Terminal 1: Start the backend
   cd backend
   npm start
   
   # Terminal 2: Start the frontend
   cd frontend
   npm run dev
   ```

## Coding Standards

- Use ESLint with the provided configuration
- Follow the naming conventions used throughout the project
- Write meaningful commit messages
- Keep code modular and well-organized

## Testing

- Write tests for new features
- Make sure existing tests pass before submitting a PR
- Test your changes across different browsers and devices when applicable

## Documentation

- Update the documentation when necessary
- Include JSDoc comments for new functions and classes
- Update the wiki with any significant changes to the architecture or API

## Questions?

If you have any questions, please feel free to contact the project maintainer.
