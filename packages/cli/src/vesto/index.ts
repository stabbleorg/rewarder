import type { Command } from "commander";
import { createConfig } from "./config-create";
import { fetchConfig } from "./config-fetch";
import { fetchVault } from "./vault-fetch";
import { createPool } from "./pool-create";
import { redeem } from "./redeem";
import { unstake } from "./unstake";
import { claim } from "./claim";

export const setupVestoProgram = (program: Command) => {
  createConfig(program);
  fetchConfig(program);
  fetchVault(program);
  createPool(program);
  redeem(program);
  unstake(program);
  claim(program);
};
