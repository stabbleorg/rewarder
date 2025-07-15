import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { GovernoContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function updateAdmin(program: Command) {
  program
    .command("governo-admin")
    .description("updates admin of the governo")
    .requiredOption("--governo-k <string>", "governo key", parseKey)
    .requiredOption("--admin-k <string>", "new admin key", parseKey)
    .action(
      async ({
        governoK,
        adminK,
      }: {
        governoK: PublicKey;
        adminK: PublicKey;
      }) => {
        const { provider, priorityLevel, simulate } = useContext();

        const governoContext = new GovernoContext(provider);

        const governo = await governoContext.loadGoverno(governoK);

        const signature = await governoContext.updateAdmin({
          governo,
          adminAddress: adminK,
          priorityLevel,
          simulate,
        });

        console.log(signature);
      },
    );
}

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
