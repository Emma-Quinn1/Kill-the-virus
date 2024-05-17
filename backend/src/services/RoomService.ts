import { Room } from "@shared/types/Models";
import prisma from "../prisma";

export const createRoom = (data: Room) => {
	return prisma.room.create({
		data,
	});
};

export const getRoom = (id: string) => {
	return prisma.room.findFirst({
		where: {
			id,
		},
	});
};

export const getWaitingRoom = () => {
	return prisma.room.findFirst({
		where: {
			playerCount: 1,
		},
	});
};

export const updateRoom = (roomId: string) => {
	return prisma.room.update({
		where: {
			id: roomId,
		},
		data: {
			playerCount: 2,
		},
	});
};

export const getFullRoom = (roomId: string) => {
	return prisma.room.findFirst({
		where: {
			id: roomId,
			playerCount: 2,
		},
	});
};

export const updateFinishedRoom = (id: string) => {
	return prisma.room.update({
		where: {
			id,
		},
		data: {
			finishedGame: true,
		},
	});
};
