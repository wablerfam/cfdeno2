import { ulid } from "@std/ulid";
import { err, ok } from "neverthrow";
import * as v from "valibot";

import { AuthModel, Model, Schema } from "./schema.ts";

const kv = await Deno.openKv("./db/kv.db");

const findUserByEmail = async (email: Model["User"]["email"]) => {
  const user: Model["User"] = {
    id: ulid(),
    email: email,
    houseId: ulid(),
  };

  await kv.set(["user", email], user);
  const entries = kv.list({ prefix: ["user"] });
  for await (const entry of entries) {
    console.log(entry.key, entry.value);
  }
};

const findAllRooms = async () => {
  const iter = kv.list<Model["Room"]>({ prefix: ["room"] });
  const rooms = [];
  for await (const res of iter) rooms.push(res.value);
  return ok(rooms);
};

const addRoomLog = async (roomLog: Model["RoomLog"]) => {
  await kv.set(["room_log", roomLog.createdAt], roomLog);
  return ok(null);
};

const getRoomCondition = async (sensorId: Model["Room"]["sensorId"]) => {
  const res = await fetch("https://api.nature.global/1/devices", {
    headers: { Authorization: `Bearer ${sensorId}` },
  });
  if (!res.ok) {
    return err(new Error(res.statusText));
  }

  const json = await res.json();

  //   const roomCondition: Model["RoomCondition"] = {
  //     temperature: json[0]?.newest_events?.te?.val,
  //     humidity: json[0]?.newest_events?.hu?.val,
  //   };
  const roomCondition = v.safeParse(Schema["RoomCondition"], {
    temperature: json[0]?.temperature_offset,
    humidity: json[0]?.humidity_offset,
  });
  if (!roomCondition.success) {
    return err(new Error("validation failed"));
  }

  return ok(roomCondition);
};

export const data = {
  findUserByEmail: findUserByEmail,
  findAllRooms: findAllRooms,
  addRoomLog: addRoomLog,
  getRoomCondition: getRoomCondition,
};

const findPasskeys = async (userName: string) => {
  const entries = kv.list<AuthModel["Passkey"]>({ prefix: ["passkey", userName] });
  const passkeys: AuthModel["Passkey"][] = [];
  for await (const entry of entries) {
    passkeys.push(entry.value);
  }
  return ok(passkeys);
};

const addPasskey = async (passkey: AuthModel["Passkey"]) => {
  await kv.set(["passkey", passkey.userName, passkey.id], passkey);
  return ok(null);
};

const updatePasskey = async (passkey: AuthModel["Passkey"]) => {
  const key = ["passkey", passkey.userName, passkey.id];

  // const existingEntry = await kv.get<AuthModel["Passkey"]>(key);

  // if (existingEntry.value) {
  //   throw new Error(`Passkey with ID ${passkey.id} already exists for user ${passkey.userName}.`);
  // }

  await kv.set(key, passkey);
  return ok(null);
};

const findChallenge = async (userName: string) => {
  const entry = await kv.get<AuthModel["Challenge"]>(["challenge", userName]);
  return ok(entry.value);
};

const addChallenge = async (userName: string, challenge: AuthModel["Challenge"]) => {
  await kv.set(["challenge", userName], challenge);
  return ok(null);
};

const getSession = async (sessionId: string) => {
  const entry = await kv.get<AuthModel["Session"]>(["session", sessionId]);
  return ok(entry.value);
};

const setSession = async (session: AuthModel["Session"]) => {
  await kv.set(["session", session.id], session);
  return ok(null);
};

export const authData = {
  findPasskeys: findPasskeys,
  addPasskey: addPasskey,
  updatePasskey: updatePasskey,
  findChallenge: findChallenge,
  addChallenge: addChallenge,
  getSession: getSession,
  setSession: setSession,
};
