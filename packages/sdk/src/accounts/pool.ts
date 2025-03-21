import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { SafeAmount } from "@stabbleorg/anchor-contrib";
import {
  ONE_DAY_SECONDS,
  ONE_MONTH_SECONDS,
  ONE_WEEK_SECONDS,
  Rewarder,
} from "./rewarder";

export type PoolData = {
  rewarder: PublicKey;
  mint: PublicKey;
  decimals: number;
  weight: number;
  totalAmount: BN;
  totalRewardsDebt: BN;
  totalRewardsCredit: BN;
  totalRewardsDistributed: BN;
  totalWeights: BN;
  rewardsPerAmount: BN;
  numMiners: number;
};

export class Pool {
  static REWARDS_PER_AMOUNT_PRECISION: BN = new BN("1000000000");

  constructor(
    readonly rewarder: Rewarder,
    readonly address: PublicKey,
    readonly data: PoolData,
  ) {
    if (!rewarder.address.equals(data.rewarder))
      throw new Error("Invalid rewarder");
  }

  get dailyRewardsPerAmount(): number {
    if (this.data.totalAmount.eq(new BN(0))) return 0;
    if (this.rewarder.data.totalWeights.eq(new BN(0))) return 0;

    return SafeAmount.toUiAmount(
      this.rewarder.data.totalRewards
        .mul(ONE_DAY_SECONDS)
        .div(this.rewarder.data.epochDuration)
        .mul(this.data.totalWeights)
        .div(this.rewarder.data.totalWeights)
        .mul(new BN(10 ** this.rewarder.data.decimals))
        .div(this.data.totalAmount),
      this.rewarder.data.decimals,
    );
  }

  get weeklyRewardsPerAmount(): number {
    if (this.data.totalAmount.eq(new BN(0))) return 0;
    if (this.rewarder.data.totalWeights.eq(new BN(0))) return 0;

    return SafeAmount.toUiAmount(
      this.rewarder.data.totalRewards
        .mul(ONE_WEEK_SECONDS)
        .div(this.rewarder.data.epochDuration)
        .mul(this.data.totalWeights)
        .div(this.rewarder.data.totalWeights)
        .mul(new BN(10 ** this.rewarder.data.decimals))
        .div(this.data.totalAmount),
      this.rewarder.data.decimals,
    );
  }

  get monthlyRewardsPerAmount(): number {
    if (this.data.totalAmount.eq(new BN(0))) return 0;
    if (this.rewarder.data.totalWeights.eq(new BN(0))) return 0;

    return SafeAmount.toUiAmount(
      this.rewarder.data.totalRewards
        .mul(ONE_MONTH_SECONDS)
        .div(this.rewarder.data.epochDuration)
        .mul(this.data.totalWeights)
        .div(this.rewarder.data.totalWeights)
        .mul(new BN(10 ** this.rewarder.data.decimals))
        .div(this.data.totalAmount),
      this.rewarder.data.decimals,
    );
  }

  get dailyRewards(): number {
    if (this.data.totalAmount.eq(new BN(0))) return 0;
    if (this.rewarder.data.totalWeights.eq(new BN(0))) return 0;

    return SafeAmount.toUiAmount(
      this.rewarder.data.totalRewards
        .mul(ONE_DAY_SECONDS)
        .div(this.rewarder.data.epochDuration)
        .mul(this.data.totalWeights)
        .div(this.rewarder.data.totalWeights),
      this.rewarder.data.decimals,
    );
  }

  get weeklyRewards(): number {
    if (this.data.totalAmount.eq(new BN(0))) return 0;
    if (this.rewarder.data.totalWeights.eq(new BN(0))) return 0;

    return SafeAmount.toUiAmount(
      this.rewarder.data.totalRewards
        .mul(ONE_WEEK_SECONDS)
        .div(this.rewarder.data.epochDuration)
        .mul(this.data.totalWeights)
        .div(this.rewarder.data.totalWeights),
      this.rewarder.data.decimals,
    );
  }

  get monthlyRewards(): number {
    if (this.data.totalAmount.eq(new BN(0))) return 0;
    if (this.rewarder.data.totalWeights.eq(new BN(0))) return 0;

    return SafeAmount.toUiAmount(
      this.rewarder.data.totalRewards
        .mul(ONE_MONTH_SECONDS)
        .div(this.rewarder.data.epochDuration)
        .mul(this.data.totalWeights)
        .div(this.rewarder.data.totalWeights),
      this.rewarder.data.decimals,
    );
  }

  get mintAddress(): PublicKey {
    return this.data.mint;
  }

  get weight(): number {
    return this.data.weight;
  }

  get totalAmount(): number {
    return SafeAmount.toUiAmount(this.data.totalAmount, this.data.decimals);
  }

  get totalWeights(): number {
    return SafeAmount.toUiAmount(this.data.totalWeights, this.data.decimals);
  }
}
