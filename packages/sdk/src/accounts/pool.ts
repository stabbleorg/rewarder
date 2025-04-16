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

  public data: PoolData;

  constructor(
    readonly rewarder: Rewarder,
    readonly address: PublicKey,
    data: PoolData,
  ) {
    if (!rewarder.address.equals(data.rewarder))
      throw new Error("Invalid rewarder");

    this.data = data;
  }

  refreshData(updatedData: Partial<PoolData>) {
    this.data = { ...this.data, ...updatedData };
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
        .mul(new BN(10 ** this.data.decimals))
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
        .mul(new BN(10 ** this.data.decimals))
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
        .mul(new BN(10 ** this.data.decimals))
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

  get shares(): number {
    if (this.rewarder.totalWeights === 0) {
      return 1;
    }

    return this.totalWeights / this.rewarder.totalWeights;
  }

  get sharesPerAmount(): number {
    return this.shares / this.totalAmount;
  }

  get totalAmount(): number {
    return SafeAmount.toUiAmount(this.data.totalAmount, this.data.decimals);
  }

  get totalWeights(): number {
    return SafeAmount.toUiAmount(
      this.data.totalWeights,
      this.rewarder.data.decimals,
    );
  }
}
