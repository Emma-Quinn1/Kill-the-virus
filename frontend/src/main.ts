import { io, Socket } from "socket.io-client";
import {
  ClientToServerEvents,
  PlayAgainResponse,
  PlayerjoinResponse,
  ServerToClientEvents,
} from "@shared/types/SocketTypes";
import "./assets/scss/style.scss";
import { Player, PlayerTotalReactionTime } from "@shared/types/Models";
const SOCKET_HOST = import.meta.env.VITE_SOCKET_HOST;

const playerNameFormEl = document.querySelector(
  "#playerNameForm"
) as HTMLFormElement;
const playerNameEl = document.querySelector("#playerName") as HTMLInputElement;
const startPageEl = document.querySelector("#startPage") as HTMLDivElement;
const lobbyEl = document.querySelector("#lobby") as HTMLDivElement;
const restartBtn = document.querySelector(
  "#quitGameAndRestartBtn"
) as HTMLElement;
const gamePageEl = document.querySelector("#gamePage") as HTMLDivElement;
const roundScoreEl = document.querySelector("#roundScore") as HTMLUListElement;
const playAgainBtnEl = document.querySelector(
  "#playAgainBtn"
) as HTMLButtonElement;
const showResult = document.querySelector("#resultPage") as HTMLDivElement;

let playerName: string | null = null;
let roomName: string | null = null;

// Connect to Socket.IO Server
const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
  io(SOCKET_HOST);

// Listen for when connection is established
socket.on("connect", () => {});

// Listen for when server got tired of us
socket.on("disconnect", () => {});

// Listen for when we're reconnected (either due to our or the servers connection)
socket.io.on("reconnect", () => {});

const lobbyView = () => {
  showResult.classList.add("hide");
  startPageEl.classList.add("hide");
  lobbyEl.classList.remove("hide");
};

playerNameFormEl.addEventListener("submit", (e) => {
  e.preventDefault();
  joinPlayer();
});

const joinPlayer = () => {
  playerName = playerNameEl.value.trim();
  roomName = generateRandomRoomName();

  if (!playerName) {
    return;
  }

  socket.emit(
    "playerJoinRequest",
    playerName,
    roomName,
    handlePlayerRequestCallback
  );
};

const handlePlayerRequestCallback = (response: PlayerjoinResponse) => {
  if (!response.success || !response.players) {
    return;
  }

  getOnlinePlayers(response.players);

  lobbyView();

  const playerElement = document.querySelector(
    "#firstPlayerName"
  ) as HTMLElement;
  if (playerElement) {
    playerElement.innerHTML = `<h5>${playerName}</h5>`;
  }
};

socket.on("onlinePlayers", (players) => {
  getOnlinePlayers(players);
});

socket.on("opponentPlayerJoined", (playerName) => {
  // Send notification to lobby that player has connected

  const otherPlayerElement = document.querySelector(
    "#opponentPlayerName"
  ) as HTMLElement;
  if (otherPlayerElement) {
    otherPlayerElement.innerHTML = `<h5>${playerName}</h5>`;
  }
});

const getOnlinePlayers = (players: Player[]) => {
  if (socket.id !== players[0].id) {
    players.reverse();
  }
  const playersInLobbyEl = document.querySelector(
    "#lobbyPlayers"
  ) as HTMLUListElement;
  if (players.length === 2) {
    playersInLobbyEl.innerHTML = players
      .map((player) =>
        player.id === socket.id
          ? `<li id="lobbyPlayerOne" class="self"><p>${player.playerName}</p></li>`
          : `<li id="lobbyPlayerTwo"><p>${player.playerName}</p></li>`
      )
      .join("");
  } else {
    playersInLobbyEl.innerHTML = players
      .map(
        (player) =>
          `<li id="lobbyPlayerOne" class="self"><p>${player.playerName}</p></li>
          <li id="lobbyPlayerTwo"><p class="flicker">Väntar på motståndare...</p></li>`
      )
      .join("");
  }
};

let hasClickedVirus = false;

socket.on("startGame", () => {
  setTimeout(() => {
    socket.emit("requestOtherPlayerName");
    lobbyEl.classList.add("hide");
    gamePageEl.classList.remove("hide");

    //-------------------------------------Game board shown -------------------------------------------------------------
    const board = document.querySelector("#game-board");
    for (let i = 0; i < 100; i++) {
      let cell = document.createElement("div");
      board?.appendChild(cell);
    }

    socket.emit("virusPosition");
  }, 3000);
  resetTimer();
  resetReactionTimesDisplay();
});

