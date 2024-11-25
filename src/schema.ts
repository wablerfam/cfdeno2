import { email, InferOutput, instance, isoTimestamp, number, object, pipe, string, ulid, union } from "valibot";

const IdSchema = pipe(string(), ulid());

const UserSchema = object({
  id: IdSchema,
  email: pipe(string(), email()),
  houseId: string(),
});

const HouseSchema = object({
  id: IdSchema,
  name: string(),
});

const RoomSchema = object({
  id: IdSchema,
  name: string(),
  sensorId: string(),
  houseId: IdSchema,
});

const RoomConditionSchema = object({
  temperature: number(),
  humidity: number(),
});

const RoomLog = object({
  condition: RoomConditionSchema,
  roomId: IdSchema,
  createdAt: pipe(string(), isoTimestamp()),
});

export const Schema = {
  User: UserSchema,
  House: HouseSchema,
  Room: RoomSchema,
  RoomCondition: RoomConditionSchema,
  RoomLog: RoomLog,
};

export type Model = {
  User: InferOutput<typeof Schema.User>;
  House: InferOutput<typeof Schema.House>;
  Room: InferOutput<typeof Schema.Room>;
  RoomCondition: InferOutput<typeof Schema.RoomCondition>;
  RoomLog: InferOutput<typeof Schema.RoomLog>;
};

const PasskeySchema = object({
  id: string(),
  credentialId: string(),
  publicKey: union([instance(Uint8Array)]),
  userName: string(),
  counter: number(),
});

const ChallengeSchema = string();

const SessionSchema = object({
  id: string(),
  userName: string(),
  expirationTtl: number(),
});

export const AuthSchema = {
  Passkey: PasskeySchema,
  Challenge: ChallengeSchema,
  Session: SessionSchema,
};

export type AuthModel = {
  Passkey: InferOutput<typeof AuthSchema.Passkey>;
  Challenge: InferOutput<typeof AuthSchema.Challenge>;
  Session: InferOutput<typeof AuthSchema.Session>;
};
