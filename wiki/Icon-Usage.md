# Icon Usage Guide

This project uses [Lucide React](https://lucide.dev/) as the icon framework. Lucide is a beautiful, customizable icon library with over 1,000+ icons.

## Basic Usage

### Import the Icon component

```jsx
import Icon from '../components/Icon';
// or import specific icons
import { UserIcon, SettingsIcon, HomeIcon } from '../components/Icon';
```

### Using the generic Icon component

```jsx
// Basic usage
<Icon name="User" />

// With custom size and color
<Icon name="Settings" size={32} color="#ff0000" />

// With CSS classes
<Icon name="Home" className="my-custom-class" />
```

### Using pre-exported icon components

```jsx
// These are ready-to-use components
<UserIcon />
<SettingsIcon size={24} />
<HomeIcon color="blue" />
```

## Available Pre-exported Icons

The following icons are already exported from the Icon component for convenience:

- `UserIcon` - User profile
- `SettingsIcon` - Settings/configuration
- `HomeIcon` - Home/dashboard
- `PlusIcon` - Add/create new
- `EditIcon` - Edit/modify
- `TrashIcon` - Delete/remove
- `SearchIcon` - Search functionality
- `MenuIcon` - Menu/hamburger
- `XIcon` - Close/cancel
- `ChevronDownIcon` - Dropdown/expand
- `ChevronUpIcon` - Collapse
- `LogOutIcon` - Logout/sign out
- `EyeIcon` - Show/visible
- `EyeOffIcon` - Hide/invisible
- `GamepadIcon` - Gaming/games
- `TrophyIcon` - Awards/achievements
- `BarChartIcon` - Statistics/charts
- `UsersIcon` - Multiple users/team
- `CalendarIcon` - Dates/scheduling
- `ClockIcon` - Time
- `StarIcon` - Favorites/rating
- `FilterIcon` - Filter/sort
- `RefreshIcon` - Refresh/reload
- `ArrowLeftIcon` - Navigate back
- `ArrowRightIcon` - Navigate forward

## Finding More Icons

You can find all available icons at: https://lucide.dev/icons/

To use any icon from Lucide:

1. Find the icon name on the website (e.g., "Calendar")
2. Use it with the Icon component: `<Icon name="Calendar" />`

## Adding New Pre-exported Icons

To add a new commonly used icon to the pre-exported list:

1. Open `src/components/Icon.jsx`
2. Add a new export at the bottom:
   ```jsx
   export const NewIconName = (props) => <Icon name="LucideIconName" {...props} />;
   ```

## Props

All icon components accept these props:

- `size` (number): Size in pixels (default: 24)
- `color` (string): Color value (default: 'currentColor')
- `className` (string): Additional CSS classes
- Any other props are passed through to the underlying SVG element

## Examples in the Project

See these files for examples of icon usage:

- `src/pages/AdminDashboard.jsx` - Icons in admin interface
- `src/components/Navbar.jsx` - Navigation icons
- `src/styles/admin.css` - Icon styling examples
