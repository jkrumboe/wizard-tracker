import { useState, useEffect } from 'react'
import { FilterIcon, XIcon } from '@/components/ui/Icon'

const FilterTags = ({ 
  availableTags = [], 
  initialSelectedTags = [], 
  onFilterChange = () => {} 
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTags, setSelectedTags] = useState(initialSelectedTags)

  useEffect(() => {
    setSelectedTags(initialSelectedTags)
  }, [initialSelectedTags])

  const handleTagSelect = (tag) => {
    const newSelectedTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag]
    
    setSelectedTags(newSelectedTags)
    onFilterChange(newSelectedTags)
  }

  const handleClearAll = () => {
    setSelectedTags([])
    onFilterChange([])
  }

  const handleKeyDown = (e, action) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }

  const handleEscapeKey = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey)
      return () => document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen])

  return (
    <div className="filter-tags">
      <button
        className="filter-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={`Filter tags ${selectedTags.length > 0 ? `(${selectedTags.length} selected)` : ''}`}
      >
        <FilterIcon data-testid="filter-icon" />
        Filter
        {selectedTags.length > 0 && (
          <span className="selected-count">{selectedTags.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="filter-panel" role="menu">
          <div className="filter-header">
            <span>Filter by tags</span>
            {selectedTags.length > 0 && (
              <button
                className="clear-all"
                onClick={handleClearAll}
                onKeyDown={(e) => handleKeyDown(e, handleClearAll)}
                role="button"
                aria-label="Clear all selected tags"
              >
                Clear all
              </button>
            )}
          </div>
          
          <div className="tag-list">
            {availableTags.map((tag) => (
              <button
                key={tag}
                className={`tag-button ${selectedTags.includes(tag) ? 'selected' : ''}`}
                onClick={() => handleTagSelect(tag)}
                onKeyDown={(e) => handleKeyDown(e, () => handleTagSelect(tag))}
                role="menuitem"
                aria-pressed={selectedTags.includes(tag)}
                aria-label={`${selectedTags.includes(tag) ? 'Remove' : 'Add'} ${tag} filter`}
              >
                {tag}
                {selectedTags.includes(tag) && (
                  <XIcon className="selected-icon" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FilterTags

