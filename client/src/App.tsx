import { useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { WalletProvider, WalletConnectControls } from './wallet'
import OriginalApp from './OriginalApp'

type Page = 'search' | 'offer' | 'debug'

function Header({
  currentPage,
  onPageChange,
  gameId,
  onGameIdChange,
  onSearch
}: {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  gameId: string;
  onGameIdChange: (id: string) => void;
  onSearch: () => void;
}) {
  const handleSearch = () => {
    onPageChange('search');
    onSearch();
  };
  return (
    <header style={{
      backgroundColor: '#1976d2',
      color: 'white',
      padding: '16px 0',
      marginBottom: 24,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Steam Game Recommendation</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="text"
                value={gameId}
                onChange={(e) => onGameIdChange(e.target.value)}
                placeholder="Game ID"
                style={{
                  width: 100,
                  padding: '6px 8px',
                  fontSize: 12,
                  border: '1px solid rgba(255,255,255,0.5)',
                  borderRadius: 4,
                  outline: 'none',
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  color: '#333'
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                disabled={!gameId.trim()}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  backgroundColor: gameId.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
                  color: gameId.trim() ? '#1976d2' : 'rgba(255,255,255,0.7)',
                  border: 'none',
                  borderRadius: 4,
                  cursor: gameId.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                  transition: 'all 0.2s'
                }}
              >
                Search
              </button>
            </div>
            <nav style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => onPageChange('offer')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: currentPage === 'offer' ? '#fff' : 'transparent',
                  color: currentPage === 'offer' ? '#1976d2' : '#fff',
                  border: '1px solid #fff',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Offer
              </button>
              <button
                onClick={() => onPageChange('debug')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: currentPage === 'debug' ? '#fff' : 'transparent',
                  color: currentPage === 'debug' ? '#1976d2' : '#fff',
                  border: '1px solid #fff',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Debug
              </button>
            </nav>
            <div style={{ marginLeft: 8 }}>
              <WalletConnectControls />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

type AccountType = 'ai_agent' | 'user'

interface PurchaseHistory {
  hasSourceGame: boolean
  hasRecommendedGame: boolean
}

interface GameRecommendation {
  id: string
  name: string
  description: string
  accountType: AccountType
  accountName: string
  purchaseHistory?: PurchaseHistory
  likes: number
  isLiked: boolean
}

interface TargetGame {
  id: string
  name: string
  description: string
  genre: string
  releaseDate: string
  developer: string
  imageUrl?: string
}

function SearchPage({
  gameId,
  targetGame,
  recommendations,
  loading,
  onCreateOffer,
  onLikeRecommendation
}: {
  gameId: string;
  targetGame: TargetGame | null;
  recommendations: GameRecommendation[];
  loading: boolean;
  onCreateOffer: (sourceGameId: string) => void;
  onLikeRecommendation: (recommendationId: string) => void;
}) {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', fontFamily: 'sans-serif', padding: 16 }}>
      <h1>Recommendations</h1>

        {targetGame && (
          <div style={{ marginBottom: 24 }}>
            <h2>Target Game</h2>
            <div style={{
              border: '2px solid #2196f3',
              padding: 20,
              borderRadius: 12,
              backgroundColor: '#f8f9ff',
              display: 'flex',
              gap: 16
            }}>
              {targetGame.imageUrl && (
                <img
                  src={targetGame.imageUrl}
                  alt={targetGame.name}
                  style={{
                    width: 120,
                    height: 60,
                    objectFit: 'cover',
                    borderRadius: 8,
                    flexShrink: 0
                  }}
                />
              )}
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>
                  {targetGame.name}
                </h3>
                <p style={{ margin: '0 0 12px 0', color: '#555', lineHeight: 1.5 }}>
                  {targetGame.description}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 14 }}>
                  <div>
                    <strong>Genre:</strong> <span style={{ color: '#666' }}>{targetGame.genre}</span>
                  </div>
                  <div>
                    <strong>Developer:</strong> <span style={{ color: '#666' }}>{targetGame.developer}</span>
                  </div>
                  <div>
                    <strong>Release Date:</strong> <span style={{ color: '#666' }}>{targetGame.releaseDate}</span>
                  </div>
                </div>
                <button
                  onClick={() => onCreateOffer(targetGame.id)}
                  style={{
                    marginTop: 16,
                    padding: '10px 20px',
                    fontSize: 14,
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: 'background-color 0.2s'
                  }}
                >
                  Create Recommendation Offer
                </button>
              </div>
            </div>
          </div>
        )}

        {recommendations.length > 0 && (
          <div>
            <h2>Recommended Games</h2>
            <div style={{ display: 'grid', gap: 16 }}>
              {recommendations.map((game) => (
                <div
                  key={game.id}
                  style={{
                    border: '1px solid #ddd',
                    padding: 16,
                    borderRadius: 8,
                    backgroundColor: '#f9f9f9'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>{game.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 12,
                          backgroundColor: game.accountType === 'ai_agent' ? '#e3f2fd' : '#f3e5f5',
                          color: game.accountType === 'ai_agent' ? '#1976d2' : '#7b1fa2',
                          fontWeight: 'bold'
                        }}
                      >
                        {game.accountType === 'ai_agent' ? '🤖 AI Agent' : '👤 User'}
                      </span>
                    </div>
                  </div>

                  <p style={{ margin: '0 0 8px 0', color: '#666' }}>{game.description}</p>

                  <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>
                    投稿者: {game.accountName}
                  </div>

                  {game.purchaseHistory && (
                    <div style={{
                      backgroundColor: '#fff',
                      padding: 8,
                      borderRadius: 4,
                      border: '1px solid #e0e0e0',
                      fontSize: 12,
                      marginBottom: 8
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#333' }}>
                        購入履歴:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ color: game.purchaseHistory.hasSourceGame ? '#4caf50' : '#f44336' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', marginRight: 4, display: 'inline-block', width: 16, textAlign: 'center' }}>
                            {game.purchaseHistory.hasSourceGame ? '✓' : '✗'}
                          </span>
                          {targetGame?.name || `Game ID: ${gameId}`}
                        </span>
                        <span style={{ color: game.purchaseHistory.hasRecommendedGame ? '#4caf50' : '#f44336' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', marginRight: 4, display: 'inline-block', width: 16, textAlign: 'center' }}>
                            {game.purchaseHistory.hasRecommendedGame ? '✓' : '✗'}
                          </span>
                          {game.name}
                        </span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => onLikeRecommendation(game.id)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        backgroundColor: game.isLiked ? '#e91e63' : '#f0f0f0',
                        color: game.isLiked ? 'white' : '#666',
                        border: 'none',
                        borderRadius: 16,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.2s'
                      }}
                    >
                      <span>{game.isLiked ? '❤️' : '🤍'}</span>
                      <span>{game.likes}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  )
}


function OfferPage({ prefilledSourceGameId }: { prefilledSourceGameId?: string }) {
  const [sourceGameId, setSourceGameId] = useState(prefilledSourceGameId || '')
  const [targetGameId, setTargetGameId] = useState('')
  const [items, setItems] = useState<Array<{ id: string; title: string; steamAppId?: string }>>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [steamProof, setSteamProof] = useState<any | null>(null)
  const { address } = useAccount()

  // Load Items from backend to ensure IDs exist
  useEffect(() => {
    const loadItems = async () => {
      setItemsLoading(true)
      setItemsError(null)
      try {
        const res = await fetch('/api/items')
        const text = await res.text()
        const data = text ? JSON.parse(text) : []
        if (!res.ok) throw new Error((data && data.error) || 'Failed to load items')

        const normalized = (Array.isArray(data) ? data : []).map((it: any) => ({
          id: String(it.id),
          title: typeof it.title === 'string' ? it.title : (it.name ?? `Item ${it.id}`),
          steamAppId: it?.metadata?.appId || it?.steamGameDetails?.[0]?.steamAppId
        }))

        setItems(normalized)
        // Initialize selections if empty
        if (!prefilledSourceGameId && !sourceGameId) {
          const first = (normalized[0]?.steamAppId || normalized[0]?.id)?.toString() || ''
          setSourceGameId(first)
        }
        if (!targetGameId) {
          const second = (normalized[1]?.steamAppId || normalized[1]?.id || normalized[0]?.steamAppId || normalized[0]?.id)?.toString() || ''
          setTargetGameId(second)
        }
      } catch (e: any) {
        console.error('Failed to load items', e)
        setItemsError(e?.message || 'Failed to load items')
      } finally {
        setItemsLoading(false)
      }
    }
    loadItems()
  }, [prefilledSourceGameId])

  // Listen for proof from the Chrome extension content script
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Only accept messages from same window
      if (e.source !== window) return
      const msg = e.data
      if (msg && msg.type === 'STEAM_PROOF_FROM_EXTENSION') {
        setSteamProof(msg.data)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const submitOffer = async () => {
    if (!sourceGameId.trim() || !targetGameId.trim() || !description.trim()) return

    setLoading(true)
    try {
      // If we have a Steam proof from the extension, verify it before submitting the offer
      if (steamProof) {
        const proofObj = steamProof.proof || steamProof
        const steamId = steamProof.steamId || proofObj.steamId
        const targetAppId = sourceGameId // prove ownership for the selected target game (sourceGameId variable)

        const verifyRes = await fetch('/api/zkp/steam/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proof: proofObj,
            steamId,
            targetAppId,
            // Also send the recommended game's app id; server will accept if either matches the proof
            recommendedAppId: targetGameId,
            // If connected, bind proof to this account so purchase history matches the recommender
            walletAddress: address || undefined,
          }),
        })
        const verifyText = await verifyRes.text()
        const verifyData = verifyText ? JSON.parse(verifyText) : null
        if (!verifyRes.ok || !verifyData?.success) {
          const msg = (verifyData && (verifyData.error || verifyData.reason)) || verifyText || 'Failed to verify Steam proof'
          throw new Error(msg)
        }
        if (!verifyData.verified) {
          throw new Error(`Steam proof not verified: ${verifyData.reason || 'unknown reason'}`)
        }
      }

      // Prefer Steam appId when available, backend route expects steam ids
      const src = sourceGameId
      const dst = targetGameId
      const walletAddress = address || '0x1234567890123456789012345678901234567890' // fallback to seeded account

      // If values look like pure numbers (no steam appId), fallback to /api/recommendations with numeric IDs
      const endpoint = '/api/games/recommendations'

      const body = { sourceGameId: src, targetGameId: dst, description, walletAddress }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const text = await res.text()
      const data = text ? JSON.parse(text) : null
      if (!res.ok) {
        const msg = (data && data.error) || text || 'Failed to submit offer'
        throw new Error(msg)
      }

      alert('Offer submitted successfully!')
      // Keep the selected IDs, just clear the text
      setDescription('')
      // Clear proof only after successful submit
      // setSteamProof(null)
      setLoading(false)
    } catch (error) {
      console.error('Error submitting offer:', error)
      alert(error instanceof Error ? error.message : 'Failed to submit offer')
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', fontFamily: 'sans-serif', padding: 16 }}>
      <h1>Offer Game Recommendation</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Share your game recommendation with the community
      </p>

      <div style={{ marginBottom: 24 }}>
        {itemsError && (
          <div style={{ color: '#c00', marginBottom: 12 }}>Failed to load games: {itemsError}</div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
            Target Game ID
          </label>
          <select
            value={sourceGameId}
            onChange={(e) => setSourceGameId(e.target.value)}
            disabled={itemsLoading || items.length === 0}
            style={{
              width: '100%',
              padding: 12,
              fontSize: 16,
              border: '2px solid #ddd',
              borderRadius: 8,
              outline: 'none',
              background: '#fff'
            }}
          >
            {itemsLoading && <option>Loading...</option>}
            {!itemsLoading && items.length === 0 && <option>No games found</option>}
            {!itemsLoading && items.map((it) => (
              <option key={it.id} value={(it.steamAppId || it.id).toString()}>{it.title} ({it.steamAppId ? `appId:${it.steamAppId}` : `#${it.id}`})</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
            Recommended Game ID
          </label>
          <select
            value={targetGameId}
            onChange={(e) => setTargetGameId(e.target.value)}
            disabled={itemsLoading || items.length === 0}
            style={{
              width: '100%',
              padding: 12,
              fontSize: 16,
              border: '2px solid #ddd',
              borderRadius: 8,
              outline: 'none',
              background: '#fff'
            }}
          >
            {itemsLoading && <option>Loading...</option>}
            {!itemsLoading && items.length === 0 && <option>No games found</option>}
            {!itemsLoading && items.map((it) => (
              <option key={it.id} value={(it.steamAppId || it.id).toString()}>{it.title} ({it.steamAppId ? `appId:${it.steamAppId}` : `#${it.id}`})</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
            Recommendation Reason
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain why you recommend this game..."
            rows={4}
            style={{
              width: '100%',
              padding: 12,
              fontSize: 16,
              border: '2px solid #ddd',
              borderRadius: 8,
              outline: 'none',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            type="button"
            data-open-steam-extension
            data-steam-url="https://store.steampowered.com/"
            disabled={loading}
            style={{
              padding: '12px 16px',
              fontSize: 16,
              backgroundColor: '#2b7de9',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            Verify with Steam
          </button>

          {steamProof && (
            <span style={{ fontSize: 12, color: '#2e7d32' }}>
              Proof attached from extension
            </span>
          )}

          <button
            onClick={submitOffer}
            disabled={loading || !sourceGameId.trim() || !targetGameId.trim() || !description.trim()}
            style={{
              padding: '12px 24px',
              fontSize: 16,
              backgroundColor: loading ? '#ccc' : '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? 'Submitting...' : 'Submit Offer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('offer')
  const [gameId, setGameId] = useState('')
  const [targetGame, setTargetGame] = useState<TargetGame | null>(null)
  const [recommendations, setRecommendations] = useState<GameRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [offerSourceGameId, setOfferSourceGameId] = useState<string>('')

  const getTargetGameInfo = (id: string): TargetGame | null => {
    const gameDatabase: Record<string, TargetGame> = {
      '730': {
        id: '730',
        name: 'Counter-Strike: Global Offensive',
        description: 'Counter-Strike: Global Offensive (CS: GO) expands upon the team-based action gameplay that it pioneered when it was launched 19 years ago.',
        genre: 'Action, FPS',
        releaseDate: '2012-08-21',
        developer: 'Valve Corporation',
        imageUrl: 'https://steamcdn-a.akamaihd.net/steam/apps/730/header.jpg'
      },
      '570': {
        id: '570',
        name: 'Dota 2',
        description: 'Every day, millions of players worldwide enter battle as one of over a hundred Dota heroes.',
        genre: 'Strategy, MOBA',
        releaseDate: '2013-07-09',
        developer: 'Valve Corporation'
      },
      '440': {
        id: '440',
        name: 'Team Fortress 2',
        description: 'Nine distinct classes provide a broad range of tactical abilities and personalities.',
        genre: 'Action, FPS',
        releaseDate: '2007-10-10',
        developer: 'Valve Corporation'
      }
    }
    return gameDatabase[id] || null
  }

  const searchRecommendations = async () => {
    if (!gameId.trim()) return

    setLoading(true)
    try {
      // ターゲットゲーム情報を取得（API）
      try {
        const gameRes = await fetch(`/api/games/${encodeURIComponent(gameId.trim())}`)
        const gameText = await gameRes.text()
        const gameData = gameText ? JSON.parse(gameText) : null
        if (gameRes.ok && gameData) setTargetGame(gameData)
        else setTargetGame(null)
      } catch {
        setTargetGame(null)
      }

      // レコメンデーション取得（API）
      const res = await fetch(`/api/games/${encodeURIComponent(gameId.trim())}/recommendations`)
      const text = await res.text()
      const data = text ? JSON.parse(text) : []
      if (!res.ok) throw new Error((data && data.error) || 'Failed to fetch recommendations')

      setRecommendations(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching recommendations:', error)
      setLoading(false)
    }
  }

  const handleCreateOffer = (sourceGameId: string) => {
    setOfferSourceGameId(sourceGameId);
    setCurrentPage('offer');
  };

  const handleLikeRecommendation = (recommendationId: string) => {
    setRecommendations(prev => prev.map(rec =>
      rec.id === recommendationId
        ? { ...rec, isLiked: !rec.isLiked, likes: rec.isLiked ? rec.likes - 1 : rec.likes + 1 }
        : rec
    ));
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'search':
        return <SearchPage
          gameId={gameId}
          targetGame={targetGame}
          recommendations={recommendations}
          loading={loading}
          onCreateOffer={handleCreateOffer}
          onLikeRecommendation={handleLikeRecommendation}
        />
      case 'offer':
        return <OfferPage prefilledSourceGameId={offerSourceGameId} />
      case 'debug':
        return <OriginalApp />
      default:
        return <SearchPage
          gameId={gameId}
          targetGame={targetGame}
          recommendations={recommendations}
          loading={loading}
          onCreateOffer={handleCreateOffer}
          onLikeRecommendation={handleLikeRecommendation}
        />
    }
  }

  return (
    <WalletProvider>
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
        <Header
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          gameId={gameId}
          onGameIdChange={setGameId}
          onSearch={searchRecommendations}
        />
        <div style={{ paddingBottom: 24 }}>
          {renderCurrentPage()}
        </div>
      </div>
    </WalletProvider>
  )
}
