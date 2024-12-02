import { hc } from "@hono/hono/client";
import { type Context, register } from "@kt3k/cell";
import { Do } from "@qnighy/metaflow/do";
import * as SimpleWebAuthnBrowser from "@simplewebauthn/browser";
import {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";
import * as v from "@valibot/valibot";

import { AuthAppType } from "./server.tsx";

const authClient = hc<AuthAppType>("/");

export const PublicKeyCredentialCreationOptionsSchema = v.custom<PublicKeyCredentialCreationOptionsJSON>((data) => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  return true;
});

export const RegistrationResponseSchema = v.custom<RegistrationResponseJSON>((data) => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  return true;
});

export const PublicKeyCredentialRequestOptionsSchema = v.custom<PublicKeyCredentialRequestOptionsJSON>((data) => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  return true;
});

export const AuthenticationResponseSchema = v.custom<AuthenticationResponseJSON>((data) => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  return true;
});

export const AuthSchema = v.object({
  userName: v.string(),
  registrationOptions: v.optional(PublicKeyCredentialCreationOptionsSchema),
  registrationResponse: v.optional(RegistrationResponseSchema),
  authorizationOptions: v.optional(PublicKeyCredentialRequestOptionsSchema),
  authorizationResponse: v.optional(AuthenticationResponseSchema),
});

export type Auth = v.InferOutput<typeof AuthSchema>;

export const AuthUserName = (auth: { userName: Auth["userName"] }): Auth => {
  return {
    userName: auth.userName,
  };
};

export const setAuthRegistrationOptions = async (auth: Auth): Promise<Auth> => {
  const optionsResponse = await authClient.auth.attestation.option.$get(
    { query: { userName: auth.userName } },
  );
  if (!optionsResponse.ok) {
    throw new Error(`認証に失敗しました1: ${await optionsResponse.text()}`);
  }

  const { options } = await optionsResponse.json();
  return {
    ...auth,
    registrationOptions: options,
  };
};

export const setAuthRegistrationResponse = async (auth: Auth): Promise<Auth> => {
  const registration = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: auth.registrationOptions! });
  return {
    ...auth,
    registrationResponse: registration,
  };
};

export const setAuthAuthorizationOptions = async (auth: Auth): Promise<Auth> => {
  const optionsResponse = await authClient.auth.assertion.option.$get(
    { query: { userName: auth.userName } },
  );
  if (!optionsResponse.ok) {
    throw new Error(`認証に失敗しました: ${await optionsResponse.text()}`);
  }
  const { options } = await optionsResponse.json();

  return {
    ...auth,
    authorizationOptions: options,
  };
};

export const setAuthAuthorizationResponse = async (auth: Auth): Promise<Auth> => {
  const authentication = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: auth.authorizationOptions! });
  return {
    ...auth,
    authorizationResponse: authentication,
  };
};

export const verifyAuthRegistration = async (auth: Auth): Promise<void> => {
  const verificationResponse = await authClient.auth.attestation.result.$post(
    {
      json: { userName: auth.userName, body: auth.registrationResponse },
    },
    {
      headers: { "Content-Type": "application/json" },
    },
  );
  if (!verificationResponse.ok) {
    throw new Error(`認証に失敗しました2: ${await verificationResponse.text()}`);
  }

  const verification = await verificationResponse.json();
  if (!verification.verified) {
    throw new Error("登録に失敗しました");
  }
};

export const verifyAuthAuthorization = async (auth: Auth): Promise<void> => {
  const verificationResponse = await authClient.auth.assertion.result.$post(
    {
      json: { userName: auth.userName, body: auth.authorizationResponse },
    },
    {
      headers: { "Content-Type": "application/json" },
    },
  );
  if (!verificationResponse.ok) {
    throw new Error(`認証に失敗しました: ${await verificationResponse.text()}`);
  }

  const verification = await verificationResponse.json();
  if (!verification.verified) {
    throw new Error("登録に失敗しました");
  }
};

const AuthJS = ({ on, query }: Context) => {
  on("click", ".js-register", async () => {
    const userName = query<HTMLInputElement>(".userName")?.value;

    const wf = Do({ userName: userName! })
      .pipe(AuthUserName)
      .pipeAwait(setAuthRegistrationOptions)
      .pipeAwait(setAuthRegistrationResponse)
      .pipeAwait(verifyAuthRegistration);

    const _result = await wf.done().catch((err) => {
      alert(err);
      return;
    });

    alert("登録に成功しました");
  });

  on("click", ".js-verify", async () => {
    const userName = query<HTMLInputElement>(".userName")?.value;

    const wf = Do({ userName: userName! })
      .pipe(AuthUserName)
      .pipeAwait(setAuthAuthorizationOptions)
      .pipeAwait(setAuthAuthorizationResponse)
      .pipeAwait(verifyAuthAuthorization);

    const _result = await wf.done().catch((err) => {
      alert(err);
      return;
    });

    alert("登録に成功しました");
  });
};

register(AuthJS, "js-auth");
