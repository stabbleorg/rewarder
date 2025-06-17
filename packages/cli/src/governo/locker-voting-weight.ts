import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { GovernoContext, RewarderContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function lockerVotingWeight(program: Command) {
  program
    .command("locker-voting-weight")
    .description("deposit voting weight")
    .requiredOption("--locker-k <path>", "locker key", parseKey)
    .action(async ({ lockerK }: { lockerK: PublicKey }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const governoContext = new GovernoContext(provider);
      const rewarderContext = new RewarderContext(provider);

      const locker = await governoContext.loadLocker(lockerK);
      const rewarder = await rewarderContext.loadRewarder(
        locker.governo.rewarderAddress,
      );
      const pools = await rewarderContext.loadPoolsByRewarder(rewarder);

      let signature = "";

      if (locker.votingWeightUsed === 0) {
        signature = await governoContext.depositVotingWeight({
          locker,
          pool: pools.find((pool) =>
            pool.mintAddress.equals(locker.governo.veMintAddress),
          )!,
          priorityLevel,
          simulate,
        });
      } else if (locker.votingWeight === 0) {
        signature = await governoContext.withdrawVotingWeight({
          locker,
          pool: pools.find((pool) =>
            pool.mintAddress.equals(locker.governo.veMintAddress),
          )!,
          priorityLevel,
          simulate,
        });
      }

      console.log(signature);
    });
}
