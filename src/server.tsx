import { ulid } from "@std/ulid";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { serveStatic } from "hono/deno";

import { Top } from "./App.tsx";
import { assertOption, assertResult, attestOption, attestResult, getSession, Session, setSession } from "./auth.ts";

export const app = new Hono();

app.use("*", serveStatic({ root: "./public" }));

app.get("/", (c) => {
  const messages = ["Good Morning", "Good Evening", "Good Night"];
  return c.html(<Top messages={messages} />);
});

app.get("/auth/attestation/option", async (c) => {
  const { userName } = c.req.query();
  const options = await attestOption(userName);
  return c.json({ status: "success", options });
});

app.post("/auth/attestation/result", async (c) => {
  const { userName, body } = await c.req.json();
  await attestResult(userName, body);
  return c.json({ verified: true });
});

app.get("/auth/assertion/option", async (c) => {
  const { userName } = c.req.query();
  const options = await assertOption(userName);
  return c.json({ status: "success", options });
});

app.post("/auth/assertion/result", async (c) => {
  const { userName, body } = await c.req.json();
  const verified = await assertResult(userName, body);

  if (verified) {
    const ttl = 60 * 60 * 24;
    const sessionId = ulid();
    setCookie(c, "session_id", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: ttl,
      path: "/",
    });

    const session: Session = {
      sessionId: sessionId,
      userName: userName,
      expirationTtl: ttl,
    };
    await setSession(session);
  }

  return c.json({ verified: verified });
});

app.get("/restricted", async (c) => {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId) {
    return c.text("Unauthorized", 401);
  }

  const session = await getSession(sessionId);
  const userName = session?.userName;
  if (!userName) {
    return c.text("Unauthorized", 401);
  }
  return c.text(`Welcome, ${userName}!`);
});

export default app;
