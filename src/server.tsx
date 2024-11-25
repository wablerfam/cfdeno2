import { denoPlugins } from "@luca/esbuild-deno-loader";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { ulid } from "@std/ulid";
import * as esbuild from "esbuild";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { serveStatic } from "hono/deno";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";

import { Top } from "./App.tsx";
import { authData } from "./data.ts";
import { env } from "./env.ts";
import { AuthModel } from "./schema.ts";

type EsbuildOptions = {
  entryPoints: string[];
  outdir: string;
};

export const JSBundler = async (options: EsbuildOptions) => {
  const bundle = await esbuild.build({
    plugins: [...denoPlugins()],
    entryPoints: options.entryPoints,
    outdir: options.outdir,
    bundle: true,
    format: "esm",
    write: false,
  });
  esbuild.stop();

  return createMiddleware(async (c, next) => {
    const url = new URL(c.req.url);
    const output = bundle.outputFiles.find((v) => v.path == url.pathname);
    if (!output) {
      await next();
      return;
    }

    c.res = c.body(output.text, 200, { "Content-Type": "application/javascript" });
  });
};

export const app = new Hono();

app.use(logger());

app.use("*", serveStatic({ root: "./public" }));

app.get("/js/*", await JSBundler({ entryPoints: ["./src/script.ts"], outdir: "/js/" }));

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
      throw new HTTPException(404, { message: "No challenge exists" });
    }

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challenge.value,
      expectedOrigin: env.API_ORIGIN,
      expectedRPID: env.API_DOMAIN,
    });

    if (!verification.verified) {
      throw new HTTPException(401, { message: "Not verified" });
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
      throw new HTTPException(404, { message: "No passkey exists" });
    }

    const challenge = await authData.findChallenge(userName);
    if (!challenge.value) {
      throw new HTTPException(404, { message: "No challenge exists" });
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
    return c.text("Unauthorized", 401);
  }

  const session = await authData.getSession(sessionId);
  if (!session.value) {
    return c.text("Unauthorized. No session exists", 401);
  }

  const userName = session.value.userName;
  if (!userName) {
    return c.text("Unauthorized", 401);
  }
  return c.text(`Welcome, ${userName}!`);
});

app.route("/", auth);

export default app;
