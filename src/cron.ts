import { Do } from "@qnighy/metaflow/do";
import * as v from "@valibot/valibot";

import { env } from "./env.ts";

export const kv = await Deno.openKv(env.DATABASE_URL ?? undefined);

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

type Room = v.InferOutput<typeof RoomSchema>;

const findRoomsBySensorState = async (sensorState: Room["sensor"]["state"]): Promise<Room[]> => {
  const iter = kv.list<Room>({ prefix: ["room", sensorState] });
  const rooms = [];
  for await (const res of iter) rooms.push(res.value);
  return rooms;
};

const setRoomStatusCurrent = async (room: Room): Promise<Room> => {
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

const addRoomLog = async (room: Room): Promise<Room> => {
  await kv.set(["room_log", room.id, room.status!.current.timestamp], room.status!.current);
  return room;
};

const wf = Do<Room["sensor"]["state"]>("active_sensor")
  .pipeAwait(findRoomsBySensorState)
  .pipeAwait((rooms) => {
    const p = rooms.map((room) => {
      return Do(room)
        .pipeAwait(setRoomStatusCurrent)
        .pipeAwait(addRoomLog)
        .done();
    });
    return Promise.allSettled(p);
  });

await wf.done()
  .then((v) => {
    console.log("OK");
    console.log(v);
  })
  .catch((err) => {
    console.log("NG");
    console.log(err);
  });
