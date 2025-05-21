import type { Command } from "commander";
import { Keypair, PublicKey } from "@solana/web3.js";
import { GovernoContext, VestoContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseDate, parseKey, parseKeypair } from "../utils";

export function createConfig(program: Command) {
  program
    .command("vesto-config-create")
    .description("creates a vesting config")
    .requiredOption("--governo-k <string>", "governo key", parseKey)
    .requiredOption(
      "--initial-unlock-date <string>",
      "initial unlock date",
      parseDate,
    )
    .requiredOption(
      "--vesting-start-date <string>",
      "vesting start date",
      parseDate,
    )
    .requiredOption(
      "--vesting-end-date <string>",
      "vesting end date",
      parseDate,
    )
    .requiredOption(
      "--initial-unlock-rate <number>",
      "initial unlock rate",
      Number,
    )
    .requiredOption("--total-capacity <number>", "total capacity")
    .option("--config-k-p <path>", "config keypair", parseKeypair)
    .action(
      async ({
        governoK,
        initialUnlockDate,
        vestingStartDate,
        vestingEndDate,
        initialUnlockRate,
        totalCapacity,
        configKP,
      }: {
        governoK: PublicKey;
        initialUnlockDate: Date;
        vestingStartDate: Date;
        vestingEndDate: Date;
        initialUnlockRate: number;
        totalCapacity: string;
        configKP?: Keypair;
      }) => {
        const { provider, priorityLevel, simulate } = useContext();

        const governoContext = new GovernoContext(provider);
        const governo = await governoContext.loadGoverno(governoK);

        const vestoContext = new VestoContext(provider);

        const { address, signature } = await vestoContext.createConfig({
          governo,
          initialUnlockDate,
          vestingStartDate,
          vestingEndDate,
          initialUnlockRate,
          totalCapacity,
          keypair: configKP,
          priorityLevel,
          simulate,
        });

        console.log("Config:", address.toBase58());
        console.log(signature);
      },
    );
}
