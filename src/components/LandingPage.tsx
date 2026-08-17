import { GamepadIcon, ArrowRight, LogIn } from 'lucide-react';

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
            <span className="text-white">JEOPARDY</span>{' '}
            <span className="text-amber-400 text-glow-gold">NIGHT</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 mb-12 font-medium">
            Host a private game show with your friends.
            <br className="hidden sm:block" />
            One moderator, three players, one unforgettable night.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onCreateGame}
              className="group flex items-center justify-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-lg rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/20"
            >
              Create Game
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={onJoinGame}
              className="group flex items-center justify-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg rounded-2xl transition-all hover:scale-105 active:scale-95 border border-slate-700"
            >
              <LogIn className="w-5 h-5 text-blue-400" />
              Join Game
            </button>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl w-full">
          {[
            { icon: '🎯', title: 'Synchronized Slides', desc: 'Everyone watches the same presentation in real time' },
            { icon: '⚡', title: 'First Buzzer Wins', desc: 'Server-side lock ensures fair play' },
            { icon: '🏆', title: 'Live Scoreboard', desc: 'Track scores as the game unfolds' },
          ].map((f, i) => (
            <div
              key={i}
              className="glass rounded-2xl p-5 animate-slide-up"
              style={{ animationDelay: `${0.2 + i * 0.1}s` }}
            >
              <div className="text-3xl mb-2">{f.icon}</div>
              <h3 className="text-white font-bold mb-1">{f.title}</h3>
              <p className="text-slate-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 text-center py-6 text-slate-600 text-sm">
        Built for private game nights. No accounts, no signups.
      </footer>
    </div>
  );
}
