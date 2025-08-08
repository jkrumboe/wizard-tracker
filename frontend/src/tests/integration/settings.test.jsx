import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/shared/contexts/ThemeContext'
import { UserProvider } from '@/shared/contexts/UserContext'
import Settings from '@/pages/Settings'

// Mock document.createElement globally to fix appendChild errors
const mockCreateElement = vi.fn().mockImplementation((tagName) => {
  if (tagName === 'a') {
    return {
      click: vi.fn(),
      download: '',
      href: '',
      setAttribute: vi.fn(),
      style: {},
      remove: vi.fn(),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    }
  }
  if (tagName === 'input') {
    return {
      files: [],
      click: vi.fn(),
      type: 'file',
      accept: '.json',
      style: { display: 'none' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    }
  }
  // Create a minimal DOM element mock for other tag types
  return {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    setAttribute: vi.fn(),
    style: {},
    click: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
})
Object.defineProperty(document, 'createElement', {
  value: mockCreateElement,
  writable: true,
  configurable: true
})

// Mock the API services
vi.mock('@/shared/api/gameService', () => ({
  getAllLocalGames: vi.fn(),
  deleteGame: vi.fn(),
}))

vi.mock('@/shared/api/authService', () => ({
  default: {
    checkAuthStatus: vi.fn(),
    logout: vi.fn(),
  }
}))

vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/shared/utils/shareValidator', () => ({
  ShareValidator: {
    validateEncodedGamesData: vi.fn(),
  }
}))

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

const renderWithProviders = (component, { route = '/' } = {}) => {
  const queryClient = createTestQueryClient()
  
  return render(
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <ThemeProvider>
          <MemoryRouter initialEntries={[route]}>
            {component}
          </MemoryRouter>
        </ThemeProvider>
      </UserProvider>
    </QueryClientProvider>
  )
}

