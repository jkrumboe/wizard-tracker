import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import GameHistoryItem from '@/components/game/GameHistoryItem'
import LoadGameDialog from '@/components/modals/LoadGameDialog'
import AppLoadingScreen from '@/components/common/AppLoadingScreen'
import { getRecentGames, getRecentLocalGames } from '@/shared/api/gameService'
import { useGameStateContext } from '@/shared/hooks/useGameState'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { client } from '@/shared/utils/appwrite'
import { AppwriteException } from 'appwrite'
import "@/styles/components/offline-notification.css"

// Add spin animation styles
const spinKeyframes = `
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

// Inject the styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = spinKeyframes;
  document.head.appendChild(style);
}

const Home = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isOnline } = useOnlineStatus()
  const { loadSavedGame, getSavedGames } = useGameStateContext()
  const [recentGames, setRecentGames] = useState([])
  const [recentLocalGames, setRecentLocalGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [offlineMessage, setOfflineMessage] = useState('')
  const [showLoadingScreen, setShowLoadingScreen] = useState(false)
  
  // Ping functionality state
  const [pingLogs, setPingLogs] = useState([])
  const [pingStatus, setPingStatus] = useState("idle")
  const [showPingLogs, setShowPingLogs] = useState(false)
  const detailsRef = useRef(null)
  const [detailHeight, setDetailHeight] = useState(55)

  const updateHeight = useCallback(() => {
    if (detailsRef.current) {
      setDetailHeight(detailsRef.current.clientHeight);
    }
  }, []);

  useEffect(() => {
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [updateHeight]);

  useEffect(() => {
    if (!detailsRef.current) return;
    
    const currentRef = detailsRef.current;
    currentRef.addEventListener("toggle", updateHeight);

    return () => {
      currentRef.removeEventListener("toggle", updateHeight);
    };
  }, [updateHeight]);

  async function sendPing() {
    if (pingStatus === "loading") return;
    setPingStatus("loading");
    try {
      const startTime = Date.now();
      const result = await client.ping();
      const endTime = Date.now();
      
      const log = {
        date: new Date(),
        method: "GET",
        path: "/v1/ping",
        status: 200,
        response: `${JSON.stringify(result)} (${endTime - startTime}ms)`,
      };
      setPingLogs((prevLogs) => [log, ...prevLogs]);
      setPingStatus("success");
    } catch (err) {
      const log = {
        date: new Date(),
        method: "GET",
        path: "/v1/ping",
        status: err instanceof AppwriteException ? err.code : 500,
        response: err instanceof AppwriteException ? err.message : "Connection failed",
      };
      setPingLogs((prevLogs) => [log, ...prevLogs]);
      setPingStatus("error");
    }
    setShowPingLogs(true);
  }


  useEffect(() => {
    let timer;
    if (loading) {
      // Only show loading screen if loading takes longer than 200ms
      timer = setTimeout(() => setShowLoadingScreen(true), 200);
    } else {
      setShowLoadingScreen(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);
  
  const handleLoadGame = async (gameId) => {
    try {
      const success = await loadSavedGame(gameId)
      if (success) {
        setShowLoadDialog(false)
        navigate("/game/current")
      }
      return success
    } catch (error) {
      console.error('Failed to load game:', error)
      return false
    }
  }

  // Check for offline mode redirect
  useEffect(() => {
    if (location.state?.offlineRedirect) {
      setOfflineMessage(location.state.message || 'Online features are currently unavailable');
      
      // Clear the message after 5 seconds
      const timer = setTimeout(() => {
        setOfflineMessage('');
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  useEffect(() => {
    const fetchGames = async () => {
      setLoading(true); // Ensure loading is true at the start
      
      try {
        let serverGames = [];
        // Only fetch server games when online
        if (isOnline) {
          // Fetch server games
          serverGames = await getRecentGames(4);
        }
        
        // Always fetch local games
        const localGames = getRecentLocalGames(10); // This is synchronous
        
        // Ensure all games have proper date formatting for sorting
        const formattedServerGames = Array.isArray(serverGames) ? serverGames.map(game => ({
          ...game,
          created_at: game.created_at || new Date().toISOString()
        })) : [];
        
        // Local games should already have created_at, but let's make sure
        const formattedLocalGames = Array.isArray(localGames) ? localGames.map(game => ({
          ...game,
          created_at: game.created_at || new Date().toISOString()
        })) : [];
        
        setRecentGames(formattedServerGames)
        setRecentLocalGames(formattedLocalGames)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching games:', error)
        // Even if there's an error with server games, still show local games
        try {
          const localGames = getRecentLocalGames(4)
          const formattedLocalGames = Array.isArray(localGames) ? localGames.map(game => ({
            ...game,
            created_at: game.created_at || new Date().toISOString()
          })) : [];
          setRecentLocalGames(formattedLocalGames)
        } catch (localError) {
          console.error('Error fetching local games:', localError)
          setRecentLocalGames([])
        }
        console.log('Home: Setting loading=false after error');
        setLoading(false)
      }
    }

    fetchGames()
  }, [isOnline])

  // Check for offline message from navigation state
  useEffect(() => {
    if (location.state?.offlineMessage) {
      setOfflineMessage(location.state.offlineMessage);
      // Clear the state to avoid showing the message after navigating away and back
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  return (
    <AppLoadingScreen
      isLoading={showLoadingScreen}
      loadingTitle="Welcome!"
      loadingSubtitle={
        <>
          The home base for tracking your Wizard games.
          <br />
          View stats, history, and more!
        </>
      }
      showOnAppOpen={true}
      appOpenThreshold={30 * 60 * 1000}
      storageKey="wizardAppLastUsed"
    >
      <div className="home-container" style={{ marginBottom: `${detailHeight}px` }}>
        <header className="home-header">
          <h1>KeepWiz</h1>
          <p>Track your Wizard card game stats and performance</p>
        </header>

        {/* Ping Connection Test Section */}
        <section className="ping-section" style={{ padding: '20px', margin: '20px 0', background: '#f9f9fa', borderRadius: '8px', border: '1px solid #e6e6e6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ 
                borderRadius: '25%', 
                border: '1px solid rgba(25, 25, 28, 0.04)', 
                background: '#f9f9fa', 
                padding: '12px',
                boxShadow: '0px 9.36px 9.36px 0px rgba(0,0,0,0.04)'
              }}>
                <div style={{ 
                  borderRadius: '25%', 
                  border: '1px solid #fafafb', 
                  background: 'white', 
                  padding: '20px',
                  boxShadow: '0px 2px 12px 0px rgba(0,0,0,0.03)'
                }}>
                  🎯
                </div>
              </div>
              
              <div style={{ 
                display: 'flex', 
                width: '152px', 
                alignItems: 'center', 
                transition: 'opacity 2.5s ease',
                opacity: pingStatus === "success" ? 1 : 0
              }}>
                <div style={{ 
                  background: 'linear-gradient(to left, #f02e65, rgba(253, 54, 110, 0.15))', 
                  height: '1px', 
                  flex: 1 
                }}></div>
                <div style={{ 
                  display: 'flex', 
                  height: '20px', 
                  width: '20px', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  borderRadius: '50%', 
                  border: '1px solid rgba(253, 54, 110, 0.32)', 
                  background: 'rgba(253, 54, 110, 0.08)', 
                  color: '#fd366e'
                }}>✓</div>
                <div style={{ 
                  background: 'linear-gradient(to right, #f02e65, rgba(253, 54, 110, 0.15))', 
                  height: '1px', 
                  flex: 1 
                }}></div>
              </div>
              
              <div style={{ 
                borderRadius: '25%', 
                border: '1px solid rgba(25, 25, 28, 0.04)', 
                background: '#f9f9fa', 
                padding: '12px',
                boxShadow: '0px 9.36px 9.36px 0px rgba(0,0,0,0.04)'
              }}>
                <div style={{ 
                  borderRadius: '25%', 
                  border: '1px solid #fafafb', 
                  background: 'white', 
                  padding: '20px',
                  boxShadow: '0px 2px 12px 0px rgba(0,0,0,0.03)'
                }}>
                  🏠
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', minHeight: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {pingStatus === "loading" ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div role="status">
                    <svg
                      aria-hidden="true"
                      style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite', fill: '#fd366e', color: '#e5e7eb' }}
                      viewBox="0 0 100 101"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                        fill="currentColor"
                      />
                      <path
                        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                        fill="currentFill"
                      />
                    </svg>
                    <span style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}>Loading...</span>
                  </div>
                  <span>Testing connection...</span>
                </div>
              ) : pingStatus === "success" ? (
                <div>
                  <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '24px', fontWeight: 300, color: '#2d2d31', margin: 0 }}>
                    Connection Active!
                  </h3>
                  <p style={{ margin: '8px 0', color: '#666' }}>Successfully connected to Appwrite backend.</p>
                </div>
              ) : (
                <div>
                  <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '24px', fontWeight: 300, color: '#2d2d31', margin: 0 }}>
                    Test Connection
                  </h3>
                  <p style={{ margin: '8px 0', color: '#666' }}>Send a ping to verify the connection</p>
                </div>
              )}

              <button
                onClick={sendPing}
                style={{
                  cursor: 'pointer',
                  borderRadius: '6px',
                  background: '#fd366e',
                  padding: '10px 16px',
                  border: 'none',
                  color: 'white',
                  marginTop: '16px',
                  display: pingStatus === "loading" ? 'none' : 'block'
                }}
              >
                Send a ping
              </button>
            </div>
          </div>
        </section>

        {offlineMessage && (
          <div className="offline-notification">
            <div className="offline-message">{offlineMessage}</div>
          </div>
        )}

        <section className="recent-games">
          <h2>Recent Games</h2>
          <div className="game-list">
            {recentGames.length > 0 || recentLocalGames.length > 0 ? (
              <div className="game-history">
                {/* Combine and sort all games by date */}
                {[...recentGames, ...recentLocalGames]
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .slice(0, 6) // Limit to 6 most recent games
                  .map(game => (
                    <GameHistoryItem key={game.id} game={game} />
                  ))
                }
              </div>
            ) : (
              <div className="empty-message">No games found</div>
            )}
          </div>
        </section>

        {/* Load Game Dialog */}
        <LoadGameDialog
          isOpen={showLoadDialog}
          onClose={() => setShowLoadDialog(false)}
          onLoadGame={handleLoadGame}
          getSavedGames={getSavedGames}
        />
      </div>

      {/* Ping Logs Section */}
      <aside style={{ position: 'fixed', bottom: 0, display: 'flex', width: '100%', cursor: 'pointer', borderTop: '1px solid #ededf0', background: 'white' }}>
        <details open={showPingLogs} ref={detailsRef} style={{ width: '100%' }}>
          <summary style={{ display: 'flex', width: '100%', flexDirection: 'row', justifyContent: 'space-between', padding: '16px', listStyle: 'none' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ fontWeight: 600 }}>Connection Logs</span>
              {pingLogs.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', borderRadius: '6px', background: '#e6e6e6', padding: '0 8px' }}>
                  <span style={{ fontWeight: 600 }}>{pingLogs.length}</span>
                </div>
              )}
            </div>
            <div style={{ transform: showPingLogs ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <span aria-hidden="true">▼</span>
            </div>
          </summary>
          <div style={{ display: 'flex', width: '100%', flexDirection: 'column' }}>
            <div style={{ flexGrow: 1 }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr style={{ borderTop: '1px solid #ededf0', borderBottom: '1px solid #ededf0', background: '#fafafb', color: '#97979b' }}>
                    {pingLogs.length > 0 ? (
                      <>
                        <td style={{ width: '208px', padding: '8px 0 8px 16px' }}>Date</td>
                        <td>Status</td>
                        <td>Method</td>
                        <td>Path</td>
                        <td>Response</td>
                      </>
                    ) : (
                      <td style={{ padding: '8px 0 8px 16px' }}>Logs</td>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pingLogs.length > 0 ? (
                    pingLogs.map((log, index) => (
                      <tr key={index}>
                        <td style={{ padding: '8px 0 8px 16px', fontFamily: 'Fira Code, monospace' }}>
                          {log.date.toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>
                          {log.status > 400 ? (
                            <div style={{ width: 'fit-content', borderRadius: '2px', background: 'rgba(255, 69, 58, 0.24)', padding: '2px 4px', color: '#b31212' }}>
                              {log.status}
                            </div>
                          ) : (
                            <div style={{ width: 'fit-content', borderRadius: '2px', background: 'rgba(16, 185, 129, 0.24)', padding: '2px 4px', color: '#0a714f' }}>
                              {log.status}
                            </div>
                          )}
                        </td>
                        <td>{log.method}</td>
                        <td>{log.path}</td>
                        <td style={{ fontFamily: 'Fira Code, monospace' }}>
                          {log.response}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td style={{ padding: '8px 0 8px 16px', fontFamily: 'Fira Code, monospace' }}>
                        There are no logs to show
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </aside>
    </AppLoadingScreen>
  )
}

export default Home