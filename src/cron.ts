import { InferOutput } from "valibot";

import { data } from "./data.ts";
import { Schema } from "./schema.ts";

type Model = {
  RoomLog: InferOutput<typeof Schema.RoomLog>;
};

Deno.cron("Log a message", "* * * * *", async () => {
  const rooms = await data.findAllRooms();
  const p = rooms.value.map(async (room) => {
    const roomCondition = await data.getRoomCondition(room.sensorId);
    if (!roomCondition.isOk()) {
      return roomCondition.error;
    }

    const roomLog: Model["RoomLog"] = {
      condition: roomCondition.value.output,
      roomId: room.id,
      createdAt: new Date().toISOString(),
    };
    await data.addRoomLog(roomLog);
  });

  const results = await Promise.all(p);

  console.error(results);
});
