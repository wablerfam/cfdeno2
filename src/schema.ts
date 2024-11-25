import * as v from "valibot";

const IdSchema = v.pipe(v.string(), v.ulid());

const UserSchema = v.object({
  id: IdSchema,
  email: v.pipe(v.string(), v.email()),
  houseId: v.string(),
});

const HouseSchema = v.object({
  id: IdSchema,
  name: v.string(),
});

const RoomSchema = v.object({
  id: IdSchema,
  name: v.string(),
  sensorId: v.string(),
  houseId: IdSchema,
});

const RoomConditionSchema = v.object({
  temperature: v.number(),
  humidity: v.number(),
});

const RoomLog = v.object({
  condition: RoomConditionSchema,
  roomId: IdSchema,
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
});

export const Schema = {
  User: UserSchema,
  House: HouseSchema,
  Room: RoomSchema,
  RoomCondition: RoomConditionSchema,
  RoomLog: RoomLog,
};

export type Model = {
  User: v.InferOutput<typeof Schema.User>;
  House: v.InferOutput<typeof Schema.House>;
  Room: v.InferOutput<typeof Schema.Room>;
  RoomCondition: v.InferOutput<typeof Schema.RoomCondition>;
  RoomLog: v.InferOutput<typeof Schema.RoomLog>;
};

const PasskeySchema = v.object({
  id: v.string(),
  credentialId: v.string(),
  publicKey: v.union([v.instance(Uint8Array)]),
  userName: v.string(),
  counter: v.number(),
});

const ChallengeSchema = v.string();

const SessionSchema = v.object({
  id: v.string(),
  userName: v.string(),
  expirationTtl: v.number(),
});

export const AuthSchema = {
  Passkey: PasskeySchema,
  Challenge: ChallengeSchema,
  Session: SessionSchema,
};

export type AuthModel = {
  Passkey: v.InferOutput<typeof AuthSchema.Passkey>;
  Challenge: v.InferOutput<typeof AuthSchema.Challenge>;
  Session: v.InferOutput<typeof AuthSchema.Session>;
};
