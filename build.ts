import { denoPlugins } from "@luca/esbuild-deno-loader";
import * as esbuild from "esbuild";

await esbuild.build({
  plugins: [...denoPlugins()],
  entryPoints: ["./src/script.ts"],
  outdir: "./public/dist/",
  bundle: true,
  minify: true,
  format: "esm",
  write: true,
});

await esbuild.stop();
