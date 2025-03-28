function PlayerCard({ name, elo, profilePicture }) {
    return (
      <div className="flex items-center gap-4 p-4 border rounded-lg shadow">
        <img
          src={profilePicture || '/default-avatar.png'}
          alt={`${name}'s profile`}
          className="w-12 h-12 rounded-full object-cover"
        />
        <div>
          <h3 className="font-semibold text-lg">{name}</h3>
          <p className="text-sm text-gray-600">Elo: {elo}</p>
        </div>
      </div>
    )
  }
  
  export default PlayerCard
  