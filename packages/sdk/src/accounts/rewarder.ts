import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { SafeAmount } from "@stabbleorg/anchor-contrib";
import { RewarderContext } from "../programs";

export type RewarderData = {
  admin: PublicKey;
  mint: PublicKey;
  decimals: number;
  authorityBump: number;
  cumulativeRewards: BN;
  totalRewards: BN;
  totalRewardsClaimed: BN;
  totalWeights: BN;
  rewardsPerWeight: BN;
  numPools: number;
  epochIndex: number;
  epochStartsAt: BN;
  epochEndsAt: BN;
  epochDuration: BN;
  lastUpdatedAt: BN;
  parentRewarder: PublicKey | null;
};

export class Rewarder {
  static REWARDS_PER_WEIGHT_PRECISION: BN = new BN("1000000000");

  constructor(
    readonly address: PublicKey,
    readonly data: RewarderData,
    readonly parentRewarder?: Rewarder,
  ) {
    if (parentRewarder) {
      if (!data.parentRewarder?.equals(parentRewarder.address))
        throw new Error("Invalid parent rewarder");
    }
  }

  get authorityAddress(): PublicKey {
    return RewarderContext.getRewarderAuthorityAddress(this.address);
  }

  get mintAddress(): PublicKey {
    return this.data.mint;
  }

  get cumulativeRewards(): number {
    return SafeAmount.toUiAmount(
      this.data.cumulativeRewards,
      this.data.decimals,
    );
  }

  get totalRewards(): number {
    return SafeAmount.toUiAmount(this.data.totalRewards, this.data.decimals);
  }

  get totalRewardsClaimed(): number {
    return SafeAmount.toUiAmount(
      this.data.totalRewardsClaimed,
      this.data.decimals,
    );
  }

  get dailyRewards(): number {
    return SafeAmount.toUiAmount(
      this.data.totalRewards.muln(86400).div(this.data.epochDuration),
      this.data.decimals,
    );
  }

  get totalWeights(): number {
    return SafeAmount.toUiAmount(this.data.totalWeights, this.data.decimals);
  }

  get startsAt(): Date {
    return new Date(this.data.epochStartsAt.toNumber() * 1000);
  }

  get endsAt(): Date {
    return new Date(this.data.epochEndsAt.toNumber() * 1000);
  }
}
