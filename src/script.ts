import * as SimpleWebAuthnBrowser from "@simplewebauthn/browser";

const register = async () => {
  try {
    const userName = document.getElementById("userName").value;
    const params = new URLSearchParams({ userName: userName });
    const optionsResponse = await fetch(`/auth/attestation/option?${params}`);
    const { options } = await optionsResponse.json();
    console.log(options);
    console.log(options.challenge);

    const registration = await SimpleWebAuthnBrowser.startRegistration({
      optionsJSON: options,
    });
    console.log(registration);
    const verificationResponse = await fetch("/auth/attestation/result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userName, body: registration }),
    });
    const verification = await verificationResponse.json();

    if (verification.verified) {
      alert("登録に成功しました");
    } else {
      alert(`登録に失敗しました: ${verification.error}`);
    }
  } catch (e) {
    alert(`登録に失敗しました: ${e}`);
  }
};

const verify = async () => {
  try {
    const userName = document.getElementById("userName").value;
    const params = new URLSearchParams({ userName: userName });
    const optionsResponse = await fetch(`/auth/assertion/option?${params}`);
    const { options } = await optionsResponse.json();

    const authentication = await SimpleWebAuthnBrowser.startAuthentication({
      optionsJSON: options,
    });
    const verificationResponse = await fetch("/auth/assertion/result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userName, body: authentication }),
    });
    const verification = await verificationResponse.json();

    if (verification.verified) {
      alert("認証に成功しました");
    } else {
      alert(`認証に失敗しました: ${verification.error}`);
    }
  } catch (e) {
    alert(`認証に失敗しました: ${e}`);
  }
};

globalThis.register = register;
globalThis.verify = verify;
