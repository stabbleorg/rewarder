import type { Command } from "commander";
import { createGoverno } from "./governo-create";
import { updateRewarder } from "./governo-rewarder";
import { updateRealm } from "./governo-realm";
import { closeGoverno } from "./governo-close";
import { lockerVotingWeight } from "./locker-voting-weight";

export const setupGovernoProgram = (program: Command) => {
  createGoverno(program);
  updateRewarder(program);
  updateRealm(program);
  closeGoverno(program);
  lockerVotingWeight(program);
};
