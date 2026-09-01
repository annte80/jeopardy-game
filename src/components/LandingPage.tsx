import { GamepadIcon, ArrowRight, LogIn, Hammer, CalendarDays } from 'lucide-react';

interface LandingPageProps {
  onCreateGame: () => void;
  onJoinGame: () => void;
}

export function LandingPage({ onCreateGame, onJoinGame }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      {/* Animated background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/8 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <GamepadIcon className="w-6 h-6 text-amber-400" />
          </div>
          <span className="text-slate-400 font-semibold text-sm tracking-wider hidden sm:block">
            MULTIPLAYER GAME ROOM
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <div className="text-center max-w-3xl animate-slide-up">
                    <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight mb-4">
            <span className="text-white">ANIVARA</span>{' '}
            <span className="text-amber-400 text-glow-gold">NIGHT</span>
          </h1>
          <p className="text-slate-500 text-sm mb-4">
            Formerly Jeopardy Night — same custom Jeopardy-style trivia game, new name.
          </p>
          <p className="text-lg sm:text-xl text-slate-400 mb-12 font-medium">
            Host a private game show with your friends.
            <br className="hidden sm:block" />
            One moderator, up to 8 players, one unforgettable night.
          </p>

                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl w-full mx-auto items-stretch">

            {/* Left: Game Maker - Coming Soon */}
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-6 bg-slate-900/40 border border-slate-800 rounded-2xl opacity-60 cursor-not-allowed">
              <Hammer className="w-6 h-6 text-slate-500" />
              <span className="text-slate-400 font-bold text-sm">Game Maker</span>
              <span className="text-slate-600 text-xs uppercase tracking-wider">Coming Soon</span>
            </div>

            {/* Center: Create + Join, stacked */}
            <div className="flex flex-col gap-2">
              <button
                onClick={onCreateGame}
                className="group flex items-center justify-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-lg rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/20"
              >
                Create Game
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={onJoinGame}
                className="group flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl transition-all hover:scale-[1.02] active:scale-95 border border-slate-700"
              >
                <LogIn className="w-4 h-4 text-blue-400" />
                Join Game
              </button>
            </div>

            {/* Right: Anigenre Daily */}
            
              href="/anigenre"
              className="flex flex-col items-center justify-center gap-2 px-6 py-6 bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800 hover:border-teal-500/40 rounded-2xl transition-all hover:scale-[1.02]"
            >
              <CalendarDays className="w-6 h-6 text-teal-400" />
              <span className="text-white font-bold text-sm">Anigenre Daily</span>
              <span className="text-slate-500 text-xs">New puzzle every day</span>
            </a>

          </div>
        </div>

        
      </main>

      
    </div>
  );
}
