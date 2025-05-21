import type { Command } from "commander";
import { createConfig } from "./config-create";
import { updateVestingPeriod } from "./config-update";
import { fetchConfig } from "./config-fetch";
import { createPool } from "./pool-create";
import { redeem } from "./redeem";
import { claim } from "./claim";

export const setupVestoProgram = (program: Command) => {
  createConfig(program);
  updateVestingPeriod(program);
  fetchConfig(program);
  createPool(program);
  redeem(program);
  claim(program);
};
