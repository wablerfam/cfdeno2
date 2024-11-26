import { memberData } from "./data.ts";
import { MemberModel } from "./schema.ts";

Deno.cron("Log a message", "* * * * *", async () => {
  const rooms = await memberData.findAllRooms();
  const p = rooms.value.map(async (room) => {
    const roomCondition = await memberData.getRoomCondition(room.sensorId);
    if (!roomCondition.isOk()) {
      return roomCondition.error;
    }

    const roomLog: MemberModel["RoomLog"] = {
      condition: roomCondition.value.output,
      roomId: room.id,
      createdAt: new Date().toISOString(),
    };
    await memberData.addRoomLog(roomLog);
  });

  const results = await Promise.all(p);

  console.error(results);
});
