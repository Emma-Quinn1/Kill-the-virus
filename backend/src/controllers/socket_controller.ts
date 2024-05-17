/**
 * Socket Controller
 */
import Debug from "debug";
import { Server, Socket } from "socket.io";
import {
	ClientToServerEvents,
	ServerToClientEvents,
} from "@shared/types/SocketTypes";
import prisma from "../prisma";
import {
	createPlayer,
	getPlayers,
	getPlayer,
	findOpponent,
	updateTieGame,
} from "../services/PlayerService";
import {
	updateRoom,
	getWaitingRoom,
	getFullRoom,
	createRoom,
	getRoom,
	updateFinishedRoom,
} from "../services/RoomService";
import { Player, PlayerClickedTime } from "@prisma/client";
import { createRounds, findRounds } from "../services/RoundService";
import {
	createPlayerClickedTime,
	getClickedTimesForPlayer,
} from "../services/PlayerClickedTimesService";

// Create a new debug instance
const debug = Debug("backend:socket_controller");

// Handle a user connecting
export const handleConnection = (
	socket: Socket<ClientToServerEvents, ServerToClientEvents>,
	io: Server<ClientToServerEvents, ServerToClientEvents>
) => {
	debug("🙋 A user connected", socket.id);

	socket.setMaxListeners(10000);

	//--------------------------------------------------------------------------------------------------------------------------
	// Player join controller

	socket.on("playerJoinRequest", async (playerName, roomName, callback) => {
		const returningPlayer = await prisma.player.findFirst({
			where: {
				id: socket.id,
			},
		});

		const waitingRoom = await getWaitingRoom();

		if (waitingRoom) {
			if (!returningPlayer) {
				const player = await createPlayer({
					id: socket.id,
					playerName,
					roomId: waitingRoom.id,
				});
				debug(
					player,
					"added to database with room id: ",
					player.roomId
				);
			} else {
				await prisma.player.update({
					where: {
						id: returningPlayer.id,
					},
					data: {
						roomId: waitingRoom.id,
						wonRounds: 0,
						reactionTime: 0,
					},
				});
			}

			socket.join(waitingRoom.id);

			await updateRoom(waitingRoom.id);

			const newGame = await getFullRoom(waitingRoom.id);

			const { delay, targetCell } = calculatePositionForVirus();

			await prisma.round.create({
				data: {
					roomId: waitingRoom.id,
					roundNumber: 1,
					targetCell: targetCell,
					delay: delay,
				},
			});

			const players = await getPlayers(waitingRoom.id);

			io.to(waitingRoom.id).emit("onlinePlayers", players);

			callback({
				success: true,
				players,
				requestOtherPlayerName() {},
			});

			if (newGame) {
				io.to(newGame.id).emit("startGame");
				io.to(newGame.id).emit("updateScore", players);
			}
		} else {
			const room = await createRoom({
				name: roomName,
				playerCount: 1,
			});
			if (!returningPlayer) {
				const player = await createPlayer({
					id: socket.id,
					playerName,
					roomId: room.id,
				});
				debug(
					player,
					"added to database with room id: ",
					player.roomId
				);
				callback({
					success: true,
					players: [player],
					requestOtherPlayerName() {},
				});
			} else {
				const player = await prisma.player.update({
					where: {
						id: returningPlayer.id,
					},
					data: {
						roomId: room.id,
						wonRounds: 0,
						reactionTime: 0,
					},
				});
				callback({
					success: true,
					players: [player],
					requestOtherPlayerName() {},
				});
			}

			socket.join(room.id);
			io.to(room.id).emit("playerJoined", playerName, room.playerCount);
		}
		getPlayerReactionTime();
		getRecentGames();
		getResultsForFinishedGame();
	});

	//--------------------------------------------------------------------------------------------------------------------------
	// Virus Clicked controller
	socket.on(
		"virusClicked",
		async (virusClickedTime, reachedMaxTime = false) => {
			const player = await prisma.player.findUnique({
				where: {
					id: socket.id,
				},
			});

			if (player) {
				const round = await findRounds(player.roomId);
				const latestRound = round[0];

				if (
					reachedMaxTime &&
					latestRound.playerClickedTime.find(
						(p) => p.playerId === player.id
					)
				) {
					return;
				}

				if (
					latestRound.playerClickedTime.length === 0 &&
					reachedMaxTime
				) {
					const players = await getPlayers(player.roomId);

					if (players[0].id === socket.id) {
						return;
					}

					for (const player of players) {
						const playerClickedTime = await createPlayerClickedTime(
							player.id,
							latestRound.id,
							30000,
							player.roomId
						);

						latestRound.playerClickedTime.push(playerClickedTime);
					}
				} else {
					let clickedTime = null;
					if (
						reachedMaxTime &&
						!latestRound.playerClickedTime.find(
							(p) => p.playerId === player.id
						)
					) {
						clickedTime = 30000;
					} else {
						clickedTime = virusClickedTime;
					}

					const playerClickedTime = await createPlayerClickedTime(
						player.id,
						latestRound.id,
						clickedTime,
						player.roomId
					);

					latestRound.playerClickedTime.push(playerClickedTime);
				}

				const allPlayerClickedTimesForPlayer =
					await getClickedTimesForPlayer(player.roomId, player.id);

				let totalReactionTime = 0;
				allPlayerClickedTimesForPlayer.forEach((playerClickedTime) => {
					totalReactionTime += playerClickedTime.playerTime;
				});

				const opponent = await findOpponent(player.roomId, socket.id);

				let totalReactionTimeOpponent = 0;
				if (opponent) {
					const allPlayerClickedTimesForOpponent =
						await getClickedTimesForPlayer(
							opponent.roomId,
							opponent.id
						);

					allPlayerClickedTimesForOpponent.forEach(
						(playerClickedTime) => {
							totalReactionTimeOpponent +=
								playerClickedTime.playerTime;
						}
					);
				}

				io.to(player.roomId).emit(
					"updatePlayerTimes",
					{ playerId: player.id, totalReactionTime },
					{
						playerId: opponent?.id ?? "",
						totalReactionTime: totalReactionTimeOpponent,
					}
				);

				if (latestRound.playerClickedTime.length === 2) {
					if (
						!latestRound.playerClickedTime.every(
							(p) => p.playerTime === 30000
						)
					) {
						updatePlayerScore(
							latestRound.playerClickedTime,
							player.roomId
						);
					}

					if (latestRound.roundNumber === 10) {
						const players = await getPlayers(player.roomId);
						const scores = players.map((p) => p.wonRounds);

						if (scores[0] === scores[1]) {
							const { delay, targetCell } =
								calculatePositionForVirus();

							await createRounds(
								player.roomId,
								11,
								targetCell,
								delay
							);

							io.to(player.roomId).emit("handleVirusClicked");
							debug(
								`Send out last virus position to break tie in  ${player.roomId}`
							);

							// const tiedGameIds = await getPlayers(player.roomId);
							// await updateTieGame(tiedGameIds[0].id);
							// await updateTieGame(tiedGameIds[1].id);

							await updateTieGame(player.roomId);
						} else {
							await updateFinishedRoom(player.roomId);
							getPlayerReactionTime();
							getRecentGames();
							getResultsForFinishedGame();
							io.to(player.roomId).emit("gameEnded");
							debug(`Game ended in room ${player.roomId}`);
						}
					} else if (latestRound.roundNumber === 11) {
						await updateFinishedRoom(player.roomId);
						getPlayerReactionTime();
						getRecentGames();
						getResultsForFinishedGame();
						io.to(player.roomId).emit("gameEnded");
						debug(`Game ended in room ${player.roomId}`);
					} else {
						const delay =
							Math.random() * (10 - 1.5) * 1000 + 1.5 * 1000;

						const x = Math.floor(Math.random() * 10) + 1;
						const y = Math.floor(Math.random() * 10) + 1;
						const targetCell = x * y;

						await prisma.round.create({
							data: {
								roomId: player.roomId,
								roundNumber: latestRound.roundNumber + 1,
								targetCell: targetCell,
								delay: delay,
							},
						});

						io.to(player.roomId).emit("handleVirusClicked");
						debug(`Update virus position in room ${player.roomId}`);
					}
				}
			}
		}
	);

	socket.on("virusPosition", async () => {
		const player = await prisma.player.findUnique({
			where: {
				id: socket.id,
			},
		});

		if (player) {
			const round = await prisma.round.findMany({
				where: {
					roomId: player.roomId,
				},
				orderBy: {
					roundNumber: "desc",
				},
				take: 1,
			});

			const latestRound = round[0];

			setTimeout(async () => {
				io.to(player.roomId).emit(
					"handleVirusPosition",
					latestRound.targetCell
				);
				debug(
					`Virus position sent to room ${player.roomId}: ${round[0].targetCell}`
				);
			}, round[0].delay);
		}
	});

	//--------------------------------------------------------------------------------------------------------------------------------------------------
	// Controller to display opponent name in gameview

	socket.on("requestOtherPlayerName", async () => {
		const player = await prisma.player.findUnique({
			where: {
				id: socket.id,
			},
		});

		if (player) {
			const roomId = player.roomId;
			if (roomId) {
				const otherPlayer = await prisma.player.findFirst({
					where: {
						roomId: roomId,
						id: { not: socket.id },
					},
				});

				if (otherPlayer) {
					socket.emit("opponentPlayerJoined", otherPlayer.playerName);
				}
			}
		}
	});

	socket.on("reactionTime", async (time) => {
		const updateScore = await prisma.player.update({
			where: {
				id: socket.id,
			},
			data: {
				reactionTime: {
					increment: time,
				},
			},
		});

		debug("PLAYERTIME", updateScore);
	});

	const getPlayerReactionTime = async () => {
		const player = await getPlayer(socket.id);

		if (!player) {
			return;
		}

		const players = await prisma.player.findMany({
			where: {
				room: {
					finishedGame: {
						not: false,
					},
				},
			},
			orderBy: {
				reactionTime: "asc",
			},
			take: 10,
		});

		if (!players) {
			return;
		}

		io.to(player.roomId).emit("playerTotalTime", players);
	};

	const getRecentGames = async () => {
		const player = await getPlayer(socket.id);

		if (!player) {
			return;
		}

		const recentGames = await prisma.room.findMany({
			where: {
				finishedGame: true,
			},
			orderBy: {
				createdAt: "desc",
			},
			take: 10,
		});

		const recentGameIds = recentGames.map((game) => game.id);

		const players = await prisma.player.findMany({
			where: {
				roomId: {
					in: recentGameIds,
				},
			},
		});

		io.to(player.roomId).emit("recentGamesRequest", players);
	};

	const getResultsForFinishedGame = async () => {
		const player = await getPlayer(socket.id);

		if (!player) {
			return;
		}

		const room = await getRoom(player.roomId);

		if (!room) {
			return;
		}

		const playersInRoom = await prisma.player.findMany({
			where: {
				roomId: room.id,
			},
		});

		const rounds = await prisma.round.findFirst({
			where: {
				roomId: player.roomId,
			},
		});

		if (!rounds) {
			return;
		}

		io.to(player.roomId).emit(
			"playersResult",
			playersInRoom,
			rounds.roundNumber
		);
	};

	const updatePlayerScore = async (
		playerClickedTimes: PlayerClickedTime[],
		roomId: string
	) => {
		let playerIdThatWon = "";
		if (
			playerClickedTimes[0].playerTime < playerClickedTimes[1].playerTime
		) {
			playerIdThatWon = playerClickedTimes[0].playerId;
		} else if (
			playerClickedTimes[1].playerTime < playerClickedTimes[0].playerTime
		) {
			playerIdThatWon = playerClickedTimes[1].playerId;
		}

		await prisma.player.update({
			where: { id: playerIdThatWon },
			data: {
				wonRounds: { increment: 1 },
				flicker: true,
			},
		});

		const players = await getPlayers(roomId);
		io.to(roomId).emit("updateScore", players);

		await prisma.player.update({
			where: {
				id: playerIdThatWon,
			},
			data: {
				flicker: false,
			},
		});

		socket.on("playAgainRequest", async (id, callback) => {
			const player = await getPlayer(id);
			if (player) {
				callback({
					player,
				});
			}
		});
	};

	socket.on("disconnect", async () => {
		const player = await getPlayer(socket.id);

		if (!player) {
			return;
		}

		const finishedGame = await prisma.room.findFirst({
			where: {
				players: {
					some: {
						id: player.id,
					},
				},
				finishedGame: true,
			},
		});

		io.to(player.roomId).emit(
			"playerLeft",
			player,
			finishedGame?.finishedGame
		);
	});

	const calculatePositionForVirus = () => {
		const delay = Math.random() * (10 - 1.5) * 1000 + 1.5 * 1000;
		const x = Math.floor(Math.random() * 10) + 1;
		const y = Math.floor(Math.random() * 10) + 1;
		const targetCell = x * y;

		return { delay, targetCell };
	};
};
