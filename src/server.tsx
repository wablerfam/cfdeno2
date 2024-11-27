import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { STATUS_CODE } from "@std/http";
import { ulid } from "@std/ulid";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { serveStatic } from "hono/deno";
import { HTTPException } from "hono/http-exception";

import { Top } from "./App.tsx";
import { authData } from "./data.ts";
import { env } from "./env.ts";
import { LogTimer } from "./log.ts";
import { AuthModel } from "./schema.ts";

export const app = new Hono();

app.use("*", async (c, next) => {
  const timer = new LogTimer(c.req.method, c.req.path);
  await next();
  timer.stop(c.res.status);
});

app.use("*", serveStatic({ root: "./public" }));

app.get("/", (c) => {
  const messages = ["Good Morning", "Good Evening", "Good Night"];
  return c.html(<Top messages={messages} />);
});

const auth = new Hono().basePath("/auth")
  .get("/attestation/option", async (c) => {
    const { userName } = c.req.query();

    const passkeys = await authData.findPasskeys(userName);

    const options = await generateRegistrationOptions({
      rpName: "My WebAuthn App",
      rpID: env.API_DOMAIN,
      userName: userName,
      excludeCredentials: passkeys.value.map((passkey) => ({ id: passkey.credentialId })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });

    await authData.addChallenge(userName, options.challenge);

    return c.json({ status: "success", options });
  })
  .post("/attestation/result", async (c) => {
    const { userName, body } = await c.req.json();

    const challenge = await authData.findChallenge(userName);
    if (!challenge.value) {
      throw new HTTPException(STATUS_CODE.NotFound, { message: "No challenge exists" });
    }

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challenge.value,
      expectedOrigin: env.API_ORIGIN,
      expectedRPID: env.API_DOMAIN,
    });

    if (!verification.verified) {
      throw new HTTPException(STATUS_CODE.Unauthorized, { message: "Not verified" });
    }

    const { credential } = verification.registrationInfo!;

    const passkey: AuthModel["Passkey"] = {
      id: credential.id,
      credentialId: credential.id,
      publicKey: credential.publicKey,
      userName: userName,
      counter: credential.counter,
    };

    await authData.addPasskey(passkey);

    return c.json({ verified: true });
  })
  .get("/assertion/option", async (c) => {
    const { userName } = c.req.query();

    const passkeys = await authData.findPasskeys(userName);

    const options = await generateAuthenticationOptions({
      rpID: env.API_DOMAIN,
      allowCredentials: passkeys.value.map((passkey) => ({
        id: passkey.credentialId,
      })),
    });

    await authData.addChallenge(userName, options.challenge);

    return c.json({ status: "success", options });
  })
  .post("/assertion/result", async (c) => {
    const { userName, body } = await c.req.json();

    const passkeys = await authData.findPasskeys(userName);
    const passkey = passkeys.value.find(
      ({ credentialId }) => credentialId === body.id,
    );
    if (!passkey) {
      throw new HTTPException(STATUS_CODE.NotFound, { message: "No passkey exists" });
    }

    const challenge = await authData.findChallenge(userName);
    if (!challenge.value) {
      throw new HTTPException(STATUS_CODE.NotFound, { message: "No challenge exists" });
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge.value,
      expectedOrigin: env.API_ORIGIN,
      expectedRPID: env.API_DOMAIN,
      credential: {
        id: passkey.credentialId,
        publicKey: passkey.publicKey,
        counter: passkey.counter,
      },
    });

    const verified = verification.verified;

    if (verified) {
      const newPasskey = structuredClone(passkey);
      passkey.counter = verification.authenticationInfo.newCounter;
      await authData.updatePasskey(newPasskey);
    }

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

      const session: AuthModel["Session"] = {
        id: sessionId,
        userName: userName,
        expirationTtl: ttl,
      };
      await authData.setSession(session);
    }

    return c.json({ verified: verified });
  });

export type AuthAppType = typeof auth;

app.get("/restricted", async (c) => {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId) {
    return c.text("Unauthorized", STATUS_CODE.Unauthorized);
  }

  const session = await authData.getSession(sessionId);
  if (!session.value) {
    return c.text("Unauthorized. No session exists", STATUS_CODE.Unauthorized);
  }

  const userName = session.value.userName;
  if (!userName) {
    return c.text("Unauthorized", STATUS_CODE.Unauthorized);
  }
  return c.text(`Welcome, ${userName}!`);
});

app.route("/", auth);

export default app;
