export {};
import { Player, PlayerTotalReactionTime } from "./Models";

// Events emitted by the server to the client
export interface ServerToClientEvents {
  playerJoined: (playerName: string, roomSize: number) => void;
  opponentPlayerJoined: (playerName: string) => void;
  onlinePlayers: (players: Player[]) => void;
  startGame: () => void;
  randomiseDelay: () => void;
  handleVirusPosition: (cellPosition: number) => void;
  handleVirusClicked: () => void;
  updateScore: (players: Player[]) => void;
  gameEnded: () => void;
  updatePlayerTimes: (
    playerTotalReactionTime: PlayerTotalReactionTime,
    opponentTotalReactionTime: PlayerTotalReactionTime
  ) => void;
  resetTimer: () => void;
  playerLeft: (player: Player, finishedGame?: boolean) => void;
  playerTotalTime: (player: Player[]) => void;
  recentGamesRequest: (players: Player[]) => void;
  playersResult: (players: Player[], rounds: number) => void; 
}

// Events emitted by the client to the server
export interface ClientToServerEvents {
  playerJoinRequest: (
    playerName: string,
    roomName: string,
    callback: (response: PlayerjoinResponse) => void
  ) => void;
  virusPosition: () => void;
  virusClicked: (virusClickedTime: number, reachedMaxTime?: boolean) => void;
  requestOtherPlayerName: () => void;
  playAgainRequest: (
    id: string,
    callback: (response: PlayAgainResponse) => void
  ) => void;
  reactionTime: (time: number) => void;
}

export interface PlayerjoinResponse {
  success: boolean;
  players: Player[] | null;
  requestOtherPlayerName: () => void;
}
export interface PlayAgainResponse {
  player: Player | null;
}
