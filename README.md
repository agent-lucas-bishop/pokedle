# 🔴 Pokédle

**Daily Pokémon guessing game.** Guess today's Pokémon in 6 tries using clues about type, generation, height, weight, color, and base stat total.

## How It Works

- A mystery Pokémon is chosen daily (Gen I–III, 386 Pokémon)
- Type your guess using the autocomplete search
- After each guess, see how your pick compares:
  - 🟩 Green = correct match
  - 🟨 Yellow = partial (e.g., type exists but wrong slot)
  - ⬛ Gray = wrong — arrows show if the answer is higher/lower
- Share your results with friends!

## Tech Stack

- **Vite + React + TypeScript**
- **PokéAPI** (pokeapi.co) — free, no auth required
- Seeded daily puzzle from date
- LocalStorage for game persistence
- Zero backend required

## Design

Retro Pokédex aesthetic — dark mode with red accents, Press Start 2P pixel font, silhouette reveal mechanic inspired by "Who's That Pokémon?"

## Run Locally

```bash
npm install
npm run dev
```

## License

MIT
