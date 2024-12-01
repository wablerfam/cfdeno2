import { Do } from "@qnighy/metaflow/do";
import { Try } from "@qnighy/metaflow/exception";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { STATUS_CODE } from "@std/http";
import { ulid } from "@std/ulid";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { serveStatic } from "hono/deno";
import { HTTPException } from "hono/http-exception";

import { Top } from "./App.tsx";
import { addAuthChallenge, addAuthPasskey, addSession, AuthUserName, setAuthChallenge, setAuthPasskeys, setSession } from "./data.ts";
import { env } from "./env.ts";
import { LogTimer } from "./log.ts";
import { Session } from "./schema.ts";

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

export const auth = new Hono().basePath("/auth")
  .get("/attestation/option", async (c) => {
    const { userName } = c.req.query();

    const wf = Do(userName)
      .pipe(AuthUserName)
      .pipeAwait(setAuthPasskeys)
      .pipeAwait(async (auth) => {
        const options = await generateRegistrationOptions({
          rpName: "My WebAuthn App",
          rpID: env.API_DOMAIN,
          userName: userName,
          excludeCredentials: auth.passkeys!.map((passkey) => ({ id: passkey.credentialId })),
          authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
        });

        return {
          ...auth,
          challenge: options.challenge,
          authentication: options,
        };
      })
      .pipeAwait(addAuthChallenge);

    const result = Try(async () => await wf.done()).result;
    if (result.type === "Err") {
      throw new HTTPException(500, { message: "server error" });
    }
    const value = await result.value;
    return c.json({ status: "success", options: value.authentication });
  })
  .post("/attestation/result", async (c) => {
    const { userName, body } = await c.req.json();

    const wf = Do(userName)
      .pipe(AuthUserName)
      .pipeAwait(setAuthChallenge)
      .pipeAwait(async (auth) => {
        const verification = await verifyRegistrationResponse({
          response: body,
          expectedChallenge: auth.challenge!,
          expectedOrigin: env.API_ORIGIN,
          expectedRPID: env.API_DOMAIN,
        });

        const { credential } = verification.registrationInfo!;

        return {
          ...auth,
          passkeys: [
            {
              id: credential.id,
              credentialId: credential.id,
              publicKey: credential.publicKey,
              userName: auth.userName,
              counter: credential.counter,
            },
          ],
        };
      })
      .pipeAwait(addAuthPasskey);

    const result = Try(async () => await wf.done()).result;
    if (result.type === "Err") {
      throw new HTTPException(500, { message: "server error" });
    }
    // const value = await result.value;
    return c.json({ verified: true });
  })
  .get("/assertion/option", async (c) => {
    const { userName } = c.req.query();

    const wf = Do(userName)
      .pipe(AuthUserName)
      .pipeAwait(setAuthPasskeys)
      .pipeAwait(async (auth) => {
        const options = await generateAuthenticationOptions({
          rpID: env.API_DOMAIN,
          allowCredentials: auth.passkeys!.map((passkey) => ({
            id: passkey.credentialId,
          })),
        });

        return {
          ...auth,
          challenge: options.challenge,
          authorization: options,
        };
      })
      .pipeAwait(addAuthChallenge);

    const result = Try(async () => await wf.done()).result;
    if (result.type === "Err") {
      throw new HTTPException(500, { message: "server error" });
    }
    const value = await result.value;
    return c.json({ status: "success", options: value.authorization });
  })
  .post("/assertion/result", async (c) => {
    const { userName, body } = await c.req.json();

    const wf = Do(userName)
      .pipe(AuthUserName)
      .pipeAwait(setAuthChallenge)
      .pipeAwait(setAuthPasskeys)
      .pipeAwait(async (auth) => {
        const passkey = auth.passkeys!.find(
          ({ credentialId }) => credentialId === body.id,
        );
        if (!passkey) {
          throw new Error("No passkey exists");
        }

        const verification = await verifyAuthenticationResponse({
          response: body,
          expectedChallenge: auth.challenge!,
          expectedOrigin: env.API_ORIGIN,
          expectedRPID: env.API_DOMAIN,
          credential: {
            id: passkey.credentialId,
            publicKey: passkey.publicKey,
            counter: passkey.counter,
          },
        });

        const verified = verification.verified;
        if (!verified) {
          throw new Error("No verified exists");
        }

        const newPasskey = structuredClone(passkey);
        passkey.counter = verification.authenticationInfo.newCounter;

        return {
          ...auth,
          passkeys: [newPasskey],
        };
      })
      .pipeAwait(addAuthPasskey)
      .pipe((auth) => {
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
          id: sessionId,
          userName: auth.userName,
          expirationTtl: ttl,
        };

        return session;
      })
      .pipeAwait(addSession);

    const result = Try(async () => await wf.done()).result;
    if (result.type === "Err") {
      throw new HTTPException(500, { message: "server error" });
    }
    // const value = await result.value;
    return c.json({ verified: true });
  });

export type AuthAppType = typeof auth;

app.get("/restricted", (c) => {
  const sessionId = getCookie(c, "session_id");

  const session: Session = {
    id: sessionId!,
    userName: null,
    expirationTtl: null,
  };

  const wf = Do(session)
    .pipeAwait(setSession);

  return wf.done()
    .then((session) => {
      return c.text(`Welcome, ${session.userName}!`);
    })
    .catch((err) => {
      console.log(err);
      return c.text("Unauthorized", STATUS_CODE.Unauthorized);
    });
});

app.route("/", auth);

export default app;
