"use client"

import { useState } from "react"

const SearchBar = ({ onSearch, placeholder = "Search..." }) => {
  const [query, setQuery] = useState("")

  const handleChange = (e) => {
    const value = e.target.value
    setQuery(value)
    onSearch(value)
  }

  return (
    <div className="search-bar">
      <input type="text" className="search-input" placeholder={placeholder} value={query} onChange={handleChange} />
    </div>
  )
}

export default SearchBar

