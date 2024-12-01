import {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";
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

export const PublicKeyCredentialCreationOptionsSchema = v.custom<PublicKeyCredentialCreationOptionsJSON>((data) => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  return true;
});

export const RegistrationResponseSchema = v.custom<RegistrationResponseJSON>((data) => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  return true;
});

export const PublicKeyCredentialRequestOptionsSchema = v.custom<PublicKeyCredentialRequestOptionsJSON>((data) => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  return true;
});

export const AuthenticationResponseSchema = v.custom<AuthenticationResponseJSON>((data) => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  return true;
});

export const AuthSchema = v.object({
  userName: v.string(),
  rp: v.object({
    name: v.string(),
    id: v.string(),
    origin: v.optional(v.string()),
  }),
  passkeys: v.union([v.array(PasskeySchema), v.null()]),
  challenge: v.union([v.string(), v.null()]),
  authentication: v.union([
    v.object({
      options: v.union([PublicKeyCredentialCreationOptionsSchema, v.null()]),
      response: v.union([RegistrationResponseSchema, v.null()]),
    }),
    v.null(),
  ]),
  authorization: v.union([
    v.object({
      options: v.union([PublicKeyCredentialRequestOptionsSchema, v.null()]),
      response: v.union([AuthenticationResponseSchema, v.null()]),
    }),
    v.null(),
  ]),
});

export type Auth = v.InferOutput<typeof AuthSchema>;

export const SessionSchema = v.object({
  id: v.string(),
  userName: v.union([v.string(), v.null()]),
  expirationTtl: v.union([v.number(), v.null()]),
});

export type Session = v.InferOutput<typeof SessionSchema>;
