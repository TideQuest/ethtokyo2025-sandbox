import { useState } from 'react'
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
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const submitOffer = async () => {
    if (!sourceGameId.trim() || !targetGameId.trim() || !description.trim()) return

    setLoading(true)
    try {
      // TODO: API呼び出しを実装
      console.log('Offer submitted:', { sourceGameId, targetGameId, description })

      setTimeout(() => {
        alert('Offer submitted successfully!')
        setSourceGameId('')
        setTargetGameId('')
        setDescription('')
        setLoading(false)
      }, 1000)
    } catch (error) {
      console.error('Error submitting offer:', error)
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
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
            Target Game ID
          </label>
          <input
            type="text"
            value={sourceGameId}
            onChange={(e) => setSourceGameId(e.target.value)}
            placeholder="Game ID that people are asking recommendations for"
            style={{
              width: '100%',
              padding: 12,
              fontSize: 16,
              border: '2px solid #ddd',
              borderRadius: 8,
              outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
            Recommended Game ID
          </label>
          <input
            type="text"
            value={targetGameId}
            onChange={(e) => setTargetGameId(e.target.value)}
            placeholder="Game ID you want to recommend"
            style={{
              width: '100%',
              padding: 12,
              fontSize: 16,
              border: '2px solid #ddd',
              borderRadius: 8,
              outline: 'none'
            }}
          />
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
      // ターゲットゲーム情報を取得
      const targetGameInfo = getTargetGameInfo(gameId.trim())
      setTargetGame(targetGameInfo)

      // TODO: API呼び出しを実装
      // 現在はモックデータを使用
      const mockRecommendations: GameRecommendation[] = [
        {
          id: '1',
          name: 'Counter-Strike 2',
          description: 'Similar tactical FPS gameplay',
          accountType: 'ai_agent',
          accountName: 'FPS Recommender AI',
          likes: 47,
          isLiked: false
        },
        {
          id: '2',
          name: 'Valorant',
          description: 'Same competitive shooter genre',
          accountType: 'user',
          accountName: 'ProGamer_2024',
          purchaseHistory: {
            hasSourceGame: true,
            hasRecommendedGame: false
          },
          likes: 23,
          isLiked: true
        },
        {
          id: '3',
          name: 'Apex Legends',
          description: 'Popular among similar players',
          accountType: 'user',
          accountName: 'SteamUser123',
          purchaseHistory: {
            hasSourceGame: false,
            hasRecommendedGame: true
          },
          likes: 15,
          isLiked: false
        },
        {
          id: '4',
          name: 'Rainbow Six Siege',
          description: 'Strategic team-based shooter',
          accountType: 'user',
          accountName: 'TacticalPlayer',
          purchaseHistory: {
            hasSourceGame: true,
            hasRecommendedGame: true
          },
          likes: 89,
          isLiked: false
        }
      ]

      setTimeout(() => {
        setRecommendations(mockRecommendations)
        setLoading(false)
      }, 1000)
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
