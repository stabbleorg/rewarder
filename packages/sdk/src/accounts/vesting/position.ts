import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { SafeAmount } from "@stabbleorg/anchor-contrib";
import { VestingPool } from "./pool";
import { VestoContext } from "../../programs";

export type VestingPositionData = {
  pool: PublicKey;
  user: PublicKey;
  amount: BN;
  claimed: BN;
  // bump: number;
};

export class VestingPosition {
  public data: VestingPositionData;

  constructor(
    readonly pool: VestingPool,
    data: VestingPositionData,
  ) {
    this.data = data;
  }

  refreshData(updatedData: Partial<VestingPositionData>) {
    this.data = { ...this.data, ...updatedData };
  }

  get address(): PublicKey {
    return VestoContext.getPositionAddress(this.pool.address, this.data.user);
  }

  get authorityAddress(): PublicKey {
    return this.data.user;
  }

  get amount(): number {
    return SafeAmount.toUiAmount(
      this.data.amount,
      this.pool.config.governo.data.decimals,
    );
  }

  get claimed(): number {
    return SafeAmount.toUiAmount(
      this.data.claimed,
      this.pool.config.governo.data.decimals,
    );
  }
}
