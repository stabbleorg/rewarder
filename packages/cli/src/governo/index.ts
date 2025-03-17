import type { Command } from "commander";
import { createGoverno } from "./governo-create";

export const setupGovernoProgram = (program: Command) => {
  createGoverno(program);
};
