import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { GovernoContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function closeGoverno(program: Command) {
  program
    .command("governo-close")
    .description("closes a governo")
    .requiredOption("--governo-k <path>", "governo key", parseKey)
    .action(async ({ governoK }: { governoK: PublicKey }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const governoContext = new GovernoContext(provider);

      const governo = await governoContext.loadGoverno(governoK);

      const signature = await governoContext.closeGoverno({
        governo,
        priorityLevel,
        simulate,
      });

      console.log(signature);
    });
}
