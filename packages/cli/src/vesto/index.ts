import type { Command } from "commander";
import { createConfig } from "./config-create";
import { createPool } from "./pool-create";

export const setupVestoProgram = (program: Command) => {
  createConfig(program);
  createPool(program);
};
