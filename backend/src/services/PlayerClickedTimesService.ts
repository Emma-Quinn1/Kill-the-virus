import prisma from "../prisma";

export const getClickedTimesForPlayer = async (
	roomId: string,
	playerId: string
) => {
	return await prisma.playerClickedTime.findMany({
		where: {
			roomId,
			playerId,
		},
	});
};

export const createPlayerClickedTime = async (
	playerId: string,
	roundId: string,
	playerTime: number,
	roomId: string
) => {
	return await prisma.playerClickedTime.create({
		data: {
			playerId,
			roundId,
			playerTime,
			roomId,
		},
	});
};

// export const hasPlayerClicked = async (player.id, latestRound.id) => {
// 	return await prisma.playerClickedTime.findMany({
// 		where: player.id, latestRound.id
// 	})
// }
