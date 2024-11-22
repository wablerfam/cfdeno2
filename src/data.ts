import { ulid } from "@std/ulid";
import { err, ok } from "neverthrow";
import { InferOutput, safeParse } from "valibot";

import { Schema } from "./schema.ts";

type Model = {
  User: InferOutput<typeof Schema.User>;
  House: InferOutput<typeof Schema.House>;
  Room: InferOutput<typeof Schema.Room>;
  RoomCondition: InferOutput<typeof Schema.RoomCondition>;
  RoomLog: InferOutput<typeof Schema.RoomLog>;
};

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
  return ok(undefined);
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
  const roomCondition = safeParse(Schema["RoomCondition"], {
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
