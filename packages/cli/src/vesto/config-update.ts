import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { VestoContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseDate, parseKey } from "../utils";

export function updateVestingPeriod(program: Command) {
  program
    .command("vesto-config-vesting-period")
    .description("updates vesting period")
    .requiredOption("--config-k <string>", "config key", parseKey)
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
    .action(
      async ({
        configK,
        initialUnlockDate,
        vestingStartDate,
        vestingEndDate,
      }: {
        configK: PublicKey;
        initialUnlockDate: Date;
        vestingStartDate: Date;
        vestingEndDate: Date;
      }) => {
        const { provider, priorityLevel, simulate } = useContext();

        const vestoContext = new VestoContext(provider);
        const config = await vestoContext.loadConfig(configK);

        const signature = await vestoContext.updateVestingPeriod({
          config,
          initialUnlockDate,
          vestingStartDate,
          vestingEndDate,
          priorityLevel,
          simulate,
        });

        console.log(signature);
      },
    );
}
