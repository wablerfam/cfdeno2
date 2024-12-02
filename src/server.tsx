import { Hono } from "@hono/hono";
import { getCookie, setCookie } from "@hono/hono/cookie";
import { serveStatic } from "@hono/hono/deno";
import { HTTPException } from "@hono/hono/http-exception";
import { StatusCode } from "@hono/hono/utils/http-status";
import { Do } from "@qnighy/metaflow/do";
import { STATUS_CODE } from "@std/http";
import { ulid } from "@std/ulid";

import { Top } from "./App.tsx";
import {
  addAuthChallenge,
  addAuthPasskey,
  addSession,
  AuthUserName,
  AuthUserNameWithAuthenticationResponse,
  AuthUserNameWitRregistrationResponse,
  setAuthAuthorizationOptions,
  setAuthChallenge,
  setAuthCredentialPasskey,
  setAuthPasskeys,
  setAuthRegistrationOptions,
  setAuthVerifiedPasskey,
  setSession,
} from "./data.ts";
import { env } from "./env.ts";
import { Auth, Session } from "./schema.ts";
import { DataError, LogTimer } from "./utils.ts";

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

const rp: Auth["rp"] = {
  name: "My WebAuthn App",
  id: env.API_DOMAIN,
  origin: env.API_ORIGIN,
};

export const auth = new Hono().basePath("/auth")
  .get("/attestation/option", async (c) => {
    const { userName } = c.req.query();

    const wf = Do({ userName: userName, rp: rp })
      .pipe(AuthUserName)
      .pipeAwait(setAuthPasskeys)
      .pipeAwait(setAuthRegistrationOptions)
      .pipeAwait(addAuthChallenge);

    const result = await wf.done().catch((err) => {
      if (err instanceof DataError) {
        throw new HTTPException(err.errorCode as StatusCode, { message: err.message });
      } else {
        throw new HTTPException(STATUS_CODE.InternalServerError, { message: "unhandled error", cause: err });
      }
    });
    return c.json({ status: "success", options: result.registrationOptions }, STATUS_CODE.OK);
  })
  .post("/attestation/result", async (c) => {
    const { userName, body } = await c.req.json();

    const wf = Do({ userName: userName, rp: rp, response: body })
      .pipe(AuthUserNameWitRregistrationResponse)
      .pipeAwait(setAuthChallenge)
      .pipeAwait(setAuthCredentialPasskey)
      .pipeAwait(addAuthPasskey);

    const _result = await wf.done().catch((err) => {
      if (err instanceof DataError) {
        throw new HTTPException(err.errorCode as StatusCode, { message: err.message });
      } else {
        throw new HTTPException(STATUS_CODE.InternalServerError, { message: "unhandled error", cause: err });
      }
    });
    return c.json({ verified: true }, STATUS_CODE.Created);
  })
  .get("/assertion/option", async (c) => {
    const { userName } = c.req.query();

    const wf = Do({ userName: userName, rp: rp })
      .pipe(AuthUserName)
      .pipeAwait(setAuthPasskeys)
      .pipeAwait(setAuthAuthorizationOptions)
      .pipeAwait(addAuthChallenge);

    const result = await wf.done().catch((err) => {
      if (err instanceof DataError) {
        throw new HTTPException(err.errorCode as StatusCode, { message: err.message });
      } else {
        throw new HTTPException(STATUS_CODE.InternalServerError, { message: "unhandled error", cause: err });
      }
    });
    return c.json({ status: "success", options: result.authorizationOptions }, STATUS_CODE.OK);
  })
  .post("/assertion/result", async (c) => {
    const { userName, body } = await c.req.json();

    const wf = Do({ userName: userName, rp: rp, response: body })
      .pipe(AuthUserNameWithAuthenticationResponse)
      .pipeAwait(setAuthChallenge)
      .pipeAwait(setAuthPasskeys)
      .pipeAwait(setAuthVerifiedPasskey)
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

    const _result = await wf.done().catch((err) => {
      if (err instanceof DataError) {
        throw new HTTPException(err.errorCode as StatusCode, { message: err.message });
      } else {
        throw new HTTPException(STATUS_CODE.InternalServerError, { message: "unhandled error", cause: err });
      }
    });
    return c.json({ verified: true }, STATUS_CODE.Created);
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
