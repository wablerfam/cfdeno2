import * as v from "@valibot/valibot";

const Env = v.object({
  API_DOMAIN: v.string(),
  API_ORIGIN: v.pipe(v.string(), v.url()),
  DATABASE_URL: v.nullish(v.string()),
});

export const env = v.parse(Env, Deno.env.toObject());
