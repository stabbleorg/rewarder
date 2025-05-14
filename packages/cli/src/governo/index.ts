import type { Command } from "commander";
import { createGoverno } from "./governo-create";
import { closeGoverno } from "./governo-close";

export const setupGovernoProgram = (program: Command) => {
  createGoverno(program);
  closeGoverno(program);
};
