import prisma from "../prisma";

export const findRounds = async (roomId: string) => {
	return await prisma.round.findMany({
		where: {
			roomId: roomId,
		},
		orderBy: {
			roundNumber: "desc",
		},
		include: {
			playerClickedTime: true,
		},
		take: 1,
	});
};

export const createRounds = async (
	roomId: string,
	roundNumber: number,
	targetCell: number,
	delay: number
) => {
	return await prisma.round.create({
		data: {
			roomId,
			roundNumber,
			targetCell,
			delay,
		},
	});
};
