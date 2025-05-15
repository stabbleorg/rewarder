import type { Command } from "commander";
import { createGoverno } from "./governo-create";
import { updateRewarder } from "./governo-rewarder";
import { closeGoverno } from "./governo-close";

export const setupGovernoProgram = (program: Command) => {
  createGoverno(program);
  updateRewarder(program);
  closeGoverno(program);
};
