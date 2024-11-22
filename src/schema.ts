import { email, object, string, pipe, number, isoTimestamp } from "valibot";

const UserSchema = object({
  id: string(),
  email: pipe(string(), email()),
  houseId: string(),
});

const HouseSchema = object({
  id: string(),
  name: string(),
});

const RoomSchema = object({
  id: string(),
  name: string(),
  sensorId: string(),
  houseId: string(),
});

const RoomConditionSchema = object({
  temperature: number(),
  humidity: number(),
});

const RoomLog = object({
  condition: RoomConditionSchema,
  roomId: string(),
  createdAt: pipe(string(), isoTimestamp()),
});

export const Schema = {
  User: UserSchema,
  House: HouseSchema,
  Room: RoomSchema,
  RoomCondition: RoomConditionSchema,
  RoomLog: RoomLog,
};
