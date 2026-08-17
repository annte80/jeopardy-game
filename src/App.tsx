import { useState, useEffect, useCallback } from 'react';

import { ToastProvider } from './components/Toast';
import { LandingPage } from './components/LandingPage';
import { CreateGame } from './components/CreateGame';
import { JoinGame } from './components/JoinGame';
import {
  ModeratorLobby,
  PlayerLobby,
} from './components/GameLobby';
import { ModeratorDashboard } from './components/ModeratorDashboard';
import { PlayerGameView } from './components/PlayerGameView';
import { GameEndScreen } from './components/GameEndScreen';
import { LoadingScreen } from './components/ConfirmationDialog';

import { useGame } from './lib/hooks';

import {
  getModeratorSession,
  clearModeratorSession,
  getPlayerSession,
  clearPlayerSession,
  fetchGame,
  markDisconnect,
} from './lib/gameApi';

import type {
  ModeratorSession,
  PlayerSession,
} from './lib/types';

type View =
  | 'landing'
  | 'create'
  | 'join'
  | 'moderator-lobby'
  | 'moderator-game'
  | 'moderator-ended'
  | 'player-lobby'
  | 'player-game'
  | 'player-ended'
  | 'loading';

function AppContent() {
  const [view, setView] = useState<View>('loading');

  const [modSession, setModSession] =
    useState<ModeratorSession | null>(null);

  const [playerSession, setPlayerSession] =
    useState<PlayerSession | null>(null);

  const [joinRoomCode, setJoinRoomCode] = useState('');

  const updateUrl = useCallback((path: string) => {
    window.history.pushState({}, '', path);
  }, []);

  // Debug
  useEffect(() => {
    console.log('APP VIEW:', view);
  }, [view]);

  // ---------- Restore moderator ----------

  const restoreModeratorView = useCallback(
    async (mod: ModeratorSession) => {
      console.log('APP: restoring moderator', mod);

      setModSession(mod);

      try {
        const g = await fetchGame(mod.gameId);

        console.log('APP: moderator game fetched', g);

        if (!g) {
          clearModeratorSession();
          setModSession(null);
          setView('landing');
          return;
        }

        console.log(
          'APP: moderator game status is',
          g.game_status
        );

        if (g.game_status === 'lobby') {
          setView('moderator-lobby');
        } else if (g.game_status === 'playing') {
          setView('moderator-game');
        } else if (g.game_status === 'ended') {
          setView('moderator-ended');
        }
      } catch (e) {
        console.error(
          'APP: failed restoring moderator',
          e
        );

        setView('moderator-lobby');
      }
    },
    []
  );

  // ---------- Restore player ----------

  const restorePlayerView = useCallback(
    async (player: PlayerSession) => {
      console.log('APP: restoring player', player);

      setPlayerSession(player);

      try {
        const g = await fetchGame(player.gameId);

        console.log('APP: player game fetched', g);

        if (!g) {
          clearPlayerSession();
          setPlayerSession(null);
          setView('landing');
          return;
        }

        console.log(
          'APP: player game status is',
          g.game_status
        );

        if (g.game_status === 'lobby') {
          console.log('APP: going to player-lobby');
          setView('player-lobby');
        } else if (g.game_status === 'playing') {
          console.log('APP: going to player-game');
          setView('player-game');
        } else if (g.game_status === 'ended') {
          console.log('APP: going to player-ended');
          setView('player-ended');
        }
      } catch (e) {
        console.error(
          'APP: failed restoring player',
          e
        );

        setView('player-lobby');
      }
    },
    []
  );

  // ---------- Resolve URL ----------

  const resolveInitialRoute = useCallback(async () => {
    const path = window.location.pathname;

    console.log('APP: resolving route', path);

    // Create
    if (path === '/create') {
      setView('create');
      return;
    }

    // Join
    if (path === '/join') {
      setView('join');
      return;
    }

    // Join with room code
    const joinMatch = path.match(/^\/join\/(\w{4})$/i);

    if (joinMatch) {
      setJoinRoomCode(
        joinMatch[1].toUpperCase()
      );

      setView('join');
      return;
    }

    // Moderator session
    const mod = getModeratorSession();

    if (mod) {
      console.log('APP: moderator session found');

      const hostMatch =
        path.match(/^\/host\/(\w{4})$/i);

      if (
        hostMatch &&
        hostMatch[1].toUpperCase() !== mod.roomCode
      ) {
        updateUrl(`/host/${mod.roomCode}`);
      } else if (!hostMatch) {
        updateUrl(`/host/${mod.roomCode}`);
      }

      await restoreModeratorView(mod);
      return;
    }

    // Player session
    const player = getPlayerSession();

    if (player) {
      console.log('APP: player session found');

      const playMatch =
        path.match(/^\/play\/(\w{4})$/i);

      if (
        playMatch &&
        playMatch[1].toUpperCase() !== player.roomCode
      ) {
        updateUrl(`/play/${player.roomCode}`);
      } else if (!playMatch) {
        updateUrl(`/play/${player.roomCode}`);
      }

      await restorePlayerView(player);
      return;
    }

    // Direct /play/ROOM without session
    const playMatch =
      path.match(/^\/play\/(\w{4})$/i);

    if (playMatch) {
      setJoinRoomCode(
        playMatch[1].toUpperCase()
      );

      setView('join');
      return;
    }

    // Invalid host route
    if (path.match(/^\/host\/(\w{4})$/i)) {
      updateUrl('/');
    }

    setView('landing');
  }, [
    restoreModeratorView,
    restorePlayerView,
    updateUrl,
  ]);

  // ---------- Initial route ----------

  useEffect(() => {
    resolveInitialRoute();
  }, [resolveInitialRoute]);

  // ---------- Browser back/forward ----------

  useEffect(() => {
    const handlePopState = () => {
      resolveInitialRoute();
    };

    window.addEventListener(
      'popstate',
      handlePopState
    );

    return () => {
      window.removeEventListener(
        'popstate',
        handlePopState
      );
    };
  }, [resolveInitialRoute]);

  // ---------- Landing ----------

  const handleCreateGame = () => {
    setView('create');
    updateUrl('/create');
  };

  const handleJoinGame = () => {
    setJoinRoomCode('');
    setView('join');
    updateUrl('/join');
  };

  // ---------- Create ----------

  const handleGameCreated = (
    session: ModeratorSession
  ) => {
    console.log(
      'APP: game created',
      session
    );

    setModSession(session);
    setView('moderator-lobby');

    updateUrl(`/host/${session.roomCode}`);
  };

  // ---------- Start game ----------

  const handleStartGame = () => {
    console.log('APP: moderator starting game');
    setView('moderator-game');
  };

  // ---------- Game ended ----------

  const handleGameEnded = () => {
    setView('moderator-ended');
  };

  // ---------- Player joined ----------

  const handlePlayerJoined = (
    session: PlayerSession
  ) => {
    console.log(
      'APP: player joined',
      session
    );

    setPlayerSession(session);
    setView('player-lobby');

    updateUrl(`/play/${session.roomCode}`);
  };

  // ---------- Moderator leave ----------

  const handleModeratorLeave = () => {
    clearModeratorSession();
    setModSession(null);
    setView('landing');
    updateUrl('/');
  };

  // ---------- Player leave ----------

  const handlePlayerLeave = () => {
    if (playerSession) {
      markDisconnect(
        playerSession.playerId,
        playerSession.playerToken
      );
    }

    clearPlayerSession();
    setPlayerSession(null);

    setView('landing');
    updateUrl('/');
  };

  // ---------- New game ----------

  const handleNewGame = () => {
    clearModeratorSession();
    setModSession(null);

    setView('create');
    updateUrl('/create');
  };

  // ---------- Render ----------

  switch (view) {
    case 'loading':
      return (
        <LoadingScreen
          message="Connecting to game..."
        />
      );

    case 'landing':
      return (
        <LandingPage
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
        />
      );

    case 'create':
      return (
        <CreateGame
          onBack={() => {
            setView('landing');
            updateUrl('/');
          }}
          onCreated={handleGameCreated}
        />
      );

    case 'join':
      return (
        <JoinGame
          initialRoomCode={joinRoomCode}
          onBack={() => {
            setView('landing');
            updateUrl('/');
          }}
          onJoined={handlePlayerJoined}
        />
      );

    case 'moderator-lobby':
      if (!modSession) {
        return (
          <LoadingScreen
            message="Reconnecting to game..."
          />
        );
      }

      return (
        <ModeratorLobby
          session={modSession}
          onStart={handleStartGame}
          onLeave={handleModeratorLeave}
        />
      );

    case 'moderator-game':
      if (!modSession) {
        return (
          <LoadingScreen
            message="Reconnecting to game..."
          />
        );
      }

      return (
        <ModeratorGameWrapper
          session={modSession}
          onGameEnded={handleGameEnded}
          onLeave={handleModeratorLeave}
        />
      );

    case 'moderator-ended':
      if (!modSession) {
        return (
          <LoadingScreen
            message="Reconnecting..."
          />
        );
      }

      return (
        <GameEndScreen
          gameId={modSession.gameId}
          gameName={modSession.gameName}
          roomCode={modSession.roomCode}
          isModerator
          onNewGame={handleNewGame}
          onLeave={handleModeratorLeave}
        />
      );

    case 'player-lobby':
      if (!playerSession) {
        return (
          <LoadingScreen
            message="Reconnecting to game..."
          />
        );
      }

      return (
        <PlayerLobbyWrapper
          session={playerSession}
          onLeave={handlePlayerLeave}
        />
      );

    case 'player-game':
      if (!playerSession) {
        return (
          <LoadingScreen
            message="Reconnecting to game..."
          />
        );
      }

      return (
        <PlayerGameWrapper
          session={playerSession}
          onLeave={handlePlayerLeave}
        />
      );

    case 'player-ended':
      if (!playerSession) {
        return (
          <LoadingScreen
            message="Reconnecting..."
          />
        );
      }

      return (
        <GameEndScreen
          gameId={playerSession.gameId}
          gameName="Jeopardy Night"
          roomCode={playerSession.roomCode}
          isModerator={false}
          onLeave={handlePlayerLeave}
        />
      );

    default:
      return (
        <LoadingScreen message="Loading..." />
      );
  }
}

