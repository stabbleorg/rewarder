import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
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
  public data: MinerData;

  constructor(
    readonly pool: Pool,
    data: MinerData,
  ) {
    if (!pool.address.equals(data.pool)) throw new Error("Invalid pool");

    this.data = data;
  }

  refreshData(updatedData: Partial<MinerData>) {
    this.data = { ...this.data, ...updatedData };
  }

  get address(): PublicKey {
    return RewarderContext.getMinerAddress(this.data.authority, this.data.pool);
  }

  get authorityAddress(): PublicKey {
    return this.data.authority;
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

    let rewardsPerWeight = this.pool.rewarder.data.rewardsPerWeight;

    if (currentTime > lastUpdatedTime) {
      const elapsedTime = currentTime - lastUpdatedTime;

      if (this.pool.rewarder.data.totalWeights.gt(new BN(0))) {
        rewardsPerWeight = this.pool.rewarder.data.totalRewards
          .mul(new BN(elapsedTime))
          .div(this.pool.rewarder.data.epochDuration)
          .mul(Rewarder.REWARDS_PER_WEIGHT_PRECISION)
          .div(this.pool.rewarder.data.totalWeights)
          .add(this.pool.rewarder.data.rewardsPerWeight);
      }
    }

    let rewardsPerAmount = this.pool.data.rewardsPerAmount;

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

    const rewardsClaimable = rewardsPerAmount
      .mul(this.data.amount)
      .div(Pool.REWARDS_PER_AMOUNT_PRECISION)
      .add(this.data.rewardsCredit)
      .sub(this.data.rewardsDebt)
      .sub(this.data.rewardsClaimed);

    if (rewardsClaimable.lte(new BN(0))) return 0;

    return SafeAmount.toUiAmount(
      rewardsClaimable,
      this.pool.rewarder.data.decimals,
    );
  }

  get rewardsClaimed(): number {
    return SafeAmount.toUiAmount(
      this.data.rewardsClaimed,
      this.pool.rewarder.data.decimals,
    );
  }

  getAssociatedTokenAddress(
    mintAddress: PublicKey,
    programId: PublicKey = TOKEN_PROGRAM_ID,
  ): PublicKey {
    return getAssociatedTokenAddressSync(
      mintAddress,
      this.address,
      true,
      programId,
    );
  }
}
