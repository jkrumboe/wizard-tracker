function LeaderboardEntry({ rank, name, elo }) {
    return (
      <div className="flex justify-between p-2 border-b">
        <span>#{rank}</span>
        <span>{name}</span>
        <span className="font-bold">{elo}</span>
      </div>
    )
  }
  
  export default LeaderboardEntry
  