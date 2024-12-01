import { env } from "./env.ts";
import { Auth, Passkey, Room } from "./schema.ts";

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

export const setAuthPasskeys = async (auth: Auth): Promise<Auth> => {
  const entries = kv.list<Passkey>({ prefix: ["passkey", auth.userName!] });
  const passkeys: Auth["passkeys"] = [];
  for await (const entry of entries) passkeys.push(entry.value);
  return {
    ...auth,
    passkeys: passkeys,
  };
};

export const setAuthChallenge = async (auth: Auth): Promise<Auth> => {
  const entry = await kv.get<Auth["challenge"]>(["challenge", auth.userName!]);
  return {
    ...auth,
    challenge: entry.value,
  };
};

export const setAuthSession = async (auth: Auth): Promise<Auth> => {
  const entry = await kv.get<Auth["session"]>(["session", auth.session!.id]);
  return {
    ...auth,
    session: entry.value,
  };
};

export const addAuthPasskey = async (auth: Auth): Promise<Auth> => {
  await kv.set(["passkey", auth.userName!, auth.passkeys![0].id], auth.passkeys![0]);
  return auth;
};

export const addAuthChallenge = async (auth: Auth): Promise<Auth> => {
  console.log(auth);
  await kv.set(["challenge", auth.userName!], auth.challenge);
  return auth;
};

export const addAuthSession = async (auth: Auth) => {
  await kv.set(["session", auth.session!.id], auth.session);
  return auth;
};
