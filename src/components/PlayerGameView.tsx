import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  LogOut,
  Crown,
} from 'lucide-react';

import {
  usePlayers,
  useHeartbeat,
  useConnectionStatus,
} from '@/lib/hooks';

import { PresentationViewer } from './PresentationViewer';
import { Buzzer } from './Buzzer';
import { Scoreboard } from './Scoreboard';
import { Chat } from './Chat';
import { ConnectionIndicator } from './ConnectionIndicator';
import { ConfirmationDialog } from './ConfirmationDialog';
import { setMuted, isMuted } from '@/lib/sound';

import type { PlayerSession, Game } from '@/lib/types';

interface PlayerGameViewProps {
  session: PlayerSession;
  game: Game;
  onLeave: () => void;
}

export function PlayerGameView({
  session,
  game,
  onLeave,
}: PlayerGameViewProps) {
  const { players } = usePlayers(session.gameId);
  const connectionStatus = useConnectionStatus();

  const [muted, setMutedState] = useState(isMuted());
  const [confirmLeave, setConfirmLeave] = useState(false);

  const presentationRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useHeartbeat(session.playerId, session.playerToken);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(
        document.fullscreenElement === presentationRef.current
      );
    };

    document.addEventListener('fullscreenchange', handler);

    return () => {
      document.removeEventListener('fullscreenchange', handler);
    };
  }, []);

  const toggleMute = () => {
    const next = !muted;

    setMuted(next);
    setMutedState(next);
  };

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== 'KeyF' &&
        event.key.toLowerCase() !== 'f'
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;

      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      ) {
        return;
      }

      if (target?.isContentEditable) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      toggleFullscreen();
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [toggleFullscreen]);

  const me = players.find((p) => p.id === session.playerId);

  return (
    <div className="min-h-screen bg-gradient-game flex flex-col">

      <header className="flex items-center justify-between px-3 py-2 md:px-4 md:py-3 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm flex-shrink-0">

        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400" />

          <span className="text-white font-bold text-sm md:text-base">
            {game.game_name}
          </span>
        </div>

        <div className="flex items-center gap-2">

          <ConnectionIndicator status={connectionStatus} compact />

          <button
            onClick={toggleMute}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            type="button"
          >
            {muted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={() => setConfirmLeave(true)}
            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
            type="button"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>
      </header>

      <div className="flex items-center justify-between px-3 py-2 md:px-4 bg-slate-900/40 border-b border-slate-800 flex-shrink-0">

        <div className="flex items-center gap-2">

          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold">
            {session.playerNumber}
          </span>

          <span className="text-white font-semibold text-sm">
            {session.playerName}
          </span>

        </div>

        <span className="text-amber-400 font-bold text-lg tabular-nums">
          ${me?.score || 0}
        </span>

      </div>

      <main className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">

        {/* LEFT: PRESENTATION / PDF */}

        <div
          ref={presentationRef}
          className="relative flex-1 min-h-0 bg-black"
        >

          {game.presentation_path ? (
            <PresentationViewer
              path={game.presentation_path}
              currentPage={game.current_slide}
              totalPages={game.presentation_total_pages}
              showFullscreenButton={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-slate-500">
                Waiting for presentation...
              </p>
            </div>
          )}

          <div
            id="buzzer-fullscreen-notification"
            className="absolute inset-0 pointer-events-none z-[99999]"
          />

          {!isFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="absolute top-2 right-2 p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors backdrop-blur-sm z-20"
              title="Fullscreen (F)"
              type="button"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}

          {isFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="absolute top-2 right-2 p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors backdrop-blur-sm z-[100000]"
              title="Exit fullscreen (F)"
              type="button"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          )}

        </div>

        {/* RIGHT SIDEBAR: SCORE / CHAT / BUZZER
            On phones the buzzer is ordered first (right under the
            presentation) since fast reaction time matters most there.
            On wider screens it sits at the bottom of the sidebar. */}

        <div className="w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col min-h-0 overflow-y-auto border-t md:border-t-0 md:border-l border-slate-800 bg-slate-950/30">

          <div className="order-1 md:order-3 flex-shrink-0 border-b md:border-b-0 md:border-t border-slate-800 px-3">
            <Buzzer
              gameId={session.gameId}
              playerId={session.playerId}
              playerToken={session.playerToken}
              playerName={session.playerName}
              playerNumber={session.playerNumber}
              buzzerStatus={game.buzzer_status}
              winnerPlayerId={game.buzzer_winner_player_id}
              buzzOrder={game.buzz_order}
              players={players}
              soundEnabled={!muted}
              compact
            />
          </div>

          <div className="order-2 md:order-1 flex-shrink-0 p-3">
            <Scoreboard
              players={players}
              highlightPlayerId={game.buzzer_winner_player_id}
              compact
              title="Scores"
            />
          </div>

                     <div className="h-56 md:h-auto md:flex-1 min-h-0 rounded-xl bg-slate-900/40 border border-slate-800 p-2">
              <Chat
                gameId={session.gameId}
                senderToken={session.playerToken}
                selfName={session.playerName}
                selfType="player"
              />
            </div>
          </div>

        </div>

      </main>

      <ConfirmationDialog
        open={confirmLeave}
        title="Leave the game?"
        message="You will exit the game. You can rejoin with the same room code if the game hasn't started yet."
        confirmLabel="Leave"
        destructive
        onConfirm={onLeave}
        onCancel={() => setConfirmLeave(false)}
      />

    </div>
  );
}
