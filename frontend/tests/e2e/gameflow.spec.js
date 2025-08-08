import { test, expect } from '@playwright/test'

test.describe('Game Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    
    // Wait for app to load
    await expect(page.getByRole('heading', { name: /wizard tracker/i })).toBeVisible()
  })

  test('should create a new game successfully', async ({ page }) => {
    // Navigate to new game
    await page.getByRole('button', { name: /new game/i }).click()
    
    // Wait for new game page to load
    await expect(page.getByRole('heading', { name: /create new game/i })).toBeVisible()
    
    // Add players
    await page.getByPlaceholder(/player name/i).fill('Alice')
    await page.getByRole('button', { name: /add player/i }).click()
    
    await page.getByPlaceholder(/player name/i).fill('Bob')
    await page.getByRole('button', { name: /add player/i }).click()
    
    // Verify players are added
    await expect(page.getByText('Alice')).toBeVisible()
    await expect(page.getByText('Bob')).toBeVisible()
    
    // Set game options
    await page.getByLabel(/total rounds/i).fill('10')
    
    // Start game
    await page.getByRole('button', { name: /start game/i }).click()
    
    // Verify game started
    await expect(page.getByText(/round 1/i)).toBeVisible()
    await expect(page.getByText('Alice')).toBeVisible()
    await expect(page.getByText('Bob')).toBeVisible()
    
    // Verify URL changed to game page
    await expect(page).toHaveURL(/\/game\//)
  })

  test('should validate minimum players', async ({ page }) => {
    await page.getByRole('button', { name: /new game/i }).click()
    
    // Try to start game without players
    await page.getByRole('button', { name: /start game/i }).click()
    
    // Should show validation error
    await expect(page.getByText(/at least.*players/i)).toBeVisible()
  })

  test('should handle player avatar selection', async ({ page }) => {
    await page.getByRole('button', { name: /new game/i }).click()
    
    // Add player
    await page.getByPlaceholder(/player name/i).fill('Alice')
    await page.getByRole('button', { name: /add player/i }).click()
    
    // Select avatar
    await page.getByText('Alice').click()
    await page.getByRole('button', { name: /avatar/i }).first().click()
    
    // Verify avatar selected
    await expect(page.locator('[data-testid="player-avatar"]')).toBeVisible()
  })

  test('should save game to local storage', async ({ page }) => {
    await page.getByRole('button', { name: /new game/i }).click()
    
    // Create game
    await page.getByPlaceholder(/player name/i).fill('Alice')
    await page.getByRole('button', { name: /add player/i }).click()
    await page.getByPlaceholder(/player name/i).fill('Bob')
    await page.getByRole('button', { name: /add player/i }).click()
    
    await page.getByRole('button', { name: /start game/i }).click()
    
    // Wait for game to load
    await expect(page.getByText(/round 1/i)).toBeVisible()
    
    // Check local storage
    const gameData = await page.evaluate(() => {
      const games = localStorage.getItem('wizard_tracker_games')
      return games ? JSON.parse(games) : null
    })
    
    expect(gameData).toBeTruthy()
    expect(Object.keys(gameData)).toHaveLength(1)
  })
})

test.describe('Game Gameplay Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    
    // Create a game for testing
    await page.getByRole('button', { name: /new game/i }).click()
    await page.getByPlaceholder(/player name/i).fill('Alice')
    await page.getByRole('button', { name: /add player/i }).click()
    await page.getByPlaceholder(/player name/i).fill('Bob')
    await page.getByRole('button', { name: /add player/i }).click()
    await page.getByLabel(/total rounds/i).fill('3')
    await page.getByRole('button', { name: /start game/i }).click()
    
    await expect(page.getByText(/round 1/i)).toBeVisible()
  })

  test('should handle bid phase correctly', async ({ page }) => {
    // Round 1: Each player gets 1 card
    await expect(page.getByText(/round 1/i)).toBeVisible()
    
    // Enter bids for each player
    const aliceBidInput = page.getByTestId('bid-alice').or(page.locator('input[placeholder*="Alice"]').first())
    const bobBidInput = page.getByTestId('bid-bob').or(page.locator('input[placeholder*="Bob"]').first())
    
    await aliceBidInput.fill('1')
    await bobBidInput.fill('0')
    
    // Submit bids
    await page.getByRole('button', { name: /submit bids/i }).click()
    
    // Should move to tricks phase
    await expect(page.getByText(/tricks/i)).toBeVisible()
  })

  test('should handle tricks phase correctly', async ({ page }) => {
    // Complete bid phase first
    await page.locator('input[placeholder*="Alice"]').first().fill('1')
    await page.locator('input[placeholder*="Bob"]').first().fill('0')
    await page.getByRole('button', { name: /submit bids/i }).click()
    
    // Enter tricks for each player
    const aliceTricksInput = page.getByTestId('tricks-alice').or(page.locator('input[placeholder*="Alice"]').last())
    const bobTricksInput = page.getByTestId('tricks-bob').or(page.locator('input[placeholder*="Bob"]').last())
    
    await aliceTricksInput.fill('1')
    await bobTricksInput.fill('0')
    
    // Submit tricks
    await page.getByRole('button', { name: /submit tricks/i }).click()
    
    // Should calculate scores and move to next round
    await expect(page.getByText(/round 2/i)).toBeVisible()
  })

  test('should calculate scores correctly', async ({ page }) => {
    // Complete round 1
    await page.locator('input[placeholder*="Alice"]').first().fill('1')
    await page.locator('input[placeholder*="Bob"]').first().fill('0')
    await page.getByRole('button', { name: /submit bids/i }).click()
    
    await page.locator('input[placeholder*="Alice"]').last().fill('1') // Alice bids 1, gets 1 = 20 + 10 = 30
    await page.locator('input[placeholder*="Bob"]').last().fill('0') // Bob bids 0, gets 0 = 20 + 0 = 20
    await page.getByRole('button', { name: /submit tricks/i }).click()
    
    // Check scores are displayed
    await expect(page.getByText(/30/)).toBeVisible() // Alice's score
    await expect(page.getByText(/20/)).toBeVisible() // Bob's score
  })

  test('should complete full game', async ({ page }) => {
    // Play through all 3 rounds
    for (let round = 1; round <= 3; round++) {
      await expect(page.getByText(new RegExp(`round ${round}`, 'i'))).toBeVisible()
      
      // Submit bids
      await page.locator('input[placeholder*="Alice"]').first().fill('1')
      await page.locator('input[placeholder*="Bob"]').first().fill('0')
      await page.getByRole('button', { name: /submit bids/i }).click()
      
      // Submit tricks
      await page.locator('input[placeholder*="Alice"]').last().fill('1')
      await page.locator('input[placeholder*="Bob"]').last().fill('0')
      await page.getByRole('button', { name: /submit tricks/i }).click()
    }
    
    // Should show game completed
    await expect(page.getByText(/game completed/i)).toBeVisible()
    await expect(page.getByText(/winner/i)).toBeVisible()
  })

  test('should handle game pause and resume', async ({ page }) => {
    // Pause game
    await page.getByRole('button', { name: /menu/i }).click()
    await page.getByRole('button', { name: /pause/i }).click()
    
    // Confirm pause
    await page.getByRole('button', { name: /confirm/i }).click()
    
    // Should return to home
    await expect(page.getByRole('heading', { name: /wizard tracker/i })).toBeVisible()
    
    // Resume game
    await page.getByRole('button', { name: /load game/i }).click()
    await page.getByText(/alice.*bob/i).click()
    await page.getByRole('button', { name: /resume/i }).click()
    
    // Should be back in game
    await expect(page.getByText(/round 1/i)).toBeVisible()
  })
})

