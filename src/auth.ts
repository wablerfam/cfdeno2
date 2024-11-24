import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/types";
import { number } from "valibot";

type Passkey = {
  id: string;
  credentialId: string;
  publicKey: Uint8Array;
  userName: string;
  counter: number;
};

type Challenge = string;

export type Session = {
  sessionId: string;
  userName: string;
  expirationTtl: number;
};

const kv = await Deno.openKv("./db/kv.db");

const findPasskeys = async (userName: string): Promise<Passkey[]> => {
  const entries = kv.list<Passkey>({ prefix: ["passkey", userName] });
  const passkeys: Passkey[] = [];
  for await (const entry of entries) {
    passkeys.push(entry.value);
  }
  return passkeys;
};

const addPasskey = async (passkey: Passkey): Promise<undefined> => {
  await kv.set(["passkey", passkey.userName, passkey.id], passkey);
};

const updatePasskey = async (passkey: Passkey): Promise<undefined> => {
  await kv.set(["passkey", passkey.userName, passkey.id], passkey);
};

const findChallenge = async (userName: string): Promise<Challenge | null> => {
  const entry = await kv.get<Challenge>(["challenge", userName]);
  return entry.value;
};

const addChallenge = async (userName: string, challenge: Challenge): Promise<undefined> => {
  await kv.set(["challenge", userName], challenge);
};

export const getSession = async (sessionId: string) => {
  const entry = await kv.get<Session>(["session", sessionId]);
  return entry.value;
};

export const setSession = async (session: Session) => {
  await kv.set(["session", session.sessionId], session);
};

export const attestOption = async (userName: string) => {
  const passkeys = await findPasskeys(userName);

  const options = await generateRegistrationOptions({
    rpName: "My WebAuthn App",
    rpID: "localhost",
    userName: userName,
    excludeCredentials: passkeys.map((passkey) => ({ id: passkey.credentialId })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });

  await addChallenge(userName, options.challenge);

  return options;
};

export const attestResult = async (userName: string, body: RegistrationResponseJSON) => {
  const challenge = await findChallenge(userName);
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

  const passkey: Passkey = {
    id: credential.id,
    credentialId: credential.id,
    publicKey: credential.publicKey,
    userName: userName,
    counter: credential.counter,
  };

  console.log(passkey);
  await addPasskey(passkey);
};

export const assertOption = async (userName: string) => {
  const passkeys = await findPasskeys(userName);

  const options = await generateAuthenticationOptions({
    rpID: "localhost",
    allowCredentials: passkeys.map((passkey) => ({
      id: passkey.credentialId,
    })),
  });

  await addChallenge(userName, options.challenge);

  return options;
};

export const assertResult = async (userName: string, body: AuthenticationResponseJSON) => {
  const challenge = await findChallenge(userName);
  const passkeys = await findPasskeys(userName);
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

  if (verification.verified) {
    const newPasskey = structuredClone(passkey);
    passkey.counter = verification.authenticationInfo.newCounter;
    await updatePasskey(newPasskey);
    console.log(newPasskey);
  }

  return verification.verified;
};
