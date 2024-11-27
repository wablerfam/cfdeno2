import { configure, getConsoleSink, getLogger } from "@logtape/logtape";

import { env } from "./env.ts";

await configure({
  sinks: { console: getConsoleSink() },
  loggers: [
    { category: ["logtape", "meta"], lowestLevel: "fatal", sinks: ["console"] },
    { category: env.API_DOMAIN, lowestLevel: "debug", sinks: ["console"] },
  ],
});

export const logger = getLogger([env.API_DOMAIN]);

export class LogTimer {
  private method: string;
  private path: string;
  private startTime: number;

  constructor(method: string, path: string) {
    this.method = method;
    this.path = path;
    this.startTime = Date.now();

    logger.debug(`${method} ${path}`);
  }

  stop(status: number): void {
    const delta = Date.now() - this.startTime;
    let n = [delta < 10000 ? delta + "ms" : Math.round(delta / 1000) + "s"];
    n = n.toString().split(".");
    n[0] = n[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1" + ",");

    logger.debug(`${this.method} ${this.path} ${status} ${n.join(".")}`);
  }
}
