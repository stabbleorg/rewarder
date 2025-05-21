import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SafeAmount } from "@stabbleorg/anchor-contrib";
import { Governo } from "../governo";
import { VestoContext } from "../../programs";

export type VestingConfigData = {
  governo: PublicKey;
  // authorityBump: number;
  initialUnlockTime: BN;
  vestingStartTime: BN;
  vestingEndTime: BN;
  vestingDuration: BN;
  releaseInterval: BN;
  initialUnlockBps: number;
  totalCapacity: BN;
  totalAmount: BN;
  totalClaimed: BN;
  activePools: number;
};

export class VestingConfig {
  public data: VestingConfigData;

  constructor(
    readonly governo: Governo,
    readonly address: PublicKey,
    data: VestingConfigData,
  ) {
    this.data = data;
  }

  refreshData(updatedData: Partial<VestingConfigData>) {
    this.data = { ...this.data, ...updatedData };
  }

  get authorityAddress(): PublicKey {
    return VestoContext.getVaultAuthorityAddress(this.address);
  }

  get lockDuration(): number {
    return this.data.vestingStartTime
      .sub(this.data.initialUnlockTime)
      .toNumber();
  }

  get initialUnlockDate(): Date {
    return new Date(this.data.initialUnlockTime.toNumber() * 1000);
  }

  get vestingStartDate(): Date {
    return new Date(this.data.vestingStartTime.toNumber() * 1000);
  }

  get vestingEndDate(): Date {
    return new Date(this.data.vestingEndTime.toNumber() * 1000);
  }

  get totalCapacity(): number {
    return SafeAmount.toUiAmount(
      this.data.totalCapacity,
      this.governo.data.decimals,
    );
  }

  get totalAmount(): number {
    return SafeAmount.toUiAmount(
      this.data.totalAmount,
      this.governo.data.decimals,
    );
  }

  get totalClaimed(): number {
    return SafeAmount.toUiAmount(
      this.data.totalClaimed,
      this.governo.data.decimals,
    );
  }

  get initialUnlockRate(): number {
    return this.data.initialUnlockBps / 1e4;
  }

  getAssociatedTokenAddress(
    mintAddress: PublicKey,
    programId?: PublicKey,
  ): PublicKey {
    return getAssociatedTokenAddressSync(
      mintAddress,
      this.authorityAddress,
      true,
      programId,
    );
  }
}
