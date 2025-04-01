import type { Command } from "commander";
import { createRewarder } from "./rewarder-create";
import { updateRewarder } from "./rewarder-update";
import { deriveRewarder } from "./rewarder-derive";
import { createPool } from "./pool-create";
import { updatePool } from "./pool-update";
import { withdrawMiner } from "./miner-withdraw";
import { fetchPools } from "./pool-fetch";
import { fetchRewarder } from "./rewarder-fetch";

export const setupRewarderProgram = (program: Command) => {
  createRewarder(program);
  updateRewarder(program);
  deriveRewarder(program);
  createPool(program);
  updatePool(program);
  withdrawMiner(program);
  fetchRewarder(program);
  fetchPools(program);
};
