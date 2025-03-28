// App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Leaderboard from './pages/Leaderboard'
import Stats from './pages/Stats'
import Navbar from './components/Navbar'

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profile/:id" element={<Profile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/stats/:id" element={<Stats />} />
      </Routes>
    </Router>
  )
}

export default App
