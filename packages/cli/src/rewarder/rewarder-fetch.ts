import type { Command } from "commander";
import { table } from "table";
import { PublicKey } from "@solana/web3.js";
import { RewarderContext } from "@stabbleorg/rewarder-sdk";
import { SafeAmount } from "@stabbleorg/anchor-contrib";
import { Helius } from "helius-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function fetchRewarder(program: Command) {
  program
    .command("rewarder-fetch")
    .description("report for reward pools of the rewarder")
    .requiredOption("--rewarder-k <string>", "rewarder key", parseKey)
    .action(async ({ rewarderK }: { rewarderK: PublicKey }) => {
      const { provider } = useContext();

      const rewarderContext = new RewarderContext(provider);

      const rewarder = await rewarderContext.loadRewarder(rewarderK);
      const pools = await rewarderContext.loadPools(
        new Map([[rewarder.address.toBase58(), rewarder]]),
      );

      console.log("Faucet:", rewarder.authorityAddress.toBase58());
      console.log("Total rewards:", rewarder.totalRewards);
      console.log("Total weights:", rewarder.totalWeights);
      console.log("Starts:", rewarder.startsAt);
      console.log("Ends:", rewarder.endsAt);

      const helius = new Helius(
        provider.connection.rpcEndpoint.split("api-key=")[1],
      );
      const assets = await helius.rpc.getAssetBatch({
        ids: pools.map((pool) => pool.mintAddress.toBase58()),
      });

      console.log(
        table([
          [
            "Address",
            "Mint",
            "Staked %",
            "Weight",
            "Total staked",
            "Total weights",
            "Weekly rewards",
            "Miners",
          ],
          ...pools
            // .filter((pool) => pool.totalAmount > 0)
            .sort((a, b) => b.totalWeights - a.totalWeights)
            .map((pool) => {
              const asset = assets.find(
                (asset) => asset.id === pool.mintAddress.toBase58(),
              )!;
              const supply = SafeAmount.toUiAmount(
                asset.token_info?.supply!,
                asset.token_info?.decimals!,
              );

              return [
                pool.address.toBase58(),
                asset.content?.metadata.symbol, // pool.mintAddress.toBase58(),
                ((pool.totalAmount / supply) * 100).toFixed(2) + "%",
                pool.weight + "x",
                pool.totalAmount,
                pool.totalWeights,
                pool.weeklyRewards,
                pool.data.numMiners,
              ];
            }),
        ]),
      );
    });
}
