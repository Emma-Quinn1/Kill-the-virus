import { Player } from "@shared/types/Models";
import prisma from "../prisma";

export const createPlayer = (data: Player) => {
	return prisma.player.create({
		data,
	});
};

export const getPlayers = (roomId: string) => {
	return prisma.player.findMany({
		where: {
			roomId,
		},
	});
};

export const getPlayer = (id: string) => {
	return prisma.player.findUnique({
		where: {
			id,
		},
	});
};

export const findOpponent = async (roomId: string, excludeId: string) => {
	return await prisma.player.findFirst({
		where: {
			roomId: roomId,
			NOT: {
				id: excludeId,
			},
		},
	});
};

export const updateTieGame = (roomId: string) => {
	return prisma.player.updateMany({
		where: {
			roomId,
		},
		data: {
			isTie: true,
		},
	});

	// return prisma.player.update({
	// 	where: {
	// 		id
	// 	},
	// 	data: {
	// 		isTie: true
	// 	}
	// })
};
