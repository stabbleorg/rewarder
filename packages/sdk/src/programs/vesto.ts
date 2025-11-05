import BN from "bn.js";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Program, Provider } from "@coral-xyz/anchor";
import {
  AddressWithTransactionSignature,
  TransactionArgs,
  WalletContext,
  SafeAmount,
  FloatLike,
  DataUpdatedEvent,
  SIMULATED_SIGNATURE,
} from "@stabbleorg/anchor-contrib";
import {
  Governo,
  Miner,
  Pool as RewardPool,
  VestingConfig,
  VestingPool,
  VestingPosition,
  VestingPositionData,
} from "../accounts";
import { REWARDER_PROGRAM_ID, RewarderContext } from "./rewarder";
import REWARDER_PROGRAM_IDL from "../generated/idl/rewarder.json";
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

  async loadPool(
    address: PublicKey,
    config?: VestingConfig,
  ): Promise<VestingPool> {
    const data = await this.program.account.vestingPool.fetch(address);

    if (!config) {
      config = await this.loadConfig(data.config);
    }

    return new VestingPool(config, data);
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

  async loadPosition(
    pool: VestingPool,
    userAddress: PublicKey = this.walletAddress,
  ): Promise<VestingPosition | null> {
    const address = VestoContext.getPositionAddress(pool.address, userAddress);

    const data =
      await this.program.account.vestingPosition.fetchNullable(address);
    if (!data) return null;

    return new VestingPosition(pool, data);
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

  async updateVestingPeriod({
    config,
    initialUnlockDate,
    vestingStartDate,
    vestingEndDate,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    config: VestingConfig;
    initialUnlockDate: Date;
    vestingStartDate: Date;
    vestingEndDate: Date;
  }>): Promise<TransactionSignature> {
    return this.sendSmartTransaction(
      [
        // await this.program.methods
        //   .updateVestingPeriod(
        //     new BN(Math.trunc(initialUnlockDate.getTime() / 1000)),
        //     new BN(Math.trunc(vestingStartDate.getTime() / 1000)),
        //     new BN(Math.trunc(vestingEndDate.getTime() / 1000)),
        //   )
        //   .accountsStrict({
        //     admin: config.governo.data.admin,
        //     governo: config.governo.address,
        //     config: config.address,
        //   })
        //   .instruction(),
      ],
      [],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
      simulate,
    );
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

  async redeem({
    pool,
    rewardPool,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    pool: VestingPool;
    rewardPool: RewardPool;
  }>): Promise<TransactionSignature> {
    const instructions: TransactionInstruction[] = [];

    const address = VestoContext.getPositionAddress(
      pool.address,
      this.walletAddress,
    );
    const minerAddress = RewarderContext.getMinerAddress(
      address,
      rewardPool.address,
    );

    const positionIouTokenAddress = getAssociatedTokenAddressSync(
      pool.iouMintAddress,
      address,
      true,
    );
    const minerIouTokenAddress = getAssociatedTokenAddressSync(
      pool.iouMintAddress,
      minerAddress,
      true,
    );

    const { address: userIouTokenAddress, instruction: userIouTokenIX } =
      await this.getOrCreateAssociatedTokenAddressInstruction(
        pool.iouMintAddress,
      );

    const position = await this.loadPosition(pool);

    if (position) {
      instructions.push(
        await this.program.methods
          .unstakePosition()
          .accountsStrict({
            governo: pool.config.governo.address,
            config: pool.config.address,
            pool: pool.address,
            position: address,
            positionIouToken: positionIouTokenAddress,
            miner: minerAddress,
            minerIouToken: minerIouTokenAddress,
            rewardPool: rewardPool.address,
            rewarder: rewardPool.rewarder.address,
            iouMint: pool.iouMintAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
            rewarderProgram: REWARDER_PROGRAM_ID,
          })
          .instruction(),
      );
    } else {
      if (userIouTokenIX) {
        throw new Error("You don't have any IOU tokens to redeem");
      }

      const { instruction: positionIouTokenIX } =
        await this.getOrCreateAssociatedTokenAddressInstruction(
          pool.iouMintAddress,
          address,
        );
      if (positionIouTokenIX) instructions.push(positionIouTokenIX);

      const { instruction: minerIouTokenIX } =
        await this.getOrCreateAssociatedTokenAddressInstruction(
          pool.iouMintAddress,
          minerAddress,
        );
      if (minerIouTokenIX) instructions.push(minerIouTokenIX);

      const rewarderProgram = new Program(REWARDER_PROGRAM_IDL, this.provider);

      instructions.push(
        await rewarderProgram.methods
          .createMiner(address)
          .accountsStrict({
            payer: this.walletAddress,
            miner: minerAddress,
            pool: rewardPool.address,
            rewarder: rewardPool.rewarder.address,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
        await this.program.methods
          .createPosition()
          .accountsStrict({
            user: this.walletAddress,
            pool: pool.address,
            position: address,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      );
    }

    const { address: userGovTokenAddress, instruction: userGovTokenIX } =
      await this.getOrCreateAssociatedTokenAddressInstruction(
        pool.config.governo.govMintAddress,
      );
    if (userGovTokenIX) instructions.push(userGovTokenIX);

    instructions.push(
      await this.program.methods
        .redeemPosition()
        .accountsStrict({
          user: this.walletAddress,
          userGovToken: userGovTokenAddress,
          userIouToken: userIouTokenIX ? null : userIouTokenAddress,
          governo: pool.config.governo.address,
          config: pool.config.address,
          pool: pool.address,
          position: address,
          positionIouToken: positionIouTokenAddress,
          vaultAuthority: pool.config.authorityAddress,
          vaultGovToken: pool.config.getAssociatedTokenAddress(
            pool.config.governo.govMintAddress,
          ),
          govMint: pool.config.governo.govMintAddress,
          iouMint: pool.iouMintAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction(),
    );

    if (pool.config.vestingEndDate > new Date()) {
      instructions.push(
        await this.program.methods
          .stakePosition()
          .accountsStrict({
            governo: pool.config.governo.address,
            config: pool.config.address,
            pool: pool.address,
            position: address,
            positionIouToken: positionIouTokenAddress,
            miner: minerAddress,
            minerIouToken: minerIouTokenAddress,
            rewardPool: rewardPool.address,
            rewarder: rewardPool.rewarder.address,
            iouMint: pool.iouMintAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
            rewarderProgram: REWARDER_PROGRAM_ID,
          })
          .instruction(),
      );
    } else if (position) {
      const minerAddress = RewarderContext.getMinerAddress(
        position.address,
        rewardPool.address,
      );

      const {
        address: userRewardTokenAddress,
        instruction: createUserRewardAtaIX,
      } = await this.getOrCreateAssociatedTokenAddressInstruction(
        rewardPool.rewarder.mintAddress,
        position.authorityAddress,
      );
      if (createUserRewardAtaIX) instructions.push(createUserRewardAtaIX);

      const rewarderRewardTokenAddress =
        rewardPool.rewarder.getAssociatedTokenAddress(
          rewardPool.rewarder.mintAddress,
        );

      instructions.push(
        await this.program.methods
          .claimPosition()
          .accountsStrict({
            position: position.address,
            miner: minerAddress,
            rewardPool: rewardPool.address,
            rewarder: rewardPool.rewarder.address,
            rewarderAuthority: rewardPool.rewarder.authorityAddress,
            rewarderToken: rewarderRewardTokenAddress,
            userToken: userRewardTokenAddress,
            mint: rewardPool.rewarder.mintAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
            rewarderProgram: REWARDER_PROGRAM_ID,
          })

          .remainingAccounts([
            {
              pubkey: this.walletAddress,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: getAssociatedTokenAddressSync(
                rewardPool.mintAddress,
                minerAddress,
                true,
              ),
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: rewardPool.mintAddress,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: TOKEN_PROGRAM_ID,
              isSigner: false,
              isWritable: false,
            },
          ])
          .instruction(),
      );
    }

    return this.sendSmartTransaction(
      instructions,
      [],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
      simulate,
    );
  }

  async unstake({
    miner,
    position,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    miner: Miner;
    position: VestingPosition;
  }>): Promise<TransactionSignature> {
    const positionIouTokenAddress = getAssociatedTokenAddressSync(
      position.pool.iouMintAddress,
      position.address,
      true,
    );
    const minerIouTokenAddress = getAssociatedTokenAddressSync(
      position.pool.iouMintAddress,
      miner.address,
      true,
    );

    return this.sendSmartTransaction(
      [
        await this.program.methods
          .unstakePosition()
          .accountsStrict({
            governo: position.pool.config.governo.address,
            config: position.pool.config.address,
            pool: position.pool.address,
            position: position.address,
            positionIouToken: positionIouTokenAddress,
            miner: miner.address,
            minerIouToken: minerIouTokenAddress,
            rewardPool: miner.pool.address,
            rewarder: miner.pool.rewarder.address,
            iouMint: position.pool.iouMintAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
            rewarderProgram: REWARDER_PROGRAM_ID,
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

  async claim({
    miner,
    position,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    miner: Miner;
    position: VestingPosition;
  }>): Promise<TransactionSignature> {
    const instructions: TransactionInstruction[] = [];

    const {
      address: userRewardTokenAddress,
      instruction: createUserRewardAtaIX,
    } = await this.getOrCreateAssociatedTokenAddressInstruction(
      miner.pool.rewarder.mintAddress,
    );
    if (createUserRewardAtaIX) instructions.push(createUserRewardAtaIX);

    const rewarderRewardTokenAddress =
      miner.pool.rewarder.getAssociatedTokenAddress(
        miner.pool.rewarder.mintAddress,
      );

    instructions.push(
      await this.program.methods
        .claimPosition()
        .accountsStrict({
          position: position.address,
          miner: miner.address,
          rewardPool: miner.pool.address,
          rewarder: miner.pool.rewarder.address,
          rewarderAuthority: miner.pool.rewarder.authorityAddress,
          rewarderToken: rewarderRewardTokenAddress,
          userToken: userRewardTokenAddress,
          mint: miner.pool.rewarder.mintAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
          rewarderProgram: REWARDER_PROGRAM_ID,
        })
        .instruction(),
    );

    return this.sendSmartTransaction(
      instructions,
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

  async frozenRedeem({
    frozenIouTokenAddress,
    pool,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    frozenIouTokenAddress: PublicKey;
    pool: VestingPool;
  }>): Promise<TransactionSignature> {
    const instructions: TransactionInstruction[] = [];

    const { address: freezeAuthorityGovTokenAddress, instruction: createGovTokenIX } =
      await this.getOrCreateAssociatedTokenAddressInstruction(
        pool.config.governo.govMintAddress,
      );
    if (createGovTokenIX) {
      instructions.push(createGovTokenIX);
    }

    instructions.push(
      await this.program.methods
        .frozenRedeem()
        .accountsStrict({
          freezeAuthority: this.walletAddress,
          frozenIouToken: frozenIouTokenAddress,
          iouMint: pool.iouMintAddress,
          pool: pool.address,
          config: pool.config.address,
          governo: pool.config.governo.address,
          vaultAuthority: pool.config.authorityAddress,
          vaultGovToken: pool.config.getAssociatedTokenAddress(
            pool.config.governo.govMintAddress,
          ),
          govMint: pool.config.governo.govMintAddress,
          freezeAuthorityGovToken: freezeAuthorityGovTokenAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction(),
    );

    return this.sendSmartTransaction(
      instructions,
      [],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
      simulate,
    );
  }
}

export class VestoListener {
  private positionUpdatedEvent: number = -1;

  constructor(readonly program: VestoProgram) {}

  addPositionListeners(
    callback: (event: DataUpdatedEvent<Partial<VestingPositionData>>) => void,
  ) {
    this.removePositionListeners();

    this.positionUpdatedEvent = this.program.addEventListener(
      "vestingPositionUpdatedEvent",
      (
        event: DataUpdatedEvent<Partial<VestingPositionData>>,
        _slot: number,
        signature: TransactionSignature,
      ) => {
        if (signature !== SIMULATED_SIGNATURE) {
          callback(event);
        }
      },
    );
  }

  removePositionListeners() {
    if (this.positionUpdatedEvent !== -1) {
      this.program.removeEventListener(this.positionUpdatedEvent);
      this.positionUpdatedEvent = -1;
    }
  }
}
