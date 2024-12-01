import * as v from "@valibot/valibot";

const IdSchema = v.pipe(v.string(), v.ulid());

export const RoomSchema = v.object({
  id: IdSchema,
  name: v.string(),
  sensor: v.object({
    state: v.union([v.literal("active_sensor"), v.literal("inactive_sensor")]),
    id: v.union([v.string(), v.null()]),
  }),
  status: v.union([
    v.object({
      current: v.object({
        temperature: v.number(),
        humidity: v.number(),
        timestamp: v.pipe(v.string(), v.isoTimestamp()),
      }),
    }),
    v.null(),
  ]),
  houseId: IdSchema,
});

export type Room = v.InferOutput<typeof RoomSchema>;

export const PasskeySchema = v.object({
  id: v.string(),
  credentialId: v.string(),
  publicKey: v.union([v.instance(Uint8Array)]),
  userName: v.string(),
  counter: v.number(),
});

export type Passkey = v.InferOutput<typeof PasskeySchema>;

export const AuthSchema = v.object({
  userName: v.string(),
  passkeys: v.union([v.array(PasskeySchema), v.null()]),
  challenge: v.union([v.string(), v.null()]),
  authentication: v.union([v.unknown(), v.null()]),
  authorization: v.union([v.unknown(), v.null()]),
});

export type Auth = v.InferOutput<typeof AuthSchema>;

export const SessionSchema = v.object({
  id: v.string(),
  userName: v.union([v.string(), v.null()]),
  expirationTtl: v.union([v.number(), v.null()]),
});

export type Session = v.InferOutput<typeof SessionSchema>;
