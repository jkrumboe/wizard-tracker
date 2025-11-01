# Player Name Autocomplete Feature

## Overview
This feature provides intelligent player name suggestions based on previously used player names stored in local storage. When typing a player name, users will see autocomplete suggestions from their game history.

## Components Added

### 1. `PlayerNameInput.jsx`
A reusable autocomplete input component that provides player name suggestions.

**Location:** `frontend/src/components/ui/PlayerNameInput.jsx`

**Features:**
- Real-time autocomplete suggestions as you type
- Keyboard navigation (Arrow Up/Down, Enter, Escape)
- Mouse/touch support for selecting suggestions
- Automatically filters suggestions based on input
- Prioritizes suggestions that start with the typed text
- Maximum 5 suggestions shown at a time

**Props:**
- `value` (string): Current input value
- `onChange` (function): Change handler
- `placeholder` (string): Input placeholder text
- `className` (string): Additional CSS classes
- `...inputProps`: Any other standard input props

**Usage:**
```jsx
import PlayerNameInput from '@/components/ui/PlayerNameInput';

<PlayerNameInput
  value={playerName}
  onChange={(e) => setPlayerName(e.target.value)}
  placeholder="Enter player name"
  className="my-custom-class"
/>
```

### 2. `playerSuggestions.js`
Utility functions for extracting and filtering player names from local storage.

**Location:** `frontend/src/shared/utils/playerSuggestions.js`

**Functions:**

#### `getPlayerSuggestions()`
Extracts all unique player names from saved games in local storage.
- Searches both regular games and table games
- Returns alphabetically sorted array of unique names (case-insensitive sort)
- Handles multiple data formats and edge cases

```javascript
import { getPlayerSuggestions } from '@/shared/utils/playerSuggestions';

const allPlayerNames = getPlayerSuggestions();
// Returns: ['Alice', 'Bob', 'Charlie', ...]
```

#### `filterPlayerSuggestions(input, allSuggestions, maxResults = 5)`
Filters player suggestions based on input text.
- Case-insensitive matching
- Prioritizes names that start with the search term
- Returns up to `maxResults` suggestions (default: 5)

```javascript
import { filterPlayerSuggestions } from '@/shared/utils/playerSuggestions';

const filtered = filterPlayerSuggestions('ali', allPlayerNames, 5);
// Returns: ['Alice', 'Alicia', 'Alison', ...]
```

### 3. CSS Styling
**Location:** `frontend/src/styles/components/PlayerNameInput.css`

- Dropdown suggestions list with smooth animations
- Hover and keyboard navigation highlighting
- Dark/light mode support
- Custom scrollbar styling
- Mobile-responsive design

## Integration Points

The `PlayerNameInput` component has been integrated into the following pages:

### 1. New Game Page (`NewGame.jsx`)
- Player name inputs in the sortable player list
- Suggests names from all previous games
- Helps quickly add familiar players

### 2. Game Filter Modal (`GameFilterModal.jsx`)
- Player name filter input
- Helps filter games by player names from history
- Makes it easy to find games with specific players

### 3. Table Game Page (`TableGame.jsx`)
- Player name inputs in the table header
- Suggests names from both regular and table games
- Streamlines setting up table games with known players

## How It Works

1. **Data Collection:**
   - Scans `LocalGameStorage` for all saved games
   - Scans `LocalTableGameStorage` for all table games
   - Extracts player names from various data structures

2. **Suggestion Generation:**
   - Creates a unique set of all player names
   - Sorts alphabetically (case-insensitive)
   - Stores in component state

3. **User Interaction:**
   - User types in the input field
   - Component filters suggestions in real-time
   - Shows up to 5 most relevant matches
   - User can click or use keyboard to select

4. **Selection:**
   - Clicking a suggestion fills the input
   - Arrow keys navigate suggestions
   - Enter key selects highlighted suggestion
   - Escape key closes suggestions

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Requires localStorage support (standard in all modern browsers)

## Privacy & Data

- All data stored locally in the browser
- No network requests for suggestions
- Player names are never sent to a server
- Data persists across sessions via localStorage

## Performance Considerations

- Suggestions are computed on demand
- Filtering is performed client-side with minimal overhead
- Maximum 5 suggestions shown to keep UI responsive
- Debouncing not required due to efficient filtering algorithm

## Future Enhancements

Potential improvements for future versions:

1. **Frequency Ranking:** Suggest more frequently used names first
2. **Recent Players:** Prioritize recently used player names
3. **Custom Suggestions:** Allow users to add favorite names
4. **Suggestion Caching:** Cache suggestions for better performance
5. **Multi-select:** Support adding multiple players at once
6. **Name Aliases:** Support nicknames and aliases
7. **Import from Contacts:** Integration with device contacts (PWA feature)

## Testing

To test the feature:

1. Play some games with different player names
2. Create a new game
3. Start typing a player name you've used before
4. Verify suggestions appear as you type
5. Test keyboard navigation and mouse selection
6. Verify suggestions work in filter modal and table games

## Troubleshooting

**No suggestions appearing:**
- Ensure you have played games before
- Check browser console for errors
- Verify localStorage is not disabled
- Try clearing and re-entering data

**Suggestions not filtering correctly:**
- Check that input value is being passed correctly
- Verify the onChange handler is working
- Check browser console for JavaScript errors

**Styling issues:**
- Ensure CSS file is imported
- Check for CSS conflicts with existing styles
- Verify z-index settings if dropdown is hidden
