import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { SafeAmount } from "@stabbleorg/anchor-contrib";
import { VestingConfig } from "./config";
import { VestoContext } from "../../programs";

export type VestingPoolData = {
  config: PublicKey;
  iouMint: PublicKey;
  totalAmount: BN;
  totalRedeemed: BN;
  activePositions: number;
};

export class VestingPool {
  public data: VestingPoolData;

  constructor(
    readonly config: VestingConfig,
    data: VestingPoolData,
  ) {
    this.data = data;
  }

  refreshData(updatedData: Partial<VestingPoolData>) {
    this.data = { ...this.data, ...updatedData };
  }

  get address(): PublicKey {
    return VestoContext.getPoolAddress(this.config.address, this.data.iouMint);
  }

  get iouMintAddress(): PublicKey {
    return this.data.iouMint;
  }

  get totalAmount(): number {
    return SafeAmount.toUiAmount(
      this.data.totalAmount,
      this.config.governo.data.decimals,
    );
  }

  get totalRedeemed(): number {
    return SafeAmount.toUiAmount(
      this.data.totalRedeemed,
      this.config.governo.data.decimals,
    );
  }
}
