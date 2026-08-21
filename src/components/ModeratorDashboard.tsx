import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Zap, ZapOff, RotateCcw, Plus, Minus,
  Maximize2, Copy, Trophy, Volume2, VolumeX, Keyboard, X, Users,
  Crown, AlertTriangle, LogOut, CheckCircle2, XCircle,
} from 'lucide-react';
import { usePlayers, useConnectionStatus } from '@/lib/hooks';
import { PresentationViewer } from './PresentationViewer';
import { BuzzerStatus } from './Buzzer';
import { Scoreboard } from './Scoreboard';
import { Chat } from './Chat';
import { PlayerList } from './PlayerList';
import { ConnectionIndicator } from './ConnectionIndicator';
import { ConfirmationDialog } from './ConfirmationDialog';
import { useToast } from './Toast';
import {
  modSetSlide,
  modSetBuzzer,
  modAdjustScore,
  modSetGameStatus,
  modRemovePlayer,
} from '@/lib/gameApi';
import { setMuted, isMuted, playBuzzWin } from '@/lib/sound';
import type { ModeratorSession, Player, Game } from '@/lib/types';

interface ModeratorDashboardProps {
  session: ModeratorSession;
  game: Game;
  onGameEnded: () => void;
  onLeave: () => void;
}

export function ModeratorDashboard({
  session,
  game,
  onGameEnded,
  onLeave,
}: ModeratorDashboardProps) {
  const { players, refetch } = usePlayers(session.gameId);
  const connectionStatus = useConnectionStatus();
  const { show } = useToast();

  const [muted, setMutedState] = useState(isMuted());
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [scoreAdjustPlayer, setScoreAdjustPlayer] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');

  /*
   * This is the element that enters fullscreen.
   *
   * Keep the fullscreen element isolated from the flex layout as much
   * as possible. The wrapper itself also has min-w-0/max-w-full below
   * so the PDF cannot make the center column wider after fullscreen.
   */
  const presentationRef = useRef<HTMLDivElement>(null);

  const gameId = session.gameId;
  const modToken = session.moderatorToken;
  const joinUrl = `${window.location.origin}/join/${session.roomCode}`;

  const connectedCount = players.filter(
    (p) => p.connection_status === 'connected'
  ).length;

  // ---------------------------------------------------------------------------
  // PRESENTATION NAVIGATION
  // ---------------------------------------------------------------------------

  const setSlide = useCallback(
    async (page: number) => {
      if (!game) return;

      const max = game.presentation_total_pages || 9999;
      const targetPage = Math.max(1, Math.min(max, Math.round(page)));

      if (targetPage === game.current_slide) {
        return;
      }

      try {
        await modSetSlide(gameId, modToken, targetPage);
      } catch (e) {
        console.error('[ModeratorDashboard] failed to set slide', e);
        show('Failed to change slide', 'error');
      }
    },
    [
      game,
      gameId,
      modToken,
      show,
    ]
  );

  const goPrev = useCallback(async () => {
    if (!game) return;

    await setSlide(game.current_slide - 1);
  }, [game, setSlide]);

  const goNext = useCallback(async () => {
    if (!game) return;

    await setSlide(game.current_slide + 1);
  }, [game, setSlide]);

  const handlePresentationPageChange = useCallback(
    async (page: number) => {
      if (!Number.isFinite(page)) {
        return;
      }

      await setSlide(page);
    },
    [setSlide]
  );

  // ---------------------------------------------------------------------------
  // BUZZER
  // ---------------------------------------------------------------------------

  const enableBuzzer = useCallback(async () => {
    try {
      await modSetBuzzer(gameId, modToken, 'enabled');
      show('Buzzers enabled!', 'success');
    } catch {
      show('Failed to enable buzzer', 'error');
    }
  }, [gameId, modToken, show]);

  const disableBuzzer = useCallback(async () => {
    try {
      await modSetBuzzer(gameId, modToken, 'disabled');
      show('Buzzers disabled', 'info');
    } catch {
      show('Failed to disable buzzer', 'error');
    }
  }, [gameId, modToken, show]);

  const resetBuzzer = useCallback(async () => {
    try {
      await modSetBuzzer(gameId, modToken, 'resetting');
      show('Buzzer reset', 'info');
    } catch {
      show('Failed to reset buzzer', 'error');
    }
  }, [gameId, modToken, show]);

  // ---------------------------------------------------------------------------
  // SCORES
  // ---------------------------------------------------------------------------

  const adjustScore = useCallback(
    async (playerId: string, delta: number) => {
      try {
        await modAdjustScore(gameId, modToken, playerId, delta);

        const p = players.find((x) => x.id === playerId);

        if (p) {
          show(
            `${p.player_name} ${delta > 0 ? '+' : ''}${delta}`,
            'success'
          );
        }
      } catch {
        show('Failed to adjust score', 'error');
      }
    },
    [gameId, modToken, players, show]
  );

  // ---------------------------------------------------------------------------
  // GAME
  // ---------------------------------------------------------------------------

  const endGame = useCallback(async () => {
    try {
      await modSetGameStatus(gameId, modToken, 'ended');
      show('Game ended!', 'info');
      onGameEnded();
    } catch {
      show('Failed to end game', 'error');
    }
  }, [gameId, modToken, show, onGameEnded]);

  const toggleMute = () => {
    const next = !muted;

    setMuted(next);
    setMutedState(next);

    show(next ? 'Sound muted' : 'Sound on', 'info');
  };

  const copyLink = () => {
    navigator.clipboard
      .writeText(joinUrl)
      .then(() => show('Join link copied!', 'success'))
      .catch(() => show('Failed to copy join link', 'error'));
  };

  // ---------------------------------------------------------------------------
  // FULLSCREEN
  // ---------------------------------------------------------------------------

  const toggleFullscreen = useCallback(() => {
    const element = presentationRef.current;

    if (!element) {
      return;
    }

    if (!document.fullscreenElement) {
      element.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  /*
   * IMPORTANT FULLSCREEN LAYOUT FIX
   *
   * When fullscreen is exited, Chrome can briefly restore the flex layout
   * using the old fullscreen dimensions of the PDF canvas.
   *
   * The center column has min-w-0, but we also force several layout passes
   * here so the flex container and PDF viewer settle on their normal size.
   */
  useEffect(() => {
    const handleFullscreenChange = () => {
      const element = presentationRef.current;

      if (!element) {
        return;
      }

      const isFullscreen =
        document.fullscreenElement === element;

      /*
       * When leaving fullscreen, explicitly tell the browser that this
       * element belongs to the normal flex layout again.
       *
       * These are not permanent dimensions — they simply prevent a stale
       * fullscreen measurement from being retained during the transition.
       */
      if (!isFullscreen) {
        element.style.width = '100%';
        element.style.maxWidth = '100%';
        element.style.minWidth = '0';
      }

      /*
       * Force multiple layout/reflow passes.
       *
       * The first frame restores fullscreen CSS.
       * The second allows the flex layout to recalculate.
       * The third allows the PDF ResizeObserver to see the final size.
       */
      requestAnimationFrame(() => {
        void element.offsetWidth;

        requestAnimationFrame(() => {
          void element.offsetWidth;

          requestAnimationFrame(() => {
            void element.offsetWidth;

            /*
             * Trigger a resize event for anything depending on the
             * browser viewport/layout dimensions.
             */
            window.dispatchEvent(new Event('resize'));
          });
        });
      });
    };

    document.addEventListener(
      'fullscreenchange',
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        'fullscreenchange',
        handleFullscreenChange
      );
    };
  }, []);

  // ---------------------------------------------------------------------------
  // KEYBOARD SHORTCUTS
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      if (
        target &&
        (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable
        )
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          void goPrev();
          break;

        case 'ArrowRight':
          e.preventDefault();
          void goNext();
          break;

        case ' ':
          e.preventDefault();
          void goNext();
          break;

        case 'b':
        case 'B':
          e.preventDefault();
          void enableBuzzer();
          break;

        case 'r':
        case 'R':
          e.preventDefault();
          void resetBuzzer();
          break;

        case 'd':
        case 'D':
          e.preventDefault();
          void disableBuzzer();
          break;

        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handler);

    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [
    goPrev,
    goNext,
    enableBuzzer,
    resetBuzzer,
    disableBuzzer,
    toggleFullscreen,
  ]);

  // ---------------------------------------------------------------------------
  // BUZZER SOUND
  // ---------------------------------------------------------------------------

  const prevWinnerRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      game?.buzzer_status === 'locked' &&
      game.buzzer_winner_player_id &&
      !muted
    ) {
      if (
        prevWinnerRef.current !==
        game.buzzer_winner_player_id
      ) {
        playBuzzWin();

        prevWinnerRef.current =
          game.buzzer_winner_player_id;
      }
    } else if (game?.buzzer_status !== 'locked') {
      prevWinnerRef.current = null;
    }
  }, [
    game?.buzzer_status,
    game?.buzzer_winner_player_id,
        muted,
  ]);

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-gradient-game flex flex-col">

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 md:px-6 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-400" />
          <span className="text-white font-bold text-sm md:text-lg">
            JEOPARDY NIGHT
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm font-mono">
            ROOM {session.roomCode}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ConnectionIndicator
            status={connectionStatus}
            compact
          />

          <span className="text-slate-400 text-sm hidden md:inline">
            {connectedCount}/{players.length} connected
          </span>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 min-w-0 flex flex-col lg:flex-row gap-3 p-3 overflow-hidden">

        {/* LEFT */}
        <aside className="lg:w-72 flex-shrink-0 flex flex-col gap-3 order-2 lg:order-1">

          {/* Presentation controls */}
          <div className="glass rounded-2xl p-3">
            <h3 className="text-amber-400 text-xs font-bold tracking-wider uppercase mb-2">
              Presentation
            </h3>

            <div className="flex items-center justify-center gap-2 mb-2">

              <button
                onClick={() => void goPrev()}
                disabled={game.current_slide <= 1}
                className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg font-semibold text-sm transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>

              <span className="text-slate-300 font-mono text-sm px-2">
                {game.current_slide} /{' '}
                {game.presentation_total_pages || '?'}
              </span>

              <button
                onClick={() => void goNext()}
                disabled={
                  game.presentation_total_pages
                    ? game.current_slide >=
                      game.presentation_total_pages
                    : false
                }
                className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg font-semibold text-sm transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">

              <button
                onClick={toggleFullscreen}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Fullscreen
              </button>

              <button
                onClick={() => setShowShortcuts(true)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
              >
                <Keyboard className="w-3.5 h-3.5" />
                Shortcuts
              </button>

            </div>
          </div>

          {/* Buzzer */}
          <div className="glass rounded-2xl p-3">
            <h3 className="text-amber-400 text-xs font-bold tracking-wider uppercase mb-2">
              Buzzer
            </h3>

            <div className="flex flex-col gap-2">

              {game.buzzer_status === 'enabled' ? (
                <button
                  onClick={() => void disableBuzzer()}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-sm transition-colors"
                >
                  <ZapOff className="w-4 h-4" />
                  Disable Buzzer
                </button>
              ) : (
                <button
                  onClick={() => void enableBuzzer()}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-sm transition-colors animate-pulse-glow"
                >
                  <Zap className="w-4 h-4" />
                  ENABLE BUZZERS
                </button>
              )}

              <button
                onClick={() => void resetBuzzer()}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-sm transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Buzzer
              </button>

            </div>
          </div>

          {/* Scores */}
          <div className="glass rounded-2xl p-3">
            <h3 className="text-amber-400 text-xs font-bold tracking-wider uppercase mb-2">
              Scores
            </h3>

            <div className="flex flex-col gap-2">

              {players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 min-w-0"
                >
                  <span className="text-white text-sm font-medium flex-1 min-w-0 truncate whitespace-nowrap pr-1">
                    {p.player_name}
                  </span>

                  <span className="text-amber-400 text-sm font-bold tabular-nums w-16 flex-shrink-0 text-right">
                    ${p.score}
                  </span>

                  <button
                    onClick={() =>
                      void adjustScore(p.id, -100)
                    }
                    className="p-1.5 flex-shrink-0 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                    title="-100"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() =>
                      void adjustScore(p.id, 100)
                    }
                    className="p-1.5 flex-shrink-0 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                    title="+100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() =>
                      setScoreAdjustPlayer(p.id)
                    }
                    className="px-2 py-1.5 flex-shrink-0 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                    title="Custom amount"
                  >
                    Custom
                  </button>
                </div>
              ))}

              {players.length === 0 && (
                <p className="text-slate-600 text-sm text-center py-2">
                  No players yet
                </p>
              )}

            </div>
          </div>

          {/* Game controls */}
          <div className="glass rounded-2xl p-3">
            <h3 className="text-amber-400 text-xs font-bold tracking-wider uppercase mb-2">
              Game
            </h3>

            <div className="flex flex-col gap-2">

              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-sm transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy Join Link
              </button>

              <button
                onClick={toggleMute}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-sm transition-colors"
              >
                {muted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}

                {muted ? 'Unmute' : 'Mute'}
              </button>

              <button
                onClick={() => setConfirmEnd(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                <Trophy className="w-4 h-4" />
                End Game
              </button>

              <button
                onClick={() => setConfirmLeave(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-red-400 rounded-xl font-semibold text-sm transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Leave
              </button>

            </div>
          </div>
        </aside>

        {/* CENTER */}
        <main className="flex-1 min-w-0 min-h-0 w-full max-w-full flex flex-col gap-3 order-1 lg:order-2">

          {/*
           * IMPORTANT:
           *
           * min-w-0 prevents the PDF canvas from forcing this flex item
           * to keep its old fullscreen width after exiting fullscreen.
           *
           * overflow-hidden prevents any stale canvas dimensions from
           * visually extending into the right sidebar.
           */}
          <div
            ref={presentationRef}
            className="flex-1 w-full max-w-full min-w-0 min-h-[300px] lg:min-h-0 overflow-hidden"
          >
            {game.presentation_path ? (
              <PresentationViewer
                path={game.presentation_path}
                currentPage={game.current_slide}
                totalPages={game.presentation_total_pages}
                fullscreenRef={presentationRef}
                showFullscreenButton
                onPageChange={handlePresentationPageChange}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-2xl border border-slate-700">
                <div className="text-center">
                  <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                  <p className="text-slate-400">
                    No presentation uploaded
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Buzzer status */}
          <div className="flex-shrink-0 min-w-0">

                        <BuzzerStatus
              buzzerStatus={game.buzzer_status}
              buzzOrder={game.buzz_order}
              players={players}
            />

            {game.buzz_order.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                {game.buzz_order.map((buzzPlayerId, index) => {
                  const p = players.find((pl) => pl.id === buzzPlayerId);

                  if (!p) return null;

                  return (
                    <div key={buzzPlayerId} className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs w-16 flex-shrink-0 truncate">
                        {index + 1}. {p.player_name}
                      </span>

                      <button
                        onClick={() =>
                          void adjustScore(p.id, 100)
                        }
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        +100
                      </button>

                      <button
                        onClick={() =>
                          void adjustScore(p.id, -100)
                        }
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        -100
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </main>

        {/* RIGHT */}
        <aside className="lg:w-56 flex-shrink-0 flex flex-col gap-3 order-3 min-w-0">

          <div className="glass rounded-2xl p-3">

            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-blue-400" />

              <h3 className="text-white font-bold text-sm">
                Players
              </h3>

                <span className="text-slate-500 text-xs">
                ({players.length}/8)
              </span>
            </div>

            <PlayerList
              players={players}
              onRemovePlayer={async (pid) => {
                try {
                  await modRemovePlayer(
                    gameId,
                    modToken,
                    pid
                  );

                  show('Player removed', 'info');
                  refetch();
                } catch {
                  show('Failed to remove player', 'error');
                }
              }}
              showRemove
            />

          </div>

                    <Scoreboard
            players={players}
            highlightPlayerId={
              game.buzzer_winner_player_id
            }
            title="Scoreboard"
          />

          <div className="glass rounded-2xl p-3 flex flex-col h-72">
            <h3 className="text-white font-bold text-sm mb-2 flex-shrink-0">
              Chat
            </h3>
            <div className="flex-1 min-h-0">
              <Chat
                gameId={gameId}
                senderToken={modToken}
                selfName={session.moderatorName}
                selfType="moderator"
              />
            </div>
          </div>

        </aside>
      </div>

      {/* Keyboard shortcuts */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="flex items-center justify-between mb-4">

              <h3 className="text-white font-bold text-lg">
                Keyboard Shortcuts
              </h3>

              <button
                onClick={() => setShowShortcuts(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <div className="flex flex-col gap-2 text-sm">

              {[
                { key: '←', desc: 'Previous slide' },
                { key: '→ / Space', desc: 'Next slide' },
                { key: 'B', desc: 'Enable buzzers' },
                { key: 'R', desc: 'Reset buzzer' },
                { key: 'D', desc: 'Disable buzzer' },
                { key: 'F', desc: 'Fullscreen presentation' },
              ].map((s) => (
                <div
                  key={s.key}
                  className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0"
                >
                  <span className="text-slate-400">
                    {s.desc}
                  </span>

                  <kbd className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white font-mono text-xs">
                    {s.key}
                  </kbd>
                </div>
              ))}

            </div>
          </div>
        </div>
      )}

      {/* Custom score */}
      {scoreAdjustPlayer && (
        <CustomScoreDialog
          player={players.find(
            (p) => p.id === scoreAdjustPlayer
          )}
          amount={customAmount}
          setAmount={setCustomAmount}
          onConfirm={() => {
            const amt = parseInt(customAmount, 10);

            if (!isNaN(amt) && amt !== 0) {
              void adjustScore(
                scoreAdjustPlayer,
                amt
              );
            }

            setScoreAdjustPlayer(null);
            setCustomAmount('');
          }}
          onCancel={() => {
            setScoreAdjustPlayer(null);
            setCustomAmount('');
          }}
        />
      )}

      {/* End game */}
      <ConfirmationDialog
        open={confirmEnd}
        title="End the game?"
        message="This will end the game and show the final scoreboard to all players. This cannot be undone."
        confirmLabel="End Game"
        destructive
        onConfirm={endGame}
        onCancel={() => setConfirmEnd(false)}
      />

      {/* Leave */}
      <ConfirmationDialog
        open={confirmLeave}
        title="Leave the game?"
        message="You will exit the moderator dashboard. You can return by reopening the link."
        confirmLabel="Leave"
        destructive
        onConfirm={onLeave}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// CUSTOM SCORE DIALOG
// -----------------------------------------------------------------------------

function CustomScoreDialog({
  player,
  amount,
  setAmount,
  onConfirm,
  onCancel,
}: {
  player: Player | undefined;
  amount: string;
  setAmount: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!player) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >

        <h3 className="text-white font-bold text-lg mb-1">
          Adjust Score
        </h3>

        <p className="text-slate-400 text-sm mb-4">
          {player.player_name} — Current: ${player.score}
        </p>

        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 200 or -200"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onConfirm();
            }
          }}
          className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-lg font-mono focus:border-blue-500 focus:outline-none"
        />

        <div className="flex gap-2 mt-4">

          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500"
          >
            Apply
          </button>

        </div>
      </div>
    </div>
  );
}
