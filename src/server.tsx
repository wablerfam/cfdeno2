import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { ulid } from "@std/ulid";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { serveStatic } from "hono/deno";

import { Top } from "./App.tsx";
import { authData } from "./data.ts";
import { AuthModel } from "./schema.ts";

export const app = new Hono();

app.use("*", serveStatic({ root: "./public" }));

app.get("/", (c) => {
  const messages = ["Good Morning", "Good Evening", "Good Night"];
  return c.html(<Top messages={messages} />);
});

const auth = new Hono().basePath("/auth");

auth.get("/attestation/option", async (c) => {
  const { userName } = c.req.query();

  const passkeys = await authData.findPasskeys(userName);

  const options = await generateRegistrationOptions({
    rpName: "My WebAuthn App",
    rpID: "localhost",
    userName: userName,
    excludeCredentials: passkeys.map((passkey) => ({ id: passkey.credentialId })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });

  await authData.addChallenge(userName, options.challenge);

  return c.json({ status: "success", options });
});

auth.post("/attestation/result", async (c) => {
  const { userName, body } = await c.req.json();

  const challenge = await authData.findChallenge(userName);
  if (!challenge) {
    throw new Error("No challenge exists.");
  }

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge: challenge,
    expectedOrigin: "http://localhost:8000",
    expectedRPID: "localhost",
  });

  if (!verification.verified) {
    throw new Error("Not verified.");
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
});

auth.get("/assertion/option", async (c) => {
  const { userName } = c.req.query();

  const passkeys = await authData.findPasskeys(userName);

  const options = await generateAuthenticationOptions({
    rpID: "localhost",
    allowCredentials: passkeys.map((passkey) => ({
      id: passkey.credentialId,
    })),
  });

  await authData.addChallenge(userName, options.challenge);

  return c.json({ status: "success", options });
});

auth.post("/assertion/result", async (c) => {
  const { userName, body } = await c.req.json();
  const challenge = await authData.findChallenge(userName);
  const passkeys = await authData.findPasskeys(userName);
  const passkey = passkeys.find(
    ({ credentialId }) => credentialId === body.id,
  );
  if (!passkey) {
    throw new Error(`No passkey exists.`);
  }

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge: challenge!,
    expectedOrigin: "http://localhost:8000",
    expectedRPID: "localhost",
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

app.get("/restricted", async (c) => {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId) {
    return c.text("Unauthorized", 401);
  }

  const session = await authData.getSession(sessionId);
  const userName = session?.userName;
  if (!userName) {
    return c.text("Unauthorized", 401);
  }
  return c.text(`Welcome, ${userName}!`);
});

app.route("/", auth);

export default app;
