import * as SimpleWebAuthnBrowser from "@simplewebauthn/browser";
import { hc } from "hono/client";

import { AuthAppType } from "./server.tsx";

const authClient = hc<AuthAppType>("/");

const register = async () => {
  try {
    const userName = document.getElementById("userName").value;

    const optionsResponse = await authClient.auth.attestation.option.$get(
      { query: { userName: userName } },
    );
    const { options } = await optionsResponse.json();

    const registration = await SimpleWebAuthnBrowser.startRegistration({
      optionsJSON: options,
    });

    const verificationResponse = await authClient.auth.attestation.result.$post(
      {
        json: { userName, body: registration },
      },
      {
        headers: { "Content-Type": "application/json" },
      },
    );

    const verification = await verificationResponse.json();
    if (verification.verified) {
      alert("登録に成功しました");
    } else {
      // alert(`登録に失敗しました: ${verification.error}`);
      alert(`登録に失敗しました:`);
    }
  } catch (e) {
    alert(`登録に失敗しました: ${e}`);
  }
};

const verify = async () => {
  try {
    const userName = document.getElementById("userName").value;

    const optionsResponse = await authClient.auth.assertion.option.$get(
      { query: { userName: userName } },
    );
    const { options } = await optionsResponse.json();

    const authentication = await SimpleWebAuthnBrowser.startAuthentication({
      optionsJSON: options,
    });

    const verificationResponse = await authClient.auth.assertion.result.$post(
      {
        json: { userName, body: authentication },
      },
      {
        headers: { "Content-Type": "application/json" },
      },
    );

    const verification = await verificationResponse.json();

    if (verification.verified) {
      alert("認証に成功しました");
    } else {
      // alert(`認証に失敗しました: ${verification.error}`);
      alert(`登録に失敗しました:`);
    }
  } catch (e) {
    alert(`認証に失敗しました: ${e}`);
  }
};

globalThis.register = register;
globalThis.verify = verify;
