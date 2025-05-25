import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { GovernoContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function updateRewarder(program: Command) {
  program
    .command("governo-rewarder")
    .description("updates the rewarder of a governo")
    .requiredOption("--governo-k <string>", "governo key", parseKey)
    .requiredOption("--rewarder-k <string>", "rewarder key", parseKey)
    .action(
      async ({
        governoK,
        rewarderK,
      }: {
        governoK: PublicKey;
        rewarderK: PublicKey;
      }) => {
        const { provider, priorityLevel, simulate } = useContext();

        const governoContext = new GovernoContext(provider);

        const governo = await governoContext.loadGoverno(governoK);

        const signature = await governoContext.updateRewarder({
          governo,
          rewarderAddress: rewarderK,
          priorityLevel,
          simulate,
        });

        console.log(signature);
      },
    );
}
