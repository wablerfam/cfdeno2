import { Hono } from "hono";
import { serveStatic } from "hono/deno";

import { Top } from "./App.tsx";

export const app = new Hono();

app.use("/public/*", serveStatic({ root: "./" }));

app.get("/", (c) => {
  const messages = ["Good Morning", "Good Evening", "Good Night"];
  return c.html(<Top messages={messages} />);
});

export default app;
