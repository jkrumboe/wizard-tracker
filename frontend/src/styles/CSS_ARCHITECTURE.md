# CSS Architecture Guide

## Overview
This document outlines the CSS architecture for the Wizard Tracker application to maintain consistency and prevent style conflicts.

## File Structure

```
styles/
├── base/
│   ├── index.css          # Global resets, variables, base elements
│   └── theme.css          # Theme-specific variables
├── components/
│   ├── modal.css          # All modal-related styles
│   ├── components.css     # Shared component styles
│   └── [feature].css      # Feature-specific component styles
├── pages/
│   └── [page].css         # Page-specific styles
├── utils/
│   └── [utility].css      # Utility classes and helpers
└── devices/
    └── tablet.css         # Device-specific overrides
```

## Style Loading Order

Styles are loaded in this order in `main.jsx`:
1. `base/index.css` - Foundation
2. `components/components.css` - Component base styles
3. Feature-specific CSS files as needed

## Key Principles

### 1. Avoid !important
- **Never use** `!important` unless absolutely necessary (e.g., utility classes)
- If you need `!important`, your selector specificity is wrong
- Fix: Use more specific selectors or restructure your CSS

### 2. Specificity Hierarchy
Use this order of specificity (lowest to highest):
- Element selectors: `button`, `input`
- Class selectors: `.btn`, `.modal-content`
- Combined classes: `.btn.btn-primary`
- Descendant selectors: `.modal-content .btn`
- Child selectors: `.modal-content > .btn`

**Avoid:**
- IDs in CSS (`#element`)
- Overly specific selectors (`.page .container .card .button`)
- Theme-specific overrides when CSS variables work better

### 3. CSS Variables First
Always prefer CSS variables over hard-coded values:

```css
/* Good */
.button {
  background-color: var(--primary-color);
  padding: var(--spacing-md);
}

/* Bad */
.button {
  background-color: #a4c7ff;
  padding: 1rem;
}
```

### 4. Component Isolation
Each component should have:
- A unique class name (`.game-settings-modal`, not just `.modal`)
- Scoped styles that don't leak
- Clear naming that reflects purpose

### 5. No Duplicate Definitions
Check before adding styles:
```bash
# Search for existing definitions
grep -r "\.btn-primary" frontend/src/styles/
```

## Common Patterns

### Buttons
All button styles are in `base/index.css`:
- Base: `.btn`
- Variants: `.btn-primary`, `.btn-secondary`, `.btn-accent`, `.btn-success`, `.btn-error`

```jsx
// Usage
<button className="btn btn-primary">Save</button>
<button className="btn btn-secondary">Cancel</button>
```

### Modals
All modal styles are in `components/modal.css`:
- Container: `.modal-overlay` > `.modal-container`
- Structure: `.modal-header`, `.modal-content`, `.modal-footer`
- Specific modals: `.game-settings-modal`, `.filter-modal`, etc.

```jsx
// Usage
<div className="modal-overlay">
  <div className="modal-content game-settings-modal">
    <div className="modal-header">...</div>
    <div className="modal-body">...</div>
    <div className="modal-footer">...</div>
  </div>
</div>
```

### Cards
Card styles use CSS variables from `base/index.css`:
```css
.card {
  background-color: var(--card-background);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
}
```

## Theme Support

### Dark Mode
Themes are handled via CSS variables in `base/index.css`:
- Light theme: `:root { ... }`
- Dark theme: `[data-theme="dark"] { ... }`

**Do NOT use** `html:not([data-theme="dark"])` selectors unless absolutely necessary. CSS variables handle most theming.

### Adding Theme Variables
1. Define in both light and dark theme sections
2. Use semantic names: `--card-background`, not `--white`
3. Document the purpose in a comment

```css
:root {
  --card-background: #ffffff;
  --text-color: #111827;
}

[data-theme="dark"] {
  --card-background: #1e293b;
  --text-color: #f9fafb;
}
```

## Maintenance Guidelines

### Before Adding Styles
1. ✅ Check if a CSS variable exists
2. ✅ Search for existing similar styles
3. ✅ Consider if it belongs in base, component, or page styles
4. ✅ Use the lowest specificity that works

### When Modifying Styles
1. ✅ Search for all usages of the class
2. ✅ Test in both light and dark themes
3. ✅ Check mobile and tablet views
4. ✅ Remove any old commented code

### Red Flags
- ❌ Adding `!important`
- ❌ Creating duplicate class definitions
- ❌ Using hard-coded colors/spacing
- ❌ Overly specific selectors (3+ levels deep)
- ❌ Leaving commented-out code

## Common Issues & Solutions

### Issue: Styles Not Applying
**Problem:** Button doesn't get primary color
```css
/* Wrong - conflicting specificity */
.modal .btn { background: gray; }
.btn-primary { background: blue; }
```

**Solution:** Increase specificity correctly
```css
.modal .btn { background: var(--card-background); }
.modal .btn.btn-primary { background: var(--primary-color); }
```

### Issue: Theme Styles Not Working
**Problem:** Light theme override not working
```css
/* Wrong - fighting with CSS variables */
html:not([data-theme="dark"]) .button {
  background: white;
}
```

**Solution:** Use CSS variables
```css
/* In :root and [data-theme="dark"] */
--button-background: #ffffff; /* light */
--button-background: #1e293b; /* dark */

/* In component */
.button {
  background: var(--button-background);
}
```

### Issue: Need to Override
**Problem:** Modal content has wrong padding
```css
/* Wrong */
.modal-content { padding: 1rem !important; }
```

**Solution:** Use more specific selector
```css
.game-settings-modal .modal-content {
  padding: 1rem;
}
```

## Testing Checklist
When making CSS changes, verify:
- [ ] Light theme looks correct
- [ ] Dark theme looks correct
- [ ] Mobile view (< 768px)
- [ ] Tablet view (768px - 1024px)
- [ ] Desktop view (> 1024px)
- [ ] No console errors
- [ ] No visual regressions in other components

## Resources
- [CSS Specificity Calculator](https://specificity.keegan.st/)
- [BEM Naming Convention](https://getbem.com/)
- [CSS Variables MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
