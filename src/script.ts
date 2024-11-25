import { type Context, register } from "@kt3k/cell";
import * as SimpleWebAuthnBrowser from "@simplewebauthn/browser";
import { hc } from "hono/client";
import { ResultAsync } from "neverthrow";

import { AuthAppType } from "./server.tsx";

const authClient = hc<AuthAppType>("/");

const Auth = ({ on, query }: Context) => {
  on("click", ".register", async () => {
    const userName = query<HTMLInputElement>(".userName")?.value;
    if (!userName) {
      alert("名前を入れてください");
      return;
    }

    const optionsResponse = await authClient.auth.attestation.option.$get(
      { query: { userName: userName } },
    );
    if (!optionsResponse.ok) {
      alert(`認証に失敗しました: ${await optionsResponse.text()}`);
    }
    const { options } = await optionsResponse.json();

    const startRegistrationAsync = ResultAsync.fromThrowable(SimpleWebAuthnBrowser.startRegistration);
    const registration = await startRegistrationAsync({ optionsJSON: options });
    if (!registration.isOk()) {
      alert(`認証に失敗しました: ${registration.error}`);
      return;
    }

    const verificationResponse = await authClient.auth.attestation.result.$post(
      {
        json: { userName, body: registration.value },
      },
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    if (!verificationResponse.ok) {
      alert(`認証に失敗しました: ${await verificationResponse.text()}`);
    }

    const verification = await verificationResponse.json();
    if (!verification.verified) {
      alert("登録に失敗しました");
      return;
    }

    alert("登録に成功しました");
  });

  on("click", ".verify", async () => {
    const userName = query<HTMLInputElement>(".userName")?.value;
    if (!userName) {
      alert("名前を入れてください");
      return;
    }

    const optionsResponse = await authClient.auth.assertion.option.$get(
      { query: { userName: userName } },
    );
    if (!optionsResponse.ok) {
      alert(`認証に失敗しました: ${await optionsResponse.text()}`);
    }
    const { options } = await optionsResponse.json();

    const startAuthenticationAsync = ResultAsync.fromThrowable(SimpleWebAuthnBrowser.startAuthentication);
    const authentication = await startAuthenticationAsync({ optionsJSON: options });
    if (!authentication.isOk()) {
      alert(`認証に失敗しました: ${authentication.error}`);
      return;
    }

    const verificationResponse = await authClient.auth.assertion.result.$post(
      {
        json: { userName, body: authentication.value },
      },
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    if (!verificationResponse.ok) {
      alert(`認証に失敗しました: ${await verificationResponse.text()}`);
    }

    const verification = await verificationResponse.json();

    if (!verification.verified) {
      alert("登録に失敗しました");
      return;
    }

    alert("登録に成功しました");
  });
};

register(Auth, "auth");
