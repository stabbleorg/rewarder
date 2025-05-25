import type { Command } from "commander";
import BN from "bn.js";
import bs58 from "bs58";
import { MinerData, RewarderContext } from "@stabbleorg/rewarder-sdk";
import { useContext } from "../context";
import { SafeAmount } from "@stabbleorg/anchor-contrib";

const REWARD_MINER_DISCRIMINATOR = bs58.encode(
  Uint8Array.from([223, 113, 15, 54, 123, 122, 140, 100]),
);

export function fetchPools(program: Command) {
  program
    .command("pool-fetch")
    .description("fetch pools")
    .action(async () => {
      const { provider } = useContext();

      const rewarderContext = new RewarderContext(provider);

      const rewarders = await rewarderContext.loadRewarders();
      const rewardersMap = new Map(
        rewarders.map((rewarder) => [rewarder.address.toBase58(), rewarder]),
      );

      const pools = await rewarderContext.loadPools(rewardersMap);

      console.log("Rewarders:", rewarders.length);
      console.log("Reward pools:", pools.length);

      console.log(
        rewarders
          .map((rewarder) => rewarder.parentRewarder?.address.toBase58())
          .join("\n"),
      );

      for (const pool of pools) {
        console.log(">>> Pool:", pool.address.toBase58());

        const rawAccounts = await provider.connection.getProgramAccounts(
          rewarderContext.program.programId,
          {
            filters: [
              {
                memcmp: {
                  offset: 0,
                  bytes: REWARD_MINER_DISCRIMINATOR,
                },
              },
              {
                memcmp: {
                  offset: 8,
                  bytes: pool.address.toBase58(),
                },
              },
            ],
            dataSlice: {
              offset: 0,
              length: 0, // Fetch metadata only
            },
          },
        );

        const allKeys = rawAccounts
          .map((acc) => acc.pubkey)
          .sort((a, b) => a.toBase58().localeCompare(b.toBase58()));

        let i = 0;
        while (i < allKeys.length) {
          const pageKeys = allKeys.slice(i, i + 100);

          const accountInfos =
            await provider.connection.getMultipleAccountsInfo(pageKeys);

          accountInfos.forEach((info) => {
            if (info) {
              const miner =
                rewarderContext.program.coder.accounts.decode<MinerData>(
                  "miner",
                  info.data,
                );

              if (
                miner.amount.gt(new BN(0)) &&
                miner.authority.equals(miner.beneficiary) // primary miners only
              ) {
                const owner = miner.beneficiary.toBase58();
                const amount = SafeAmount.toNano(miner.amount);

                console.log("Miner:", owner, amount);
              }
            }
          });

          i += 100;
        }
      }
    });
}
