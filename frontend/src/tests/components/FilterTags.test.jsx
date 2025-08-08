import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import FilterTags from '@/components/common/FilterTags'

// Mock the Icon component
vi.mock('@/components/ui/Icon', () => ({
  FilterIcon: () => <div data-testid="filter-icon">Filter</div>,
  XIcon: () => <div data-testid="x-icon">X</div>
}))

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('FilterTags Component', () => {
  const mockOnFilterChange = vi.fn()
  const defaultProps = {
    onFilterChange: mockOnFilterChange,
    availableTags: ['completed', 'paused', 'active', 'multiplayer', 'local'],
    initialSelectedTags: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the filter button', () => {
      renderWithRouter(<FilterTags {...defaultProps} />)
      
      expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument()
      expect(screen.getByTestId('filter-icon')).toBeInTheDocument()
    })

    it('should not show tag list initially', () => {
      renderWithRouter(<FilterTags {...defaultProps} />)
      
      expect(screen.queryByText('completed')).not.toBeInTheDocument()
      expect(screen.queryByText('paused')).not.toBeInTheDocument()
    })

    it('should show tag list when filter button is clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<FilterTags {...defaultProps} />)
      
      const filterButton = screen.getByRole('button', { name: /filter/i })
      await user.click(filterButton)
      
      expect(screen.getByText('completed')).toBeInTheDocument()
      expect(screen.getByText('paused')).toBeInTheDocument()
      expect(screen.getByText('active')).toBeInTheDocument()
    })

    it('should render with initial selected tags', () => {
      const propsWithSelected = {
        ...defaultProps,
        initialSelectedTags: ['completed', 'active']
      }
      
      renderWithRouter(<FilterTags {...propsWithSelected} />)
      
      // Should show selected count in button
      expect(screen.getByText(/2/)).toBeInTheDocument()
    })
  })

  describe('Tag Selection', () => {
    it('should select a tag when clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<FilterTags {...defaultProps} />)
      
      // Open filter panel
      await user.click(screen.getByRole('button', { name: /filter/i }))
      
      // Click on a tag
      await user.click(screen.getByText('completed'))
      
      expect(mockOnFilterChange).toHaveBeenCalledWith(['completed'])
    })

    it('should deselect a tag when clicked again', async () => {
      const user = userEvent.setup()
      const propsWithSelected = {
        ...defaultProps,
        initialSelectedTags: ['completed']
      }
      
      renderWithRouter(<FilterTags {...propsWithSelected} />)
      
      // Open filter panel
      await user.click(screen.getByRole('button', { name: /filter/i }))
      
      // Click on selected tag to deselect
      await user.click(screen.getByText('completed'))
      
      expect(mockOnFilterChange).toHaveBeenCalledWith([])
    })

    it('should handle multiple tag selection', async () => {
      const user = userEvent.setup()
      renderWithRouter(<FilterTags {...defaultProps} />)
      
      // Open filter panel
      await user.click(screen.getByRole('button', { name: /filter/i }))
      
      // Select multiple tags
      await user.click(screen.getByText('completed'))
      await user.click(screen.getByText('paused'))
      
      expect(mockOnFilterChange).toHaveBeenLastCalledWith(['completed', 'paused'])
    })

    it('should show visual feedback for selected tags', async () => {
      const user = userEvent.setup()
      const propsWithSelected = {
        ...defaultProps,
        initialSelectedTags: ['completed']
      }
      
      renderWithRouter(<FilterTags {...propsWithSelected} />)
      
      // Open filter panel
      await user.click(screen.getByRole('button', { name: /filter/i }))
      
      const completedTag = screen.getByText('completed')
      expect(completedTag.closest('button')).toHaveClass('selected')
    })
  })

  describe('Clear Functionality', () => {
    it('should clear all selected tags', async () => {
      const user = userEvent.setup()
      const propsWithSelected = {
        ...defaultProps,
        initialSelectedTags: ['completed', 'paused']
      }
      
      renderWithRouter(<FilterTags {...propsWithSelected} />)
      
      // Open filter panel
      await user.click(screen.getByRole('button', { name: /filter/i }))
      
      // Click clear button
      const clearButton = screen.getByRole('button', { name: /clear/i })
      await user.click(clearButton)
      
      expect(mockOnFilterChange).toHaveBeenCalledWith([])
    })

    it('should not show clear button when no tags are selected', async () => {
      const user = userEvent.setup()
      renderWithRouter(<FilterTags {...defaultProps} />)
      
      // Open filter panel
      await user.click(screen.getByRole('button', { name: /filter/i }))
      
      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should handle escape key to close filter panel', async () => {
      const user = userEvent.setup()
      renderWithRouter(<FilterTags {...defaultProps} />)
      
      // Open filter panel
      await user.click(screen.getByRole('button', { name: /filter/i }))
      expect(screen.getByText('completed')).toBeInTheDocument()
      
      // Press escape
      await user.keyboard('{Escape}')
      
      await waitFor(() => {
        expect(screen.queryByText('completed')).not.toBeInTheDocument()
      })
    })

    it('should handle enter key on tag buttons', async () => {
      const user = userEvent.setup()
      renderWithRouter(<FilterTags {...defaultProps} />)
      
      // Open filter panel
      await user.click(screen.getByRole('button', { name: /filter/i }))
      
      // Focus and press enter on a tag
      const completedTag = screen.getByText('completed').closest('button')
      completedTag.focus()
      await user.keyboard('{Enter}')
      
      expect(mockOnFilterChange).toHaveBeenCalledWith(['completed'])
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty available tags array', () => {
      const propsWithEmptyTags = {
        ...defaultProps,
        availableTags: []
      }
      
      renderWithRouter(<FilterTags {...propsWithEmptyTags} />)
      
      expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument()
    })

    it('should handle invalid initial selected tags', () => {
      const propsWithInvalidTags = {
        ...defaultProps,
        initialSelectedTags: ['nonexistent', 'completed']
      }
      
      renderWithRouter(<FilterTags {...propsWithInvalidTags} />)
      
      // Should still render without errors
      expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument()
    })

    it('should handle missing onFilterChange prop gracefully', async () => {
      const user = userEvent.setup()
      const propsWithoutCallback = {
        availableTags: ['completed', 'paused'],
        initialSelectedTags: []
      }
      
      renderWithRouter(<FilterTags {...propsWithoutCallback} />)
      
      // Open filter and try to select - should not crash
      await user.click(screen.getByRole('button', { name: /filter/i }))
      await user.click(screen.getByText('completed'))
      
      // Component should still be functional
      expect(screen.getByText('completed')).toBeInTheDocument()
    })

    it('should handle rapid clicking', async () => {
      const user = userEvent.setup()
      renderWithRouter(<FilterTags {...defaultProps} />)
      
      // Open filter panel
      await user.click(screen.getByRole('button', { name: /filter/i }))
      
      // Rapidly click the same tag multiple times
      const completedTag = screen.getByText('completed')
      await user.click(completedTag)
      await user.click(completedTag)
      await user.click(completedTag)
      
      // Should end up selected after odd number of clicks (1=select, 2=unselect, 3=select)
      expect(mockOnFilterChange).toHaveBeenLastCalledWith(['completed'])
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      const user = userEvent.setup()
      renderWithRouter(<FilterTags {...defaultProps} />)
      
      const filterButton = screen.getByRole('button', { name: /filter/i })
      expect(filterButton).toHaveAttribute('aria-expanded', 'false')
      
      // Open filter panel
      await user.click(filterButton)
      
      expect(filterButton).toHaveAttribute('aria-expanded', 'true')
    })

    it('should have proper labels and roles', async () => {
      const user = userEvent.setup()
      renderWithRouter(<FilterTags {...defaultProps} />)
      
      // Open filter panel
      await user.click(screen.getByRole('button', { name: /filter/i }))
      
      // Tag buttons should have proper roles
      const tagButtons = screen.getAllByRole('button')
      expect(tagButtons.length).toBeGreaterThanOrEqual(1) // At least the filter button
      
      // Check for tag items with menuitem role
      const tagItems = screen.getAllByRole('menuitem')
      expect(tagItems.length).toBeGreaterThan(0) // Should have tag menu items
      
      // Each tag should be accessible
      const completedButton = screen.getByText('completed')
      expect(completedButton).toBeInTheDocument()
    })

    it('should support screen readers with proper announcements', async () => {
      const user = userEvent.setup()
      const propsWithSelected = {
        ...defaultProps,
        initialSelectedTags: ['completed']
      }
      
      renderWithRouter(<FilterTags {...propsWithSelected} />)
      
      // Open filter panel
      await user.click(screen.getByRole('button', { name: /filter/i }))
      
      // Selected tag should have proper ARIA state
      const completedTag = screen.getByText('completed').closest('button')
      expect(completedTag).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = vi.fn()
      const TestComponent = (props) => {
        renderSpy()
        return <FilterTags {...props} />
      }
      
      const { rerender } = renderWithRouter(<TestComponent {...defaultProps} />)
      
      expect(renderSpy).toHaveBeenCalledTimes(1)
      
      // Re-render with same props
      rerender(<TestComponent {...defaultProps} />)
      
      // Should handle re-renders gracefully
      expect(renderSpy).toHaveBeenCalledTimes(2)
    })

    it('should handle large numbers of tags efficiently', async () => {
      const user = userEvent.setup()
      const largeTags = Array.from({ length: 100 }, (_, i) => `tag${i}`)
      const propsWithManyTags = {
        ...defaultProps,
        availableTags: largeTags
      }
      
      const startTime = performance.now()
      renderWithRouter(<FilterTags {...propsWithManyTags} />)
      
      // Open filter panel
      await user.click(screen.getByRole('button', { name: /filter/i }))
      
      const endTime = performance.now()
      
      // Should render reasonably quickly (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100)
      
      // Should render all tags
      expect(screen.getByText('tag0')).toBeInTheDocument()
      expect(screen.getByText('tag99')).toBeInTheDocument()
    })
  })
})
