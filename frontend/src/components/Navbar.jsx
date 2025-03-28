import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="bg-gray-800 text-white p-4 flex justify-around">
      <Link to="/" className="hover:underline">Home</Link>
      <Link to="/leaderboard" className="hover:underline">Leaderboard</Link>
      <Link to="/profile/1" className="hover:underline">Profil</Link>
      <Link to="/stats/1" className="hover:underline">Stats</Link>
    </nav>
  )
}

export default Navbar
