import type { Command } from "commander";
import { createGoverno } from "./governo-create";
import { updateAdmin, updateRewarder, updateRealm } from "./governo-update";
import { closeGoverno } from "./governo-close";
import { lockerVotingWeight } from "./locker-voting-weight";
import {governoAll} from "./governo-all";
import {loadLockers} from "./load-lockers";

export const setupGovernoProgram = (program: Command) => {
  createGoverno(program);
  updateAdmin(program);
  updateRewarder(program);
  updateRealm(program);
  closeGoverno(program);
  lockerVotingWeight(program);
  governoAll(program);
  loadLockers(program);
};
