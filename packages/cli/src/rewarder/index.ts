import type { Command } from "commander";
import { createRewarder } from "./rewarder-create";
import { updateRewarder } from "./rewarder-update";
import { deriveRewarder } from "./rewarder-derive";
import { createPool } from "./pool-create";

export const setupRewarderProgram = (program: Command) => {
  createRewarder(program);
  updateRewarder(program);
  deriveRewarder(program);
  createPool(program);
};
