import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { GovernoContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function updateRealm(program: Command) {
  program
    .command("governo-realm")
    .description("updates the realm of a governo")
    .requiredOption("--governo-k <string>", "governo key", parseKey)
    .requiredOption("--realm-k <string>", "realm key", parseKey)
    .action(
      async ({
        governoK,
        realmK,
      }: {
        governoK: PublicKey;
        realmK: PublicKey;
      }) => {
        const { provider, priorityLevel, simulate } = useContext();

        const governoContext = new GovernoContext(provider);

        const governo = await governoContext.loadGoverno(governoK);

        const signature = await governoContext.updateRealm({
          governo,
          realmAddress: realmK,
          priorityLevel,
          simulate,
        });

        console.log(signature);
      },
    );
}
