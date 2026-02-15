import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

// Types
interface Pokemon {
  id: number
  name: string
  types: string[]
  generation: number
  height: number  // decimetres
  weight: number  // hectograms
  sprite: string
  silhouette: string
  color: string
  habitat: string
  baseStatTotal: number
  isLegendary: boolean
  isMythical: boolean
}

interface Guess {
  pokemon: Pokemon
  results: {
    name: boolean
    type1: 'correct' | 'partial' | 'wrong'
    type2: 'correct' | 'partial' | 'wrong'
    generation: 'correct' | 'higher' | 'lower'
    height: 'correct' | 'higher' | 'lower'
    weight: 'correct' | 'higher' | 'lower'
    color: boolean
    baseStatTotal: 'correct' | 'higher' | 'lower'
  }
}

const TOTAL_POKEMON = 386 // Gen 1-3 for accessibility

// Seed from date
function getDailySeed(): number {
  const d = new Date()
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

function seededRandom(seed: number): number {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function getDailyPokemonId(): number {
  return Math.floor(seededRandom(getDailySeed()) * TOTAL_POKEMON) + 1
}

function getGeneration(id: number): number {
  if (id <= 151) return 1
  if (id <= 251) return 2
  if (id <= 386) return 3
  if (id <= 493) return 4
  if (id <= 649) return 5
  if (id <= 721) return 6
  if (id <= 809) return 7
  if (id <= 905) return 8
  return 9
}

async function fetchPokemon(id: number): Promise<Pokemon> {
  const [pokRes, specRes] = await Promise.all([
    fetch(`https://pokeapi.co/api/v2/pokemon/${id}`),
    fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
  ])
  const pok = await pokRes.json()
  const spec = await specRes.json()

  const types = pok.types.map((t: any) => t.type.name)
  const bst = pok.stats.reduce((sum: number, s: any) => sum + s.base_stat, 0)

  return {
    id,
    name: pok.name,
    types,
    generation: getGeneration(id),
    height: pok.height,
    weight: pok.weight,
    sprite: pok.sprites.other['official-artwork'].front_default || pok.sprites.front_default,
    silhouette: pok.sprites.front_default,
    color: spec.color?.name || 'unknown',
    habitat: spec.habitat?.name || 'unknown',
    baseStatTotal: bst,
    isLegendary: spec.is_legendary,
    isMythical: spec.is_mythical,
  }
}

// Pokemon name list for autocomplete
async function fetchAllNames(): Promise<{name: string, id: number}[]> {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${TOTAL_POKEMON}`)
  const data = await res.json()
  return data.results.map((p: any, i: number) => ({ name: p.name, id: i + 1 }))
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function ResultCell({ value, result, icon }: { value: string | number; result: 'correct' | 'higher' | 'lower' | 'partial' | 'wrong' | boolean; icon?: string }) {
  let cls = 'result-cell'
  let arrow = ''
  if (result === true || result === 'correct') cls += ' correct'
  else if (result === 'partial') cls += ' partial'
  else if (result === 'higher') { cls += ' wrong'; arrow = '▲' }
  else if (result === 'lower') { cls += ' wrong'; arrow = '▼' }
  else cls += ' wrong'

  return (
    <div className={cls}>
      <span className="cell-icon">{icon}</span>
      <span className="cell-value">{value}</span>
      {arrow && <span className="cell-arrow">{arrow}</span>}
    </div>
  )
}

function SilhouetteReveal({ pokemon, revealed }: { pokemon: Pokemon | null; revealed: boolean }) {
  if (!pokemon) return <div className="silhouette-container loading"><div className="pokeball-loader" /></div>
  return (
    <div className="silhouette-container">
      <img
        src={pokemon.sprite}
        alt={revealed ? pokemon.name : 'Mystery Pokémon'}
        className={`silhouette-img ${revealed ? 'revealed' : ''}`}
      />
      {!revealed && <div className="who-text">Who's That Pokémon?</div>}
      {revealed && <div className="pokemon-name-reveal">{capitalize(pokemon.name)}!</div>}
    </div>
  )
}

function ShareButton({ guesses, won, target }: { guesses: Guess[]; won: boolean; target: Pokemon | null }) {
  const [copied, setCopied] = useState(false)

  const share = () => {
    if (!target) return
    const emojis = guesses.map(g => {
      const r = g.results
      const cells = [
        r.type1 === 'correct' ? '🟩' : r.type1 === 'partial' ? '🟨' : '⬛',
        r.generation === 'correct' ? '🟩' : '⬛',
        r.height === 'correct' ? '🟩' : '⬛',
        r.weight === 'correct' ? '🟩' : '⬛',
        r.color ? '🟩' : '⬛',
        r.baseStatTotal === 'correct' ? '🟩' : '⬛',
      ]
      return cells.join('')
    })
    const text = `Pokédle ${new Date().toLocaleDateString()} ${won ? guesses.length : 'X'}/6\n\n${emojis.join('\n')}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button className="share-btn" onClick={share}>
      {copied ? '✓ Copied!' : '📋 Share Results'}
    </button>
  )
}

function App() {
  const [target, setTarget] = useState<Pokemon | null>(null)
  const [allNames, setAllNames] = useState<{name: string, id: number}[]>([])
  const [guesses, setGuesses] = useState<Guess[]>([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<{name: string, id: number}[]>([])
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [guessedNames, setGuessedNames] = useState<Set<string>>(new Set())

  useEffect(() => {
    const saved = localStorage.getItem(`pokedle-${getDailySeed()}`)
    if (saved) {
      const data = JSON.parse(saved)
      setGuesses(data.guesses)
      setGameOver(data.gameOver)
      setWon(data.won)
      setGuessedNames(new Set(data.guesses.map((g: Guess) => g.pokemon.name)))
    }
    fetchAllNames().then(setAllNames)
    fetchPokemon(getDailyPokemonId()).then(setTarget)
  }, [])

  const saveState = useCallback((g: Guess[], over: boolean, w: boolean) => {
    localStorage.setItem(`pokedle-${getDailySeed()}`, JSON.stringify({ guesses: g, gameOver: over, won: w }))
  }, [])

  const compareResults = useCallback((guess: Pokemon, target: Pokemon): Guess['results'] => {
    const type1Match = guess.types[0] === target.types[0] ? 'correct' as const
      : target.types.includes(guess.types[0]) ? 'partial' as const : 'wrong' as const
    const type2Match: 'correct' | 'partial' | 'wrong' = 
      (!guess.types[1] && !target.types[1]) ? 'correct'
      : (guess.types[1] && target.types[1] && guess.types[1] === target.types[1]) ? 'correct'
      : (guess.types[1] && target.types.includes(guess.types[1])) ? 'partial'
      : 'wrong'

    return {
      name: guess.name === target.name,
      type1: type1Match,
      type2: type2Match,
      generation: guess.generation === target.generation ? 'correct' : guess.generation > target.generation ? 'lower' : 'higher',
      height: guess.height === target.height ? 'correct' : guess.height > target.height ? 'lower' : 'higher',
      weight: guess.weight === target.weight ? 'correct' : guess.weight > target.weight ? 'lower' : 'higher',
      color: guess.color === target.color,
      baseStatTotal: guess.baseStatTotal === target.baseStatTotal ? 'correct' : guess.baseStatTotal > target.baseStatTotal ? 'lower' : 'higher',
    }
  }, [])

  const handleGuess = useCallback(async (name: string, id: number) => {
    if (!target || gameOver || loading) return
    if (guessedNames.has(name)) return

    setLoading(true)
    setInput('')
    setSuggestions([])

    try {
      const guessed = await fetchPokemon(id)
      const results = compareResults(guessed, target)
      const isWin = guessed.name === target.name
      const isOver = isWin || guesses.length >= 5

      const newGuesses = [...guesses, { pokemon: guessed, results }]
      setGuesses(newGuesses)
      setGuessedNames(prev => new Set([...prev, name]))

      if (isWin) { setWon(true); setGameOver(true) }
      else if (isOver) { setGameOver(true) }

      saveState(newGuesses, isOver, isWin)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [target, gameOver, loading, guesses, guessedNames, compareResults, saveState])

  const handleInput = (val: string) => {
    setInput(val)
    if (val.length < 2) { setSuggestions([]); return }
    const filtered = allNames
      .filter(p => p.name.includes(val.toLowerCase()) && !guessedNames.has(p.name))
      .slice(0, 8)
    setSuggestions(filtered)
  }

  return (
    <div className="app">
      <header>
        <div className="pokeball-icon">
          <div className="pokeball-top" />
          <div className="pokeball-line" />
          <div className="pokeball-center" />
        </div>
        <h1>Pokédle</h1>
        <p className="subtitle">Daily Pokémon Challenge</p>
        <button className="help-btn" onClick={() => setShowHelp(!showHelp)}>?</button>
      </header>

      {showHelp && (
        <div className="help-modal" onClick={() => setShowHelp(false)}>
          <div className="help-content" onClick={e => e.stopPropagation()}>
            <h2>How to Play</h2>
            <p>Guess today's Pokémon in 6 tries! (Gen 1-3)</p>
            <div className="help-grid">
              <div><span className="dot correct" /> Correct</div>
              <div><span className="dot partial" /> Partial match (type in wrong slot)</div>
              <div><span className="dot wrong" /> Wrong — arrows show direction</div>
            </div>
            <p className="help-hint">Columns: Type • Gen • Height • Weight • Color • BST</p>
            <button onClick={() => setShowHelp(false)}>Got it!</button>
          </div>
        </div>
      )}

      <SilhouetteReveal pokemon={target} revealed={gameOver} />

      {!gameOver && (
        <div className="input-area">
          <div className="input-wrapper">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => handleInput(e.target.value)}
              placeholder="Type a Pokémon name..."
              disabled={loading}
              onKeyDown={e => {
                if (e.key === 'Enter' && suggestions.length > 0) {
                  handleGuess(suggestions[0].name, suggestions[0].id)
                }
              }}
            />
            {loading && <div className="input-spinner" />}
          </div>
          {suggestions.length > 0 && (
            <div className="suggestions">
              {suggestions.map(s => (
                <button key={s.id} onClick={() => handleGuess(s.name, s.id)}>
                  <img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${s.id}.png`} alt="" />
                  <span>{capitalize(s.name)}</span>
                  <span className="poke-id">#{s.id}</span>
                </button>
              ))}
            </div>
          )}
          <div className="guess-count">{guesses.length}/6 guesses</div>
        </div>
      )}

      {guesses.length > 0 && (
        <div className="guesses-table">
          <div className="table-header">
            <div>Pokémon</div>
            <div>Type</div>
            <div>Gen</div>
            <div>Height</div>
            <div>Weight</div>
            <div>Color</div>
            <div>BST</div>
          </div>
          {guesses.map((g, i) => (
            <div className={`guess-row ${g.results.name ? 'winner' : ''}`} key={i} style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="pokemon-cell">
                <img src={g.pokemon.sprite} alt={g.pokemon.name} />
                <span>{capitalize(g.pokemon.name)}</span>
              </div>
              <ResultCell
                value={g.pokemon.types.map(capitalize).join('/')}
                result={g.results.type1}
                icon=""
              />
              <ResultCell value={`Gen ${g.pokemon.generation}`} result={g.results.generation} icon="" />
              <ResultCell value={`${(g.pokemon.height / 10).toFixed(1)}m`} result={g.results.height} icon="" />
              <ResultCell value={`${(g.pokemon.weight / 10).toFixed(1)}kg`} result={g.results.weight} icon="" />
              <ResultCell value={capitalize(g.pokemon.color)} result={g.results.color} icon="" />
              <ResultCell value={g.pokemon.baseStatTotal} result={g.results.baseStatTotal} icon="" />
            </div>
          ))}
        </div>
      )}

      {gameOver && (
        <div className="game-over">
          {won ? (
            <div className="win-msg">
              <h2>🎉 You caught it!</h2>
              <p>Got it in {guesses.length}/6 {guesses.length === 1 ? 'guess' : 'guesses'}!</p>
            </div>
          ) : (
            <div className="lose-msg">
              <h2>The Pokémon escaped!</h2>
              <p>It was <strong>{target ? capitalize(target.name) : '...'}</strong></p>
            </div>
          )}
          <ShareButton guesses={guesses} won={won} target={target} />
          <p className="next-hint">Next Pokédle in {getTimeUntilMidnight()}</p>
        </div>
      )}

      <footer>
        <p>A new Pokémon every day at midnight • Gen I–III</p>
      </footer>

      <div className="daily-cross-promo">
        <span className="promo-label">More Dailies</span>
        <div className="promo-links">
          <a href="https://cinephile.codyp.xyz" target="_blank" rel="noopener">🎬 Cinéphile</a>
          <a href="https://chromacle.vercel.app" target="_blank" rel="noopener">🎨 Chromacle</a>
          <a href="https://geodle-six.vercel.app" target="_blank" rel="noopener">🌍 Geodle</a>
          <a href="https://flaggle-chi.vercel.app" target="_blank" rel="noopener">🏁 Flaggle</a>
          <a href="https://cosmole.vercel.app" target="_blank" rel="noopener">🪐 Cosmole</a>
        </div>
      </div>
    </div>
  )
}

function getTimeUntilMidnight(): string {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setHours(24, 0, 0, 0)
  const diff = tomorrow.getTime() - now.getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}h ${m}m`
}

export default App
