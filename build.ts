import { denoPlugins } from "@luca/esbuild-deno-loader";
import * as esbuild from "esbuild";

const isWatchMode = Deno.args.includes("watch");

const options: esbuild.BuildOptions = {
  plugins: [...denoPlugins()],
  entryPoints: ["./src/script.ts"],
  outdir: "./public/dist/",
  bundle: true,
  minify: true,
  format: "esm",
  write: true,
};

if (isWatchMode) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("Watching for file changes...");
} else {
  await esbuild.build(options);
  await esbuild.stop();
  console.log("Build completed!");
}
