import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Lock,
  Trophy,
} from 'lucide-react';

import type { BuzzerStatus, Player } from '@/lib/types';
import { claimBuzz } from '@/lib/gameApi';
import {
  playBuzzPress,
  playBuzzEnabled,
  playBuzzWin,
} from '@/lib/sound';

function ordinal(n: number): string {
  const rem100 = n % 100;

  if (rem100 >= 11 && rem100 <= 13) return `${n}TH`;

  switch (n % 10) {
    case 1:
      return `${n}ST`;
    case 2:
      return `${n}ND`;
    case 3:
      return `${n}RD`;
    default:
      return `${n}TH`;
  }
}

interface BuzzerProps {
  gameId: string;
  playerId: string;
  playerToken: string;
  playerName: string;
  playerNumber: number;
  buzzerStatus: BuzzerStatus;
  winnerPlayerId: string | null;
  buzzOrder: string[];
  players: Player[];
  soundEnabled: boolean;
  compact?: boolean;
}

export function Buzzer({
  gameId,
  playerId,
  playerToken,
  playerName,
  playerNumber,
  buzzerStatus,
  winnerPlayerId,
  buzzOrder,
  players,
  soundEnabled,
  compact = false,
}: BuzzerProps) {
  const BUZZER_SIZE = compact
    ? 'w-20 h-20 sm:w-24 sm:h-24'
    : 'w-28 h-28 sm:w-36 sm:h-36';

  const [buzzing, setBuzzing] = useState(false);
  const [buzzSent, setBuzzSent] = useState(false);

  const [myRank, setMyRank] = useState<number | null>(null);

  const [showResultNotification, setShowResultNotification] =
    useState(false);

  const lastBuzzRef = useRef(0);

  const playedWinSoundRef = useRef(false);

  const notifiedWinnerRef = useRef<string | null>(null);

  useEffect(() => {
    if (soundEnabled && buzzerStatus === 'enabled') {
      playBuzzEnabled();
    }
  }, [buzzerStatus, soundEnabled]);

  useEffect(() => {
    if (buzzerStatus === 'disabled') {
      setBuzzSent(false);
      setMyRank(null);
      setShowResultNotification(false);

      playedWinSoundRef.current = false;
      notifiedWinnerRef.current = null;
    }
  }, [buzzerStatus]);

  const alreadyBuzzed =
    buzzSent || buzzOrder.includes(playerId);

  const effectiveMyRank =
    myRank ??
    (buzzOrder.includes(playerId)
      ? buzzOrder.indexOf(playerId) + 1
      : null);

  const winner = players.find(
    (p) => p.id === winnerPlayerId
  );

  const isWinner =
    effectiveMyRank === 1;

  const enabled =
    buzzerStatus !== 'disabled' &&
    !alreadyBuzzed;

  useEffect(() => {
    if (
      soundEnabled &&
      isWinner &&
      !playedWinSoundRef.current
    ) {
      playBuzzWin();
      playedWinSoundRef.current = true;
    }
  }, [
    soundEnabled,
    isWinner,
  ]);

  const triggerResultNotification = useCallback(() => {
    if (!winnerPlayerId) return;

    if (
      notifiedWinnerRef.current === winnerPlayerId
    ) {
      return;
    }

    notifiedWinnerRef.current =
      winnerPlayerId;

    setShowResultNotification(true);
  }, [winnerPlayerId]);

  const dismissResultNotification = useCallback(() => {
    setShowResultNotification(false);
  }, []);

  useEffect(() => {
    if (
      buzzerStatus === 'locked' &&
      winnerPlayerId
    ) {
      triggerResultNotification();
    }
  }, [
    buzzerStatus,
    winnerPlayerId,
    triggerResultNotification,
  ]);

  const handleBuzz = useCallback(async () => {
    if (
      !enabled ||
      buzzing ||
      buzzSent
    ) {
      return;
    }

    const now = Date.now();

    if (
      now - lastBuzzRef.current < 500
    ) {
      return;
    }

    lastBuzzRef.current = now;

    setBuzzing(true);
    setBuzzSent(true);

    if (soundEnabled) {
      playBuzzPress();
    }

    try {
      const result = await claimBuzz(
        gameId,
        playerId,
        playerToken
      );

      setMyRank(result.rank);
    } catch (error) {
      console.error(
        'Buzzer claim failed:',
        error
      );

      setBuzzSent(false);
    } finally {
      setBuzzing(false);
    }
  }, [
    enabled,
    buzzing,
    buzzSent,
    soundEnabled,
    gameId,
    playerId,
    playerToken,
  ]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.code !== 'Space' &&
        e.key !== ' '
      ) {
        return;
      }

      const target =
        e.target as HTMLElement | null;

      const tag = target?.tagName;

      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        tag === 'A'
      ) {
        return;
      }

      if (target?.isContentEditable) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (e.repeat) {
        return;
      }

      handleBuzz();
    };

    window.addEventListener(
      'keydown',
      handler,
      true
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handler,
        true
      );
    };
  }, [handleBuzz]);

  const resultNotification =
    showResultNotification &&
    winnerPlayerId &&
    winner ? (
      <div
        onClick={dismissResultNotification}
        className="
          absolute
          inset-0
          z-[999999]
          flex
          items-center
          justify-center
          pointer-events-auto
          cursor-pointer
          px-4
        "
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

        {/* Result card */}
        <div
          className={`
            relative
            w-full
            max-w-3xl
            rounded-3xl
            border-4
            p-8
            sm:p-12
            text-center
            shadow-2xl
            animate-in
            zoom-in-95
            duration-200
            ${
              isWinner
                ? `
                  bg-emerald-950/95
                  border-emerald-400
                  shadow-emerald-500/40
                `
                : `
                  bg-slate-950/95
                  border-amber-400/70
                  shadow-amber-500/30
                `
            }
          `}
        >
          {isWinner ? (
            <>
              <Trophy
                className="
                  w-16
                  h-16
                  sm:w-24
                  sm:h-24
                  text-amber-300
                  mx-auto
                  mb-5
                  animate-bounce
                "
              />

              <p
                className="
                  text-emerald-300
                  font-black
                  text-4xl
                  sm:text-7xl
                  tracking-tight
                  text-glow-gold
                "
              >
                YOU BUZZED FIRST!
              </p>

              <p
                className="
                  mt-4
                  text-white
                  text-xl
                  sm:text-3xl
                  font-bold
                "
              >
                You were the fastest!
              </p>
            </>
          ) : (
            <>
              <XCircle
                className="
                  w-16
                  h-16
                  sm:w-24
                  sm:h-24
                  text-red-400
                  mx-auto
                  mb-5
                "
              />

              <p
                className="
                  text-red-300
                  font-black
                  text-4xl
                  sm:text-7xl
                  tracking-tight
                "
              >
                TOO SLOW!
              </p>

              <p
                className="
                  mt-5
                  text-white
                  text-xl
                  sm:text-3xl
                  font-bold
                "
              >
                <span className="text-amber-300">
                  {winner.player_name}
                </span>{' '}
                buzzed first!
              </p>

              <p
                className="
                  mt-3
                  text-slate-400
                  text-base
                  sm:text-xl
                "
              >
                Player {winner.player_number}
              </p>
            </>
          )}

          <p className="mt-6 text-slate-500 text-sm">
            Tap anywhere to dismiss
          </p>
        </div>
      </div>
    ) : null;

  const fullscreenNotificationHost =
    typeof document !== 'undefined'
      ? document.getElementById(
          'buzzer-fullscreen-notification'
        )
      : null;

  const fullscreenNotification =
    fullscreenNotificationHost &&
    resultNotification
      ? createPortal(
          resultNotification,
          fullscreenNotificationHost
        )
      : null;

  if (buzzerStatus === 'disabled') {
    return (
      <>
        {fullscreenNotification}

        <div className="w-full flex flex-col items-center gap-2 py-3">
          <div
            className={`
              ${BUZZER_SIZE}
              flex
              items-center
              justify-center
              rounded-full
              bg-slate-800/50
              border-4
              border-slate-700
              no-select
            `}
          >
            <div className="text-center px-2">
              <Lock className="w-6 h-6 text-slate-600 mx-auto mb-1" />

              <p className="text-slate-500 font-bold text-xs sm:text-sm leading-tight">
                BUZZER DISABLED
              </p>
            </div>
          </div>

          <p className="text-slate-600 text-xs">
            Wait for the host to enable buzzers
          </p>
        </div>
      </>
    );
  }

  if (alreadyBuzzed) {
    if (isWinner) {
      return (
        <>
          {fullscreenNotification}

          <div className="w-full flex flex-col items-center gap-2 py-3 animate-celebrate">
            <div
              className={`
                ${BUZZER_SIZE}
                flex
                items-center
                justify-center
                rounded-full
                bg-emerald-500/20
                border-4
                border-emerald-500
                no-select
                animate-pulse-glow
              `}
            >
              <div className="text-center px-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1" />

                <p className="text-emerald-300 font-black text-sm sm:text-base text-glow-gold leading-tight">
                  YOU BUZZED FIRST!
                </p>
              </div>
            </div>

            <p className="text-emerald-400/70 text-xs">
              Wait for the host
            </p>
          </div>
        </>
      );
    }

    return (
      <>
        {fullscreenNotification}

        <div className="w-full flex flex-col items-center gap-2 py-3">
          <div
            className={`
              ${BUZZER_SIZE}
              flex
              items-center
              justify-center
              rounded-full
              bg-blue-500/10
              border-4
              border-blue-500/50
              no-select
            `}
          >
            <div className="text-center px-2">
              <p className="text-blue-300 font-black text-lg sm:text-xl leading-tight">
                {effectiveMyRank ? ordinal(effectiveMyRank) : '—'}
              </p>
            </div>
          </div>

          <p className="text-blue-400/70 text-xs">
            {winner && winner.id !== playerId
              ? `${winner.player_name} buzzed first`
              : 'Wait for the host'}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {fullscreenNotification}

      <div className="w-full flex flex-col items-center gap-2 py-3">
        <div className="text-center mb-1">
          <p className="text-amber-400 font-bold text-sm sm:text-base tracking-wider animate-pulse">
            {buzzOrder.length > 0 ? 'YOU CAN STILL BUZZ' : 'QUESTION IS ACTIVE'}
          </p>

          <p className="text-slate-400 text-xs">
            {buzzOrder.length > 0
              ? `${buzzOrder.length} player(s) already buzzed`
              : 'Wait for it... then BUZZ! (or press SPACE)'}
          </p>
        </div>

        <button
          onClick={handleBuzz}
          disabled={buzzing || buzzSent}
          className={`
            ${BUZZER_SIZE}
            rounded-full
            border-4
            no-select
            transition-all
            active:scale-95
            ${
              buzzSent
                ? `
                  bg-slate-800
                  border-slate-600
                  cursor-not-allowed
                `
                : `
                  bg-gradient-to-b
                  from-red-500
                  to-red-700
                  border-red-400
                  hover:from-red-400
                  hover:to-red-600
                  animate-pulse-glow
                  active:animate-shake
                `
            }
          `}
        >
          <div className="text-center px-1">
            {buzzing ? (
              <Loader2 className="w-8 h-8 text-white mx-auto animate-spin" />
            ) : buzzSent ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto mb-1" />

                <p className="text-slate-400 font-black text-sm sm:text-base">
                  BUZZ SENT
                </p>
              </>
            ) : (
              <>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/20 mx-auto mb-1 flex items-center justify-center">
                  <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/30" />
                </div>

                <p className="text-white font-black text-lg sm:text-xl text-glow-red">
                  BUZZ
                </p>
              </>
            )}
          </div>
        </button>

        <p className="text-slate-500 text-xs">
          Player {playerNumber} — {playerName}
        </p>
      </div>
    </>
  );
}

