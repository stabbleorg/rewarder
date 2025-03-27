import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { RewarderContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function deriveRewarder(program: Command) {
  program
    .command("rewarder-derive")
    .description("derive the rewarder")
    .requiredOption("--rewarder-k <string>", "rewarder key", parseKey)
    .requiredOption(
      "--parent-rewarder-k <string>",
      "parent rewarder key",
      parseKey,
    )
    .action(
      async ({
        rewarderK,
        parentRewarderK,
      }: {
        rewarderK: PublicKey;
        parentRewarderK: PublicKey;
      }) => {
        const { provider, priorityLevel, simulate } = useContext();

        const rewarderContext = new RewarderContext(provider);

        const signature = await rewarderContext.deriveRewarder({
          rewarderAddress: rewarderK,
          parentRewarderAddress: parentRewarderK,
          priorityLevel,
          simulate,
        });

        console.log(signature);
      },
    );
}
