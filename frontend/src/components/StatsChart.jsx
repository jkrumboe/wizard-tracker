import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
  

function StatsChart({ data }) {
  return (
    <div className="overflow-x-auto">
      <LineChart width={300} height={200} data={data}>
        <CartesianGrid stroke="#ccc" />
        <XAxis dataKey="game" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="elo" stroke="#4A90E2" />
      </LineChart>
    </div>
  )
}

export default StatsChart