interface BuzzerStatusProps {
  buzzerStatus: BuzzerStatus;
  buzzOrder: string[];
  players: Player[];
}

export function BuzzerStatus({
  buzzerStatus,
  buzzOrder,
  players,
}: BuzzerStatusProps) {
  if (buzzerStatus === 'disabled') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl">
        <Lock className="w-5 h-5 text-slate-500" />

        <span className="text-slate-400 font-semibold">
          Buzzer Disabled
        </span>
      </div>
    );
  }

  if (buzzOrder.length === 0) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/40 rounded-xl animate-pulse">
        <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />

        <span className="text-amber-400 font-bold">
          Buzzers Enabled — Waiting for buzz...
        </span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/40 rounded-xl animate-celebrate">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />

        <span className="text-emerald-300 font-bold text-sm">
          Buzz order
        </span>
      </div>

      <ol className="flex flex-col gap-1">
        {buzzOrder.map((playerId, index) => {
          const p = players.find((pl) => pl.id === playerId);

          return (
            <li
              key={playerId}
              className={`flex items-center gap-2 text-sm ${
                index === 0
                  ? 'text-emerald-300 font-bold'
                  : 'text-slate-300'
              }`}
            >
              <span className="w-5 text-right tabular-nums">
                {index + 1}.
              </span>

              <span>{p ? p.player_name : 'Unknown player'}</span>

              {p && (
                <span className="text-slate-500 text-xs">
                  (P{p.player_number})
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
