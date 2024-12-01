import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/types";
import * as v from "@valibot/valibot";

import { env } from "./env.ts";
import { Auth, AuthSchema, Passkey, Room, Session } from "./schema.ts";

export const kv = await Deno.openKv(env.DATABASE_URL ?? undefined);

export const findRoomsBySensorState = async (sensorState: Room["sensor"]["state"]): Promise<Room[]> => {
  const iter = kv.list<Room>({ prefix: ["room", sensorState] });
  const rooms = [];
  for await (const res of iter) rooms.push(res.value);
  return rooms;
};

export const setRoomStatusCurrent = async (room: Room): Promise<Room> => {
  const res = await fetch("https://api.nature.global/1/devices", {
    headers: { Authorization: `Bearer ${room.sensor.id}` },
  });
  if (!res.ok) {
    throw new Error(res.statusText);
  }

  const json = await res.json();

  return {
    ...room,
    status: {
      current: {
        temperature: json[0]?.temperature_offset,
        humidity: json[0]?.humidity_offset,
        timestamp: new Date().toISOString(),
      },
    },
  };
};

export const addRoomLog = async (room: Room): Promise<Room> => {
  await kv.set(["room_log", room.id, room.status!.current.timestamp], room.status!.current);
  return room;
};

export const AuthUserName = (auth: { userName: Auth["userName"]; rp: Auth["rp"] }): Auth => {
  return {
    userName: auth.userName,
    rp: auth.rp,
    passkeys: [],
  };
};

export const AuthUserNameWitRregistrationResponse = (
  auth: { userName: Auth["userName"]; rp: Auth["rp"]; response: RegistrationResponseJSON },
): Auth => {
  return {
    userName: auth.userName,
    rp: auth.rp,
    passkeys: [],
    registrationResponse: auth.response,
  };
};

export const AuthUserNameWithAuthenticationResponse = (
  auth: { userName: Auth["userName"]; rp: Auth["rp"]; response: AuthenticationResponseJSON },
): Auth => {
  return {
    userName: auth.userName,
    rp: auth.rp,
    passkeys: [],
    authorizationResponse: auth.response,
  };
};

export const setAuthPasskeys = async (auth: Auth): Promise<Auth> => {
  const entries = kv.list<Passkey>({ prefix: ["passkey", auth.userName] });
  const passkeys: Auth["passkeys"] = [];
  for await (const entry of entries) passkeys.push(entry.value);
  return {
    ...auth,
    passkeys: passkeys,
  };
};

export const setAuthChallenge = async (auth: Auth): Promise<Auth> => {
  const entry = await kv.get<Auth["challenge"]>(["challenge", auth.userName]);
  return {
    ...auth,
    challenge: entry.value!,
  };
};

export const setAuthRegistrationOptions = async (auth: Auth): Promise<Auth> => {
  const options = await generateRegistrationOptions({
    rpName: auth.rp.name,
    rpID: auth.rp.id,
    userName: auth.userName,
    excludeCredentials: auth.passkeys.map((passkey) => ({ id: passkey.credentialId })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });

  return {
    ...auth,
    challenge: options.challenge,
    registrationOptions: options,
  };
};

export const setAuthCredentialPasskey = async (auth: Auth): Promise<Auth> => {
  const validatedAuth = v.parse(v.required(v.pick(AuthSchema, ["rp", "challenge", "registrationResponse"])), auth);

  const verification = await verifyRegistrationResponse({
    response: validatedAuth.registrationResponse,
    expectedChallenge: validatedAuth.challenge,
    expectedOrigin: validatedAuth.rp.origin,
    expectedRPID: validatedAuth.rp.id,
  });

  const { credential } = verification.registrationInfo!;

  return {
    ...auth,
    passkeys: [
      {
        id: credential.id,
        credentialId: credential.id,
        publicKey: credential.publicKey,
        userName: auth.userName,
        counter: credential.counter,
      },
    ],
  };
};

export const setAuthAuthorizationOptions = async (auth: Auth): Promise<Auth> => {
  const options = await generateAuthenticationOptions({
    rpID: auth.rp.id,
    allowCredentials: auth.passkeys.map((passkey) => ({
      id: passkey.credentialId,
    })),
  });

  return {
    ...auth,
    challenge: options.challenge,
    authorizationOptions: options,
  };
};

export const setAuthVerifiedPasskey = async (auth: Auth): Promise<Auth> => {
  const validatedAuth = v.parse(v.required(v.pick(AuthSchema, ["rp", "challenge", "authorizationResponse"])), auth);

  const passkey = auth.passkeys.find(
    ({ credentialId }) => credentialId === validatedAuth.authorizationResponse.id,
  );
  if (!passkey) {
    throw new Error("No passkey exists");
  }

  const verification = await verifyAuthenticationResponse({
    response: validatedAuth.authorizationResponse,
    expectedChallenge: validatedAuth.challenge,
    expectedOrigin: validatedAuth.rp.origin,
    expectedRPID: validatedAuth.rp.id,
    credential: {
      id: passkey.credentialId,
      publicKey: passkey.publicKey,
      counter: passkey.counter,
    },
  });

  const verified = verification.verified;
  if (!verified) {
    throw new Error("No verified exists");
  }

  const newPasskey = structuredClone(passkey);
  passkey.counter = verification.authenticationInfo.newCounter;

  return {
    ...auth,
    passkeys: [newPasskey],
  };
};

export const addAuthPasskey = async (auth: Auth): Promise<Auth> => {
  await kv.set(["passkey", auth.userName, auth.passkeys[0].id], auth.passkeys[0]);
  return auth;
};

export const addAuthChallenge = async (auth: Auth): Promise<Auth> => {
  await kv.set(["challenge", auth.userName], auth.challenge);
  return auth;
};

export const setSession = async (session: Session): Promise<Session> => {
  const entry = await kv.get<Session>(["session", session.id]);
  return {
    id: session.id,
    userName: entry.value!.userName,
    expirationTtl: entry.value!.expirationTtl,
  };
};

export const addSession = async (session: Session): Promise<Session> => {
  await kv.set(["session", session.id], session);
  return session;
};