const generateRandomRoomName = () => {
  let randomName = "";
  const chars = "abcdefghijklmnopqrstuvwxyz1234567890";

  for (let i = 0; i < chars.length; i++) {
    randomName += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return randomName;
};
//--------------------------------------------------------------------------------------------------------------------------------------------------
// Function and eventlistener for quitting game and going back to starting page

export function reloadPage() {
  location.reload();
}

restartBtn.addEventListener("click", () => {
  localStorage.clear();
  reloadPage();
});

playAgainBtnEl.addEventListener("click", () => {
  if (!socket.id) {
    return;
  }
  socket.emit("playAgainRequest", socket.id, handlePlayAgainRequest);
});

const handlePlayAgainRequest = async (response: PlayAgainResponse) => {
  if (!response.player) {
    return;
  }
  const playerName = response.player.playerName;
  roomName = generateRandomRoomName();
  socket.emit(
    "playerJoinRequest",
    playerName,
    roomName,
    handlePlayerRequestCallback
  );
};
//--------------------------------------------------------------------------------------------------------------------------------------------------
// player time counter

socket.on("handleVirusPosition", (cellPosition: number) => {
  document.querySelectorAll("#game-board > div").forEach((cell) => {
    cell.innerHTML = "";
  });

  hasClickedVirus = false;
  const targetCell = document.querySelector(
    `#game-board > div:nth-child(${cellPosition})`
  ) as HTMLDivElement;

  if (targetCell) {
    targetCell.innerHTML = `<span style="font-size: 2rem">\u{1F9A0}</span>`;
    targetCell.addEventListener("click", (e) => virusClicked(e, targetCell));
    startCounting(targetCell);
  }
});

const virusClicked = (e: MouseEvent, targetCell: HTMLDivElement) => {
  e.preventDefault();
  if (!hasClickedVirus) {
    hasClickedVirus = true;
    targetCell.innerHTML = "";
    socket.emit("virusClicked", elapsedTime);
    socket.emit("reactionTime", elapsedTime);
  }
};

socket.on("handleVirusClicked", () => {
  socket.emit("virusPosition");
  resetTimer();
});

socket.on("gameEnded", () => {
  gamePageEl.classList.add("hide");
  showResult.classList.remove("hide");
  resetReactionTimesDisplay();
});

socket.on("updateScore", (players: Player[]) => {
  if (socket.id !== players[0].id) {
    players.reverse();
  }
  console.log(players);
  roundScoreEl.innerHTML = players
    .map((player) =>
      player.id === socket.id
        ? `<li class="self"><p class="${
            player.flicker === true ? "flicker" : ""
          }">${player.playerName}: ${player.wonRounds}</p></li>`
        : `<li><p class="${player.flicker === true ? "flicker" : ""}">${
            player.playerName
          }: ${player.wonRounds}</p></li>`
    )
    .join("");
});

const formatTime = (ms: number) => {
  let milisec = ms % 1000;
  let sec = Math.floor((ms / 1000) % 60);
  let min = Math.floor(ms / (1000 * 60));

  let milisecString = milisec.toString().padStart(3, "0");
  let secString = sec.toString().padStart(2, "0");
  let minString = min.toString().padStart(2, "0");

  return `${minString}:${secString}:${milisecString}`;
};

socket.on(
  "updatePlayerTimes",
  (
    playerTotalReactionTime: PlayerTotalReactionTime,
    opponentTotalReactionTime: PlayerTotalReactionTime
  ) => {
    if (socket.id === playerTotalReactionTime.playerId) {
      document.querySelector("#playerTimeBox")!.textContent = `${formatTime(
        playerTotalReactionTime.totalReactionTime
      )}`;
      document.querySelector(
        "#otherPlayerTimeBox"
      )!.textContent = `${formatTime(
        opponentTotalReactionTime.totalReactionTime
      )}`;
    } else {
      document.querySelector("#playerTimeBox")!.textContent = `${formatTime(
        opponentTotalReactionTime.totalReactionTime
      )}`;
      document.querySelector(
        "#otherPlayerTimeBox"
      )!.textContent = `${formatTime(
        playerTotalReactionTime.totalReactionTime
      )}`;
    }
  }
);

const resetReactionTimesDisplay = () => {
  const playerTimeBox = document.querySelector("#playerTimeBox");
  if (playerTimeBox) {
    playerTimeBox.textContent = "00:00:000";
  }

  const otherPlayerTimeBox = document.querySelector("#otherPlayerTimeBox");
  if (otherPlayerTimeBox) {
    otherPlayerTimeBox.textContent = "00:00:000";
  }
};

let updateInterval: number | null = null;
let elapsedTime = 0;

const resetTimer = () => {
  if (updateInterval !== null) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  elapsedTime = 0;
  const timeBox = document.querySelector("#roundTimeCounter");
  if (timeBox) {
    timeBox.innerHTML = "00:00:000";
  }
};

const startCounting = (targetCell: HTMLDivElement) => {
  resetTimer();
  const timeBox = document.querySelector("#roundTimeCounter");
  const maxTime = 30000;

  let startTime = Date.now();
  updateInterval = setInterval(() => {
    const currentTime = Date.now();
    elapsedTime = currentTime - startTime;
    if (timeBox) {
      timeBox.innerHTML = formatTime(elapsedTime);
    }

    if (elapsedTime >= maxTime) {
      if (updateInterval !== null) {
        clearInterval(updateInterval);
        updateInterval = null;
      }

      targetCell.innerHTML = "";
      socket.emit("virusClicked", maxTime, true);
    }
  }, 100);
};

socket.on("playerLeft", (player, finishedGame) => {
  if (!finishedGame) {
    gamePageEl.innerHTML = ` <dialog id="playerLeftNotice"></dialog>`;

    const playerLeftNoticeEl = document.querySelector(
      "#playerLeftNotice"
    ) as HTMLDialogElement;

    playerLeftNoticeEl.innerHTML = `<p class="modalContent">
    ${player.playerName} lämnade!<span><p class="flicker modalContent">Återgår till startsidan...</p></span>
    </p>`;

    playerLeftNoticeEl.showModal();
    setTimeout(() => {
      location.reload();
    }, 7000);
  }
});

socket.on("playerTotalTime", (players) => {
  const resultPageHighscoreEl = document.querySelector(
    "#resultPageHighscore"
  ) as HTMLUListElement;
  const lobbyPageHighscoreEl = document.querySelector(
    "#lobbyPageHighscore"
  ) as HTMLUListElement;
  const scores = players
    .map((player) => {
      const reactionTime = player.reactionTime ? player.reactionTime : "";
      const rounds = player.isTie ? 11 : 10;
      return `<li class="row"><p class="col-2">${
        player.playerName
      }</p><p class="col-2">${
        reactionTime !== ""
          ? formatTime(reactionTime)
          : Number(reactionTime) / rounds
      }</p></li>`;
    })
    .join("");

  lobbyPageHighscoreEl.innerHTML = scores;
  resultPageHighscoreEl.innerHTML = scores;
});

socket.on("recentGamesRequest", (players) => {
  const resultPageRecentGamesEl = document.querySelector(
    "#resultPageRecentGames"
  ) as HTMLUListElement;
  const lobbyPageRecentGamesEl = document.querySelector(
    "#lobbyPageRecentGames"
  ) as HTMLUListElement;
  const recentGameOrder = players.reverse();
  const rows = [];
  for (let i = 0; i < recentGameOrder.length; i += 2) {
    const player1 = players[i];
    const player2 = players[i + 1];
    const row = `
      <li class="row">
        <p class="col-2">${player1.playerName}</p>
        <p class="col-2">${player1.wonRounds}</p>
        ${
          player2
            ? `
        <p class="col-2"> - </p>
        <p class="col-2">${player2.wonRounds}</p>
        <p class="col-2">${player2.playerName}</p>
          
        `
            : ""
        }
      </li>
    `;
    rows.push(row);
  }

  // Combine all rows into the final HTML content
  const scores = rows.join("");

  lobbyPageRecentGamesEl.innerHTML = scores;
  resultPageRecentGamesEl.innerHTML = scores;
});

socket.on("playersResult", (players, rounds) => {
  const reactionTimePlayerOneEl = document.querySelector(
    "#reactionTimePlayerOne"
  ) as HTMLParagraphElement;
  const roundsWonPlayerOneEl = document.querySelector(
    "#roundsWonPlayerOne"
  ) as HTMLParagraphElement;
  const reactionTimePlayerTwoEl = document.querySelector(
    "#reactionTimePlayerTwo"
  ) as HTMLParagraphElement;
  const roundsWonPlayerTwoEl = document.querySelector(
    "#roundsWonPlayerTwo"
  ) as HTMLParagraphElement;

  const playerTwoResultHeaderEl = document.querySelector(
    "#playerTwoResultHeader"
  ) as HTMLHeadingElement;
  const playerOneResultHeaderEl = document.querySelector(
    "#playerOneResultHeader"
  ) as HTMLHeadingElement;

  if (!players[0].reactionTime || !players[1].reactionTime) {
    return;
  }

  if (players[0].isTie) {
    rounds = 11;
  }

  if (socket.id === players[0].id) {
    playerOneResultHeaderEl.innerHTML = `${players[0].playerName}`;
    playerTwoResultHeaderEl.innerHTML = `${players[1].playerName}`;

    reactionTimePlayerOneEl.innerHTML = `${
      players[0].reactionTime !== 0
        ? formatTime(players[0].reactionTime)
        : players[0].reactionTime / rounds
    }`;
    roundsWonPlayerOneEl.innerHTML = `${players[0].wonRounds}`;
    reactionTimePlayerTwoEl.innerHTML = `${
      players[1].reactionTime !== 0
        ? formatTime(players[1].reactionTime)
        : players[1].reactionTime / rounds
    }`;
    roundsWonPlayerTwoEl.innerHTML = `${players[1].wonRounds}`;
  } else {
    playerOneResultHeaderEl.innerHTML = `${players[1].playerName}`;
    playerTwoResultHeaderEl.innerHTML = `${players[0].playerName}`;

    reactionTimePlayerOneEl.innerHTML = `${
      players[1].reactionTime !== 0
        ? formatTime(players[1].reactionTime)
        : players[1].reactionTime / rounds
    }`;
    roundsWonPlayerOneEl.innerHTML = `${players[1].wonRounds}`;
    reactionTimePlayerTwoEl.innerHTML = `${
      players[0].reactionTime !== 0
        ? formatTime(players[0].reactionTime)
        : players[0].reactionTime / rounds
    }`;
    roundsWonPlayerTwoEl.innerHTML = `${players[0].wonRounds}`;
  }
});
