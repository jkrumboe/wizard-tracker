"use client"

import { useState, useEffect } from "react"
import { useLocation } from "react-router-dom"

const SearchBar = ({ onSearch, placeholder = "Search...", value }) => {
  const [query, setQuery] = useState(value ?? "")
  const location = useLocation()

  useEffect(() => {
    if (value !== undefined) {
      setQuery(value)
    }
  }, [value])

  const handleChange = (e) => {
    const val = e.target.value
    if (value === undefined) {
      setQuery(val)
    }
    onSearch(val)
  }

  const isOnNewGamePage = location.pathname === "/new-game"

  return (
    <div className="search-bar">
      <input
        type="text"
        className={`search-input ${isOnNewGamePage && query ? "no-bottom-radius" : ""}`}
        placeholder={placeholder}
        value={value !== undefined ? value : query}
        onChange={handleChange}
      />
    </div>
  )
}

export default SearchBar
