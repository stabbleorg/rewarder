import type { Command } from "commander";
import { createRewarder } from "./rewarder-create";
import { updateAdmin, updateRewarder } from "./rewarder-update";
import { deriveRewarder } from "./rewarder-derive";
import { closeRewarder } from "./rewarder-close";
import { createPool } from "./pool-create";
import { updatePool } from "./pool-update";
import { closePool } from "./pool-close";
import { withdrawMiner } from "./miner-withdraw";
import { fetchRewarder } from "./rewarder-fetch";
import { fetchPools } from "./pool-fetch";
import { reduceRewarderEmissions } from "./rewarder-reduce";

export const setupRewarderProgram = (program: Command) => {
  createRewarder(program);
  updateAdmin(program);
  updateRewarder(program);
  reduceRewarderEmissions(program);
  deriveRewarder(program);
  closeRewarder(program);
  createPool(program);
  updatePool(program);
  closePool(program);
  withdrawMiner(program);
  fetchRewarder(program);
  fetchPools(program);
};
