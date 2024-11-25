import * as v from "valibot";

const Env = v.object({
  API_DOMAIN: v.string(),
  API_ORIGIN: v.pipe(v.string(), v.url()),
  DATABASE_URL: v.string(),
});

export const env = v.parse(Env, Deno.env.toObject());
