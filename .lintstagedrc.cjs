// lint-staged config
// Using a function so the staged file paths are NOT appended to the command,
// allowing the full project lint to run and catch cross-file issues.
module.exports = {
  'frontend/src/**/*.{js,jsx}': () => 'npm run lint:frontend',
};
