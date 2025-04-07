"use client"

import { useEffect } from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import Profile from "./pages/Profile"
import Leaderboard from "./pages/Leaderboard"
import Stats from "./pages/Stats"
import NewGame from "./pages/NewGame"
import GameDetails from "./pages/GameDetails"
import Navbar from "./components/Navbar"
import { register } from "./serviceWorkerRegistration"

function App() {
  useEffect(() => {
    // Register service worker for PWA functionality
    register()
  }, [])

  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profile/:id" element={<Profile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/stats/:id" element={<Stats />} />
        <Route path="/new-game" element={<NewGame />} />
        <Route path="/game/:id" element={<GameDetails />} />
      </Routes>
    </Router>
  )
}

export default App