test.describe('Responsive Design', () => {
  test('should work on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE
    await page.goto('/')
    
    // Should display mobile-friendly layout
    await expect(page.getByRole('heading', { name: /wizard tracker/i })).toBeVisible()
    
    // Navigation should work
    await page.getByRole('button', { name: /new game/i }).click()
    await expect(page.getByRole('heading', { name: /create new game/i })).toBeVisible()
    
    // Form should be usable
    await page.getByPlaceholder(/player name/i).fill('Test Player')
    await page.getByRole('button', { name: /add player/i }).click()
    await expect(page.getByText('Test Player')).toBeVisible()
  })

  test('should work on tablet devices', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }) // iPad
    await page.goto('/')
    
    // Create and start a game
    await page.getByRole('button', { name: /new game/i }).click()
    await page.getByPlaceholder(/player name/i).fill('Alice')
    await page.getByRole('button', { name: /add player/i }).click()
    await page.getByPlaceholder(/player name/i).fill('Bob')
    await page.getByRole('button', { name: /add player/i }).click()
    await page.getByRole('button', { name: /start game/i }).click()
    
    // Game interface should be usable
    await expect(page.getByText(/round 1/i)).toBeVisible()
    await expect(page.getByText('Alice')).toBeVisible()
    await expect(page.getByText('Bob')).toBeVisible()
  })
})

test.describe('Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/')
    
    // Test keyboard navigation
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    
    // Should navigate to new game
    await expect(page.getByRole('heading', { name: /create new game/i })).toBeVisible()
    
    // Form should be keyboard accessible
    await page.keyboard.press('Tab')
    await page.keyboard.type('Alice')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    
    await expect(page.getByText('Alice')).toBeVisible()
  })

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/')
    
    // Check for essential ARIA labels
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('navigation')).toBeVisible()
    
    // Navigate to game creation
    await page.getByRole('button', { name: /new game/i }).click()
    
    // Form should have proper labels
    await expect(page.getByLabelText(/player name/i)).toBeVisible()
    await expect(page.getByLabelText(/total rounds/i)).toBeVisible()
  })

  test('should work with screen readers', async ({ page }) => {
    await page.goto('/')
    
    // Check for semantic HTML structure
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('main')).toHaveCount(1)
    
    // Forms should have proper structure
    await page.getByRole('button', { name: /new game/i }).click()
    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('label')).toHaveCount.greaterThan(0)
  })
})

test.describe('Performance', () => {
  test('should load quickly', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /wizard tracker/i })).toBeVisible()
    
    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(3000) // Should load in under 3 seconds
  })

  test('should handle large games efficiently', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /new game/i }).click()
    
    // Add many players
    for (let i = 1; i <= 10; i++) {
      await page.getByPlaceholder(/player name/i).fill(`Player ${i}`)
      await page.getByRole('button', { name: /add player/i }).click()
    }
    
    // Set high round count
    await page.getByLabel(/total rounds/i).fill('20')
    
    const startTime = Date.now()
    await page.getByRole('button', { name: /start game/i }).click()
    
    // Should still load quickly
    await expect(page.getByText(/round 1/i)).toBeVisible()
    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(2000)
  })
})
