import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { RewarderContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function closeRewarder(program: Command) {
  program
    .command("rewarder-close")
    .description("close the rewarder")
    .requiredOption("--rewarder-k <string>", "rewarder key", parseKey)
    .action(async ({ rewarderK }: { rewarderK: PublicKey }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const rewarderContext = new RewarderContext(provider);

      const rewarder = await rewarderContext.loadRewarder(rewarderK);

      const signature = await rewarderContext.closeRewarder({
        rewarder,
        priorityLevel,
        simulate,
      });

      console.log(signature);
    });
}
