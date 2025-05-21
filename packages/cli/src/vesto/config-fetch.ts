import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { GovernoContext, VestoContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function fetchConfig(program: Command) {
  program
    .command("vesto-config-fetch")
    .description("")
    .requiredOption("--governo-k <string>", "governo key", parseKey)
    .action(async ({ governoK }: { governoK: PublicKey }) => {
      const { provider } = useContext();

      const governoContext = new GovernoContext(provider);
      const governo = await governoContext.loadGoverno(governoK);

      const vestoContext = new VestoContext(provider);
      const configs = await vestoContext.loadConfigs(governo);

      for (const config of configs) {
        console.log("Vesting config:", config.address.toBase58());
        console.log("Faucet:", config.authorityAddress.toBase58());
        console.log("Lock duration:", config.lockDuration);
        console.log("Initial unlock:", config.initialUnlockDate.toISOString());
        console.log("Initial rate:", config.initialUnlockRate);
        console.log("Vesting start:", config.vestingStartDate.toISOString());
        console.log("Vesting end:", config.vestingEndDate.toISOString());
        console.log(
          "Initial unlock:",
          config.totalCapacity * config.initialUnlockRate,
        );
        console.log("Total claimed:", config.totalClaimed);
        console.log("Total capacity:", config.totalCapacity);
        console.log("\n");
      }
    });
}
