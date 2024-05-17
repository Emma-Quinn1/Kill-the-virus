export {};

export interface Player {
  id: string;
  playerName: string;
  roomId: string;
  wonRounds?: number;
  flicker?: boolean;
  reactionTime?: number;
  isTie?: boolean;
}

export interface Room {
  name: string;
  playerCount: number;
  finishedGame?: boolean;
}

export interface PlayerTotalReactionTime {
  playerId: string;
  totalReactionTime: number;
}
