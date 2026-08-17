# Multiplayer Presentation Game — Handoff

## Current status

The game is now running successfully locally with Supabase.

Local app:
http://localhost:5174

Current test room:
LBXP

Current game:
- Game name: asd
- Moderator: dsa
- Status: lobby
- Presentation uploaded successfully
- Player joining works
- Moderator lobby works
- Player lobby works
- Game can start
- Player can transition into the game
- Supabase database functions are working

## Tech stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- Supabase Realtime
- PostgreSQL RPC functions

## Important Supabase configuration

Environment variables:

VITE_SUPABASE_URL=https://regmxofujouaxbkpcwzt.supabase.co
VITE_SUPABASE_ANON_KEY=...

IMPORTANT:
The VITE_SUPABASE_URL must NOT contain `/rest/v1/`.

Correct:
https://regmxofujouaxbkpcwzt.supabase.co

Incorrect:
https://regmxofujouaxbkpcwzt.supabase.co/rest/v1/

The Supabase client uses:

createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});

## Supabase RPC functions

Important functions currently used:

- create_game
- join_game
- mark_disconnect
- mod_set_game_status
- mod_remove_player
- heartbeat
- other game-related RPCs in gameApi.ts

The `join_game` function was fixed because PostgreSQL reported:

"column reference game_id is ambiguous"

The fixed function explicitly qualifies columns such as:

players.game_id

and returns:

v_game.id AS game_id

The current join_game function successfully allows players to join.

## Important debugging discovery

There was an infinite loading problem.

The database was actually returning the game correctly:

{
  id: "...",
  room_code: "LBXP",
  game_name: "asd",
  moderator_name: "dsa",
  game_status: "lobby",
  current_slide: 1,
  presentation_path: ".../presentation.pptx"
}

The app eventually correctly reached:

APP VIEW: player-lobby

and:

APP: player game status is lobby

So Supabase fetching itself was NOT the problem.

The loading issue was related to the React view/state flow.

## Current App.tsx architecture

AppContent has these views:

- landing
- create
- join
- moderator-lobby
- moderator-game
- moderator-ended
- player-lobby
- player-game
- player-ended
- loading

There are wrappers:

ModeratorGameWrapper
PlayerLobbyWrapper
PlayerGameWrapper

PlayerLobbyWrapper watches `useGame(session.gameId)` and changes to PlayerGameView when:

game.game_status === 'playing'

It changes to GameEndScreen when:

game.game_status === 'ended'

## Current hooks.ts architecture

useGame(gameId)

- fetches game
- subscribes to Supabase realtime changes on `games`
- filters by game id

usePlayers(gameId)

- fetches players
- subscribes to Supabase realtime changes on `players`

useHeartbeat(playerId, playerToken)

- immediately sends heartbeat
- repeats every 10 seconds
- attempts mark_disconnect on beforeunload

useConnectionStatus()

- monitors Supabase channel connection
- also monitors browser online/offline status

## Current working flow

Moderator:

Create game
→ upload presentation
→ moderator lobby
→ players join
→ Start Game
→ moderator game

Player:

Join
→ enter room code
→ enter name
→ "YOU ARE IN"
→ player lobby
→ moderator starts
→ player game

## Current remaining issue

The game is working, BUT:

The presentation area in the middle of the game is blank.

Clicking the presentation area currently downloads the `.pptx` file instead of displaying the presentation inside the game.

This is the NEXT MAIN TASK.

We need to determine how presentations are supposed to be displayed.

The presentation path currently looks like:

fa9fdd1a-e37b-411d-b9dd-a761241aae03/presentation.pptx

The database has:

presentation_path
presentation_total_pages

Currently presentation_total_pages is null.

## Likely next task

Inspect:

- PlayerGameView.tsx
- ModeratorDashboard.tsx
- gameApi.ts
- presentation upload code
- Supabase Storage configuration
- any presentation rendering/conversion code

Determine whether the app expects:

1. browser-native PPTX rendering
2. conversion of PPTX → images
3. conversion of PPTX → PDF
4. server-side rendering
5. Microsoft/Google embed
6. a generated slide image system

Do NOT immediately rewrite everything.

First inspect the existing presentation-related code and identify the intended architecture.

## Important rule for future debugging

Work one problem at a time.

Before changing code:

1. Identify the exact failing component.
2. Add minimal console logging if necessary.
3. Confirm whether the problem is:
   - database
   - RPC
   - Supabase Storage
   - React state
   - routing
   - rendering
   - browser/network
4. Make the smallest fix possible.
5. Test it.
6. Only then move to the next issue.

## Current known-good behavior

DO NOT break these while fixing presentation display:

- game creation
- presentation upload
- room creation
- room code
- player joining
- player session
- moderator session
- player lobby
- moderator lobby
- realtime game status
- starting the game
- player transition from lobby → game

## Security note

Do NOT save or commit real Supabase secret/service-role keys.

The browser should only receive the Supabase anon/publishable key.

If any real secret/service-role key was ever pasted into chat, code, Git, or a public place, rotate it.

## Tomorrow's priority

1. Fix presentation display.
2. Make sure clicking the presentation does NOT simply download the PPTX.
3. Make the current slide visible in the moderator and/or player game view.
4. Make sure slide changes work.
5. Test with another uploaded presentation.
6. Then clean up console debugging logs.
7. Then fix any remaining UI or game-flow bugs.