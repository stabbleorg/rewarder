import type { Command } from "commander";
import { createRewarder } from "./rewarder-create";
import { updateRewarder } from "./rewarder-update";
import { deriveRewarder } from "./rewarder-derive";
import { closeRewarder } from "./rewarder-close";
import { createPool } from "./pool-create";
import { updatePool } from "./pool-update";
import { closePool } from "./pool-close";
import { withdrawMiner } from "./miner-withdraw";
import { fetchRewarder } from "./rewarder-fetch";
import { fetchPools } from "./pool-fetch";

export const setupRewarderProgram = (program: Command) => {
  createRewarder(program);
  updateRewarder(program);
  deriveRewarder(program);
  closeRewarder(program);
  createPool(program);
  updatePool(program);
  closePool(program);
  withdrawMiner(program);
  fetchRewarder(program);
  fetchPools(program);
};
