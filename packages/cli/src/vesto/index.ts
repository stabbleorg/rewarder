import type { Command } from "commander";
import { createConfig } from "./config-create";
import { fetchConfig } from "./config-fetch";
import { createPool } from "./pool-create";
import { redeem } from "./redeem";
import { unstake } from "./unstake";
import { claim } from "./claim";

export const setupVestoProgram = (program: Command) => {
  createConfig(program);
  fetchConfig(program);
  createPool(program);
  redeem(program);
  unstake(program);
  claim(program);
};
