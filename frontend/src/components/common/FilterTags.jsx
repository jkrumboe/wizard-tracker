"use client"

const FilterTags = ({ tags, selectedTags, onTagSelect }) => {
  return (
    <div className="filter-tags">
      {tags.map((tag) => (
        <button
          key={tag}
          className={`tag-filter ${selectedTags.includes(tag) ? "active" : ""}`}
          onClick={() => onTagSelect(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}

export default FilterTags