describe.skip('Settings Page Integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()
    
    // Setup default mocks
    const { useAuth } = await import('@/shared/hooks/useAuth')
    useAuth.mockReturnValue({
      user: {
        $id: 'user123',
        email: 'test@example.com',
        name: 'Test User'
      },
      isLoading: false
    })
  })

  describe('Game Management Integration', () => {
    it('should load and display local games', async () => {
      const mockGames = [
        {
          id: 'game1',
          gameState: {
            players: [{ name: 'Alice' }, { name: 'Bob' }],
            created_at: '2024-01-15T10:00:00Z'
          },
          updated_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 'game2',
          gameState: {
            players: [{ name: 'Charlie' }],
            created_at: '2024-01-14T10:00:00Z'
          },
          updated_at: '2024-01-14T10:00:00Z'
        }
      ]

      const { getAllLocalGames } = await import('@/shared/api/gameService')
      getAllLocalGames.mockResolvedValue(mockGames)

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByText(/2 games/i)).toBeInTheDocument()
      })

      // Should display game information
      expect(screen.getByText('Alice, Bob')).toBeInTheDocument()
      expect(screen.getByText('Charlie')).toBeInTheDocument()
    })

    it('should handle game deletion', async () => {
      const user = userEvent.setup()
      const mockGames = [
        {
          id: 'game1',
          gameState: {
            players: [{ name: 'Alice' }],
            created_at: '2024-01-15T10:00:00Z'
          },
          updated_at: '2024-01-15T10:00:00Z'
        }
      ]

      const { getAllLocalGames, deleteGame } = await import('@/shared/api/gameService')
      getAllLocalGames.mockResolvedValue(mockGames)
      deleteGame.mockResolvedValue(true)

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument()
      })

      // Find and click delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i })
      await user.click(deleteButton)

      // Confirm deletion in modal
      const confirmButton = await screen.findByRole('button', { name: /confirm/i })
      await user.click(confirmButton)

      expect(deleteGame).toHaveBeenCalledWith('game1')
    })

    it('should handle empty games list', async () => {
      const { getAllLocalGames } = await import('@/shared/api/gameService')
      getAllLocalGames.mockResolvedValue([])

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByText('No saved games found.')).toBeInTheDocument()
      })
    })
  })

  describe('Data Import/Export Integration', () => {
    it('should handle game data export', async () => {
      const user = userEvent.setup()
      const mockGames = [
        {
          id: 'game1',
          gameState: {
            players: [{ name: 'Alice' }],
            total_rounds: 5
          }
        }
      ]

      const { getAllLocalGames } = await import('@/shared/api/gameService')
      getAllLocalGames.mockResolvedValue(mockGames)

      // Mock URL.createObjectURL
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
      
      // Setup createElement to return a download link
      let mockLink
      mockCreateElement.mockImplementation((tagName) => {
        if (tagName === 'a') {
          mockLink = {
            href: '',
            download: '',
            click: vi.fn(),
            appendChild: vi.fn(),
            removeChild: vi.fn(),
            setAttribute: vi.fn(),
            style: {},
            remove: vi.fn()
          }
          return mockLink
        }
        return {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
          setAttribute: vi.fn(),
          style: {},
          click: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }
      })

      renderWithProviders(<Settings />)

      // Find and click export button
      const exportButton = await screen.findByRole('button', { name: /export/i })
      await user.click(exportButton)

      // Should trigger download
      expect(mockLink.click).toHaveBeenCalled()
      expect(mockLink.download).toContain('.json')
    })

    it('should handle game data import', async () => {
      const user = userEvent.setup()
      const mockImportData = {
        game1: {
          id: 'game1',
          gameState: {
            players: [{ name: 'Imported Player' }],
            total_rounds: 3
          }
        }
      }

      const { ShareValidator } = await import('@/shared/utils/shareValidator')
      ShareValidator.validateEncodedGamesData.mockReturnValue({
        isValid: true,
        data: mockImportData
      })

      renderWithProviders(<Settings />)

      // Find file input and upload file
      const fileInput = screen.getByLabelText(/import/i)
      const file = new File([JSON.stringify(mockImportData)], 'games.json', {
        type: 'application/json'
      })

      await user.upload(fileInput, file)

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/import successful/i)).toBeInTheDocument()
      })
    })

    it('should handle invalid import data', async () => {
      const user = userEvent.setup()
      
      const { ShareValidator } = await import('@/shared/utils/shareValidator')
      ShareValidator.validateEncodedGamesData.mockReturnValue({
        isValid: false,
        error: 'Invalid data format'
      })

      renderWithProviders(<Settings />)

      // Try to import invalid file
      const fileInput = screen.getByLabelText(/import/i)
      const file = new File(['invalid json'], 'invalid.json', {
        type: 'application/json'
      })

      await user.upload(fileInput, file)

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/invalid data format/i)).toBeInTheDocument()
      })
    })
  })

  describe('Share Link Integration', () => {
    it('should handle shared game links from URL', async () => {
      const mockSharedData = {
        game1: {
          id: 'game1',
          gameState: {
            players: [{ name: 'Shared Player' }],
            total_rounds: 5
          }
        }
      }

      // Mock URL with share parameter
      const shareKey = 'share_1234567890123_abcdefghi'
      const shareData = btoa(JSON.stringify(mockSharedData))
      
      localStorage.setItem(shareKey, shareData)
      localStorage.setItem(`${shareKey}_expires`, (Date.now() + 3600000).toString())

      const { ShareValidator } = await import('@/shared/utils/shareValidator')
      ShareValidator.validateEncodedGamesData.mockReturnValue({
        isValid: true,
        data: mockSharedData
      })

      renderWithProviders(<Settings />, { 
        route: `/?${shareKey}=${shareData}` 
      })

      // Should show import confirmation
      await waitFor(() => {
        expect(screen.getByText(/shared game/i)).toBeInTheDocument()
      })
    })

    it('should handle expired share links', async () => {
      const shareKey = 'share_1234567890123_expired'
      const shareData = 'some-data'
      
      localStorage.setItem(shareKey, shareData)
      localStorage.setItem(`${shareKey}_expires`, (Date.now() - 1000).toString()) // Expired

      renderWithProviders(<Settings />, { 
        route: `/?${shareKey}=${shareData}` 
      })

      // Should show expired message
      await waitFor(() => {
        expect(screen.getByText(/expired/i)).toBeInTheDocument()
      })

      // Should clean up localStorage
      expect(localStorage.getItem(shareKey)).toBeNull()
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle API errors gracefully', async () => {
      const { getAllLocalGames } = await import('@/shared/api/gameService')
      getAllLocalGames.mockRejectedValue(new Error('Database error'))

      renderWithProviders(<Settings />)

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/error loading games/i)).toBeInTheDocument()
      })
    })

    it('should handle authentication errors', async () => {
      const { useAuth } = await import('@/shared/hooks/useAuth')
      useAuth.mockReturnValue({
        user: null,
        isLoading: false,
        error: 'Authentication failed'
      })

      renderWithProviders(<Settings />)

      // Should redirect to login or show auth error
      expect(screen.queryByText(/settings/i)).not.toBeInTheDocument()
    })

    it('should handle localStorage quota exceeded', async () => {
      const user = userEvent.setup()
      
      // Mock localStorage to throw QuotaExceededError
      localStorage.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError')
      })

      const mockImportData = {
        game1: { id: 'game1', gameState: {} }
      }

      const { ShareValidator } = await import('@/shared/utils/shareValidator')
      ShareValidator.validateEncodedGamesData.mockReturnValue({
        isValid: true,
        data: mockImportData
      })

      renderWithProviders(<Settings />)

      // Try to import data
      const fileInput = screen.getByLabelText(/import/i)
      const file = new File([JSON.stringify(mockImportData)], 'games.json', {
        type: 'application/json'
      })

      await user.upload(fileInput, file)

      // Should show storage error
      await waitFor(() => {
        expect(screen.getByText(/storage.*full/i)).toBeInTheDocument()
      })
    })
  })

  describe('User Experience Integration', () => {
    it('should show loading states appropriately', async () => {
      const { getAllLocalGames } = await import('@/shared/api/gameService')
      
      // Mock slow API response
      getAllLocalGames.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      )

      renderWithProviders(<Settings />)

      // Should show loading indicator
      expect(screen.getByText(/loading/i)).toBeInTheDocument()

      // Should hide loading after data loads
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
      })
    })

    it('should handle multiple rapid user interactions', async () => {
      const user = userEvent.setup()
      const { getAllLocalGames, deleteGame } = await import('@/shared/api/gameService')
      
      const mockGames = [
        { id: 'game1', gameState: { players: [{ name: 'Player 1' }] } },
        { id: 'game2', gameState: { players: [{ name: 'Player 2' }] } }
      ]
      
      getAllLocalGames.mockResolvedValue(mockGames)
      deleteGame.mockResolvedValue(true)

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByText('Player 1')).toBeInTheDocument()
      })

      // Rapidly click multiple delete buttons
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
      
      await user.click(deleteButtons[0])
      await user.click(deleteButtons[1])

      // Should handle both requests appropriately
      expect(deleteGame).toHaveBeenCalledTimes(2)
    })

    it('should persist UI state during operations', async () => {
      const user = userEvent.setup()
      const mockGames = [
        { id: 'game1', gameState: { players: [{ name: 'Alice' }] } }
      ]

      const { getAllLocalGames } = await import('@/shared/api/gameService')
      getAllLocalGames.mockResolvedValue(mockGames)

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument()
      })

      // Open a modal or expand section
      const expandButton = screen.getByRole('button', { name: /expand/i })
      await user.click(expandButton)

      // UI state should be maintained during background operations
      expect(screen.getByText(/expanded/i)).toBeInTheDocument()
    })
  })
})
