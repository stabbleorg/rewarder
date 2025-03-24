import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { SafeAmount } from "@stabbleorg/anchor-contrib";
import { Pool } from "./pool";
import { RewarderContext } from "../programs";
import { Rewarder } from "./rewarder";

export type MinerData = {
  pool: PublicKey;
  authority: PublicKey;
  beneficiary: PublicKey;
  // bump: number;
  amount: BN;
  rewardsDebt: BN;
  rewardsCredit: BN;
  rewardsClaimed: BN;
};

export class Miner {
  constructor(
    readonly pool: Pool,
    readonly data: MinerData,
  ) {
    if (!pool.address.equals(data.pool)) throw new Error("Invalid pool");
  }

  get address(): PublicKey {
    return RewarderContext.getMinerAddress(this.data.authority, this.data.pool);
  }

  get beneficiaryAddress(): PublicKey {
    return this.data.beneficiary;
  }

  get amount(): number {
    return SafeAmount.toUiAmount(this.data.amount, this.pool.data.decimals);
  }

  get rewards(): number {
    const currentTime = Math.trunc(new Date().getTime() / 1000);
    const lastUpdatedTime = this.pool.rewarder.data.lastUpdatedAt.toNumber();

    let rewardsPerAmount = this.pool.data.rewardsPerAmount;

    if (currentTime > lastUpdatedTime) {
      const elapsedTime = currentTime - lastUpdatedTime;

      let rewardsPerWeight = this.pool.rewarder.data.rewardsPerWeight;

      if (this.pool.rewarder.data.totalWeights.gt(new BN(0))) {
        rewardsPerWeight = this.pool.rewarder.data.totalRewards
          .mul(new BN(elapsedTime))
          .div(this.pool.rewarder.data.epochDuration)
          .mul(Rewarder.REWARDS_PER_WEIGHT_PRECISION)
          .div(this.pool.rewarder.data.totalWeights)
          .add(this.pool.rewarder.data.rewardsPerWeight);
      }

      if (this.pool.data.totalAmount.gt(new BN(0))) {
        rewardsPerAmount = rewardsPerWeight
          .mul(this.pool.data.totalWeights)
          .div(Rewarder.REWARDS_PER_WEIGHT_PRECISION)
          .add(this.pool.data.totalRewardsCredit)
          .sub(this.pool.data.totalRewardsDebt)
          .sub(this.pool.data.totalRewardsDistributed)
          .mul(Pool.REWARDS_PER_AMOUNT_PRECISION)
          .div(this.pool.data.totalAmount)
          .add(this.pool.data.rewardsPerAmount);
      }
    }

    return SafeAmount.toUiAmount(
      rewardsPerAmount
        .mul(this.data.amount)
        .div(Pool.REWARDS_PER_AMOUNT_PRECISION)
        .add(this.data.rewardsCredit)
        .sub(this.data.rewardsDebt)
        .sub(this.data.rewardsClaimed),
      this.pool.rewarder.data.decimals,
    );
  }

  get rewardsClaimed(): number {
    return SafeAmount.toUiAmount(
      this.data.rewardsClaimed,
      this.pool.rewarder.data.decimals,
    );
  }
}