// =====================================================
// MODERATOR GAME WRAPPER
// =====================================================

function ModeratorGameWrapper({
  session,
  onGameEnded,
  onLeave,
}: {
  session: ModeratorSession;
  onGameEnded: () => void;
  onLeave: () => void;
}) {
  const { game, loading } = useGame(session.gameId);

  useEffect(() => {
    if (game?.game_status === 'ended') {
      onGameEnded();
    }
  }, [
    game?.game_status,
    onGameEnded,
  ]);

  if (loading || !game) {
    return (
      <LoadingScreen message="Loading game..." />
    );
  }

  return (
    <ModeratorDashboard
      session={session}
      game={game}
      onGameEnded={onGameEnded}
      onLeave={onLeave}
    />
  );
}

// =====================================================
// PLAYER LOBBY WRAPPER
// =====================================================

function PlayerLobbyWrapper({
  session,
  onLeave,
}: {
  session: PlayerSession;
  onLeave: () => void;
}) {
  const { game, loading, error } =
    useGame(session.gameId);

  console.log('PLAYER LOBBY WRAPPER:', {
    loading,
    error,
    game,
  });

  // Game loading is handled here.
  if (loading && !game) {
    return (
      <LoadingScreen
        message="Loading game..."
      />
    );
  }

  if (error && !game) {
    return (
      <div className="min-h-screen bg-gradient-game flex items-center justify-center px-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">
            Could not load the game
          </h2>

          <p className="text-slate-400 mb-4">
            {error}
          </p>

          <button
            onClick={() => window.location.reload()}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <LoadingScreen
        message="Loading game..."
      />
    );
  }

  if (game.game_status === 'playing') {
    console.log(
      'PLAYER LOBBY: game started'
    );

    return (
      <PlayerGameView
        session={session}
        game={game}
        onLeave={onLeave}
      />
    );
  }

  if (game.game_status === 'ended') {
    return (
      <GameEndScreen
        gameId={session.gameId}
        gameName={
          game.game_name || 'Jeopardy Night'
        }
        roomCode={session.roomCode}
        isModerator={false}
        onLeave={onLeave}
      />
    );
  }

  return (
    <PlayerLobby
      session={session}
      onLeave={onLeave}
    />
  );
}

// =====================================================
// PLAYER GAME WRAPPER
// =====================================================

function PlayerGameWrapper({
  session,
  onLeave,
}: {
  session: PlayerSession;
  onLeave: () => void;
}) {
  const { game, loading } =
    useGame(session.gameId);

  console.log('PLAYER GAME WRAPPER:', {
    loading,
    game,
  });

  if (loading && !game) {
    return (
      <LoadingScreen
        message="Loading game..."
      />
    );
  }

  if (!game) {
    return (
      <LoadingScreen
        message="Loading game..."
      />
    );
  }

  if (game.game_status === 'ended') {
    return (
      <GameEndScreen
        gameId={session.gameId}
        gameName={
          game.game_name || 'Jeopardy Night'
        }
        roomCode={session.roomCode}
        isModerator={false}
        onLeave={onLeave}
      />
    );
  }

  if (game.game_status === 'lobby') {
    return (
      <PlayerLobby
        session={session}
        onLeave={onLeave}
      />
    );
  }

  return (
    <PlayerGameView
      session={session}
      game={game}
      onLeave={onLeave}
    />
  );
}

// =====================================================
// APP
// =====================================================

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}