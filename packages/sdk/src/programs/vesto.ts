import BN from "bn.js";
import {
  AccountMeta,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import { Program, Provider } from "@coral-xyz/anchor";
import {
  AddressWithTransactionSignature,
  TransactionArgs,
  WalletContext,
  SafeAmount,
  DataUpdatedEvent,
  SIMULATED_SIGNATURE,
  TOKEN_MINT_RENT_FEE_LAMPORTS,
  FloatLike,
} from "@stabbleorg/anchor-contrib";
import { Governo, VestingConfig, VestingPool } from "../accounts";
import { type Vesto as IDLType } from "../generated/vesto";
import IDL from "../generated/idl/vesto.json";

export const VESTO_PROGRAM_ID = new PublicKey(IDL.address);
export const VESTO_ERRORS = new Map(
  IDL.errors.map((error) => [error.code, error.msg]),
);

export type VestoProgram = Program<IDLType>;

export class VestoContext<
  T extends Provider = Provider,
> extends WalletContext<T> {
  readonly program: VestoProgram;

  constructor(provider: T) {
    super(provider);
    this.program = new Program(IDL, provider);
  }

  async loadConfig(
    address: PublicKey,
    governo?: Governo,
  ): Promise<VestingConfig> {
    const data = await this.program.account.vestingConfig.fetch(address);

    if (!governo) {
      const governoData = await this.program.account.governo.fetch(
        data.governo,
      );
      governo = new Governo(data.governo, governoData);
    }

    return new VestingConfig(governo, address, data);
  }

  async loadConfigs(governo: Governo): Promise<VestingConfig[]> {
    const accounts = await this.program.account.vestingConfig.all([
      {
        memcmp: {
          offset: 8,
          bytes: governo.address.toBase58(),
        },
      },
    ]);

    return accounts.map(
      ({ publicKey, account }) =>
        new VestingConfig(governo, publicKey, account),
    );
  }

  async loadPools(configs: Map<string, VestingConfig>): Promise<VestingPool[]> {
    const accounts = await this.program.account.vestingPool.all();

    const pools: VestingPool[] = [];

    for (const { publicKey, account } of accounts) {
      const config = configs.get(account.config.toBase58());

      if (config) {
        pools.push(new VestingPool(config, account));
      }
    }

    return pools;
  }

  async createConfig({
    governo,
    initialUnlockDate,
    vestingStartDate,
    vestingEndDate,
    initialUnlockRate,
    totalCapacity,
    keypair = Keypair.generate(),
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    governo: Governo;
    initialUnlockDate: Date;
    vestingStartDate: Date;
    vestingEndDate: Date;
    initialUnlockRate: number;
    totalCapacity: FloatLike;
    keypair?: Keypair;
  }>): Promise<AddressWithTransactionSignature> {
    const address = keypair.publicKey;
    const authorityAddress = VestoContext.getVaultAuthorityAddress(address);

    const space = this.program.account.vestingConfig.size;
    const lamports =
      await this.provider.connection.getMinimumBalanceForRentExemption(space);

    const signature = await this.sendSmartTransaction(
      [
        SystemProgram.createAccount({
          fromPubkey: this.walletAddress,
          newAccountPubkey: address,
          space,
          lamports,
          programId: this.program.programId,
        }),
        await this.program.methods
          .createConfig(
            new BN(Math.trunc(initialUnlockDate.getTime() / 1000)),
            new BN(Math.trunc(vestingStartDate.getTime() / 1000)),
            new BN(Math.trunc(vestingEndDate.getTime() / 1000)),
            new BN(1),
            Math.trunc(initialUnlockRate * 1e4),
            SafeAmount.toU64Amount(totalCapacity, governo.data.decimals),
          )
          .accountsStrict({
            admin: governo.data.admin,
            governo: governo.address,
            config: address,
            vaultAuthority: authorityAddress,
          })
          .instruction(),
      ],
      [keypair],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
      simulate,
    );

    return { address, signature };
  }

  async createPool({
    config,
    iouMintAddress,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    config: VestingConfig;
    iouMintAddress: PublicKey;
  }>): Promise<TransactionSignature> {
    return this.sendSmartTransaction(
      [
        await this.program.methods
          .createPool()
          .accountsStrict({
            admin: config.governo.data.admin,
            governo: config.governo.address,
            config: config.address,
            pool: VestoContext.getPoolAddress(config.address, iouMintAddress),
            iouMint: iouMintAddress,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      ],
      [],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
      simulate,
    );
  }

  static getVaultAuthorityAddress(address: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault_authority"), address.toBuffer()],
      VESTO_PROGRAM_ID,
    )[0];
  }

  static getPoolAddress(
    configAddress: PublicKey,
    iouMintAddress: PublicKey,
  ): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("vesting_pool"),
        configAddress.toBuffer(),
        iouMintAddress.toBuffer(),
      ],
      VESTO_PROGRAM_ID,
    )[0];
  }

  static getPositionAddress(
    poolAddress: PublicKey,
    userAddress: PublicKey,
  ): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("vesting_position"),
        poolAddress.toBuffer(),
        userAddress.toBuffer(),
      ],
      VESTO_PROGRAM_ID,
    )[0];
  }
}
