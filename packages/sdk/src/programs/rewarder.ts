import BN from "bn.js";
import {
  AccountMeta,
  GetProgramAccountsFilter,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  unpackMint,
} from "@solana/spl-token";
import { Program, Provider } from "@coral-xyz/anchor";
import {
  AddressWithTransactionSignature,
  TransactionArgs,
  WalletContext,
  SafeAmount,
  DataUpdatedEvent,
  SIMULATED_SIGNATURE,
} from "@stabbleorg/anchor-contrib";
import {
  Rewarder,
  Pool,
  Miner,
  RewarderData,
  PoolData,
  MinerData,
} from "../accounts";
import { type Rewarder as IDLType } from "../generated/rewarder";
import IDL from "../generated/idl/rewarder.json";

export const REWARDER_PROGRAM_ID = new PublicKey(IDL.address);
export const REWARDER_ERRORS = new Map(
  IDL.errors.map((error) => [error.code, error.msg]),
);

export type RewarderProgram = Program<IDLType>;

export class RewarderContext<
  T extends Provider = Provider,
> extends WalletContext<T> {
  readonly program: RewarderProgram;

  constructor(provider: T) {
    super(provider);
    this.program = new Program(IDL, provider);
  }

  async loadRewarder(rewarderAddress: PublicKey): Promise<Rewarder> {
    const data = await this.program.account.rewarder.fetch(rewarderAddress);

    return new Rewarder(rewarderAddress, data);
  }

  async loadRewarders(adminAddress?: PublicKey): Promise<Rewarder[]> {
    const filters: GetProgramAccountsFilter[] = [];

    if (adminAddress) {
      filters.push({
        memcmp: {
          offset: 8,
          bytes: adminAddress.toBase58(),
        },
      });
    }

    const accounts = await this.program.account.rewarder.all(filters);

    const map = new Map(
      accounts.map(({ publicKey, account }) => [publicKey.toBase58(), account]),
    );

    return accounts.map(({ publicKey, account }) => {
      const parentData = account.parentRewarder
        ? map.get(account.parentRewarder.toBase58())
        : null;
      return new Rewarder(
        publicKey,
        account,
        parentData
          ? new Rewarder(account.parentRewarder!, parentData)
          : undefined,
      );
    });
  }

  async loadPool(poolAddress: PublicKey, rewarder?: Rewarder): Promise<Pool> {
    const data = await this.program.account.pool.fetch(poolAddress);

    if (!rewarder) {
      rewarder = await this.loadRewarder(data.rewarder);
    }

    return new Pool(rewarder, poolAddress, data);
  }

  async loadPools(rewarders: Map<string, Rewarder>): Promise<Pool[]> {
    const accounts = await this.program.account.pool.all();

    const pools: Pool[] = [];

    for (const { publicKey, account } of accounts) {
      const rewarder = rewarders.get(account.rewarder.toBase58());

      if (rewarder) {
        pools.push(new Pool(rewarder, publicKey, account));
      }
    }

    return pools;
  }

  async loadMiner(
    pool: Pool,
    userAddress: PublicKey = this.walletAddress,
  ): Promise<Miner | null> {
    const data = await this.program.account.miner.fetchNullable(
      RewarderContext.getMinerAddress(userAddress, pool.address),
    );

    if (!data) return null;

    return new Miner(pool, data);
  }

  async loadMiners(
    pools: Map<string, Pool>,
    beneficiaryAddress: PublicKey = this.walletAddress,
  ): Promise<Miner[]> {
    const accounts = await this.program.account.miner.all([
      {
        memcmp: {
          offset: 72,
          bytes: beneficiaryAddress.toBase58(),
        },
      },
    ]);

    const miners: Miner[] = [];

    for (const { publicKey, account } of accounts) {
      const pool = pools.get(account.pool.toBase58());

      if (pool) {
        miners.push(new Miner(pool, account));
      }
    }

    return miners;
  }

  async createRewarder({
    mintAddress,
    totalRewards,
    startsAt,
    endsAt,
    liquidity = true,
    keypair = Keypair.generate(),
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    mintAddress: PublicKey;
    totalRewards: string | number;
    startsAt: Date;
    endsAt: Date;
    liquidity?: boolean;
    keypair?: Keypair;
  }>): Promise<AddressWithTransactionSignature> {
    const data = await this.provider.connection.getAccountInfo(mintAddress);
    if (!data) throw new Error("Invalid reward mint address");
    const tokenProgramAddress = data.owner;
    const mint = unpackMint(mintAddress, data, tokenProgramAddress);
    const amount = SafeAmount.toU64Amount(totalRewards, mint.decimals);

    const space = this.program.account.rewarder.size;
    const lamports =
      await this.provider.connection.getMinimumBalanceForRentExemption(space);

    const address = keypair.publicKey;
    const authorityAddress =
      RewarderContext.getRewarderAuthorityAddress(address);

    const instructions: TransactionInstruction[] = [
      SystemProgram.createAccount({
        fromPubkey: this.walletAddress,
        newAccountPubkey: address,
        space,
        lamports,
        programId: this.program.programId,
      }),
      await this.program.methods
        .createRewarder(
          amount,
          new BN(startsAt.getTime() / 1000),
          new BN(endsAt.getTime() / 1000),
        )
        .accountsStrict({
          admin: this.walletAddress,
          mint: mintAddress,
          rewarder: address,
          rewarderAuthority: authorityAddress,
        })
        .instruction(),
    ];

    const { address: rewarderTokenAddress, instruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(
        mintAddress,
        authorityAddress,
        true,
        tokenProgramAddress,
      );
    if (instruction) instructions.push(instruction);

    if (liquidity) {
      instructions.push(
        createTransferCheckedInstruction(
          this.getAssociatedTokenAddress(mintAddress, tokenProgramAddress),
          mintAddress,
          rewarderTokenAddress,
          this.walletAddress,
          BigInt(amount.toString()),
          mint.decimals,
          [],
          tokenProgramAddress,
        ),
      );
    }

    const signature = await this.sendSmartTransaction(
      instructions,
      [keypair],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
      simulate,
    );

    return { address, signature };
  }

  async updateRewarder({
    rewarder,
    totalRewards,
    startsAt,
    endsAt,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    rewarder: Rewarder;
    totalRewards: string | number;
    startsAt: Date;
    endsAt: Date;
  }>): Promise<TransactionSignature> {
    return this.sendSmartTransaction(
      [
        await this.program.methods
          .updateRewarder(
            SafeAmount.toU64Amount(totalRewards, rewarder.data.decimals),
            new BN(startsAt.getTime() / 1000),
            new BN(endsAt.getTime() / 1000),
          )
          .accountsStrict({
            admin: this.walletAddress,
            rewarder: rewarder.address,
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

  async deriveRewarder({
    rewarderAddress,
    parentRewarderAddress,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    rewarderAddress: PublicKey;
    parentRewarderAddress: PublicKey;
  }>): Promise<TransactionSignature> {
    return this.sendSmartTransaction(
      [
        await this.program.methods
          .deriveRewarder()
          .accountsStrict({
            admin: this.walletAddress,
            rewarder: rewarderAddress,
            parentRewarder: parentRewarderAddress,
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

  async createPool({
    rewarderAddress,
    mintAddress,
    weight,
    keypair = Keypair.generate(),
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    rewarderAddress: PublicKey;
    mintAddress: PublicKey;
    weight: number;
    keypair?: Keypair;
  }>): Promise<AddressWithTransactionSignature> {
    const address = keypair.publicKey;

    const space = this.program.account.pool.size;
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
          .createPool(weight)
          .accountsStrict({
            admin: this.walletAddress,
            mint: mintAddress,
            pool: address,
            rewarder: rewarderAddress,
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

  async updatePool({
    pool,
    weight,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    pool: Pool;
    weight: number;
  }>): Promise<TransactionSignature> {
    return this.sendSmartTransaction(
      [
        await this.program.methods
          .updatePool(weight)
          .accountsStrict({
            admin: pool.rewarder.adminAddress,
            pool: pool.address,
            rewarder: pool.rewarder.address,
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

  async deposit({
    pool,
    derivedPool,
    amount,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    pool: Pool;
    derivedPool?: Pool;
    amount: string | number;
  }>): Promise<TransactionSignature> {
    return this.sendSmartTransaction(
      await this.createDepositInstructions({ pool, derivedPool, amount }),
      [],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
      simulate,
    );
  }

  async deposit2({
    derivedPool,
    miner,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    derivedPool: Pool;
    miner: Miner;
  }>): Promise<TransactionSignature> {
    return this.sendSmartTransaction(
      await this.createDepositDerivedInstructions({
        derivedPool,
        minerAddress: miner.address,
        poolAddress: miner.pool.address,
        rewarderAddress: miner.pool.rewarder.address,
      }),
      [],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
      simulate,
    );
  }

  async withdraw({
    pool,
    derivedPool,
    amount,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    pool: Pool;
    derivedPool?: Pool;
    amount: string | number;
  }>): Promise<TransactionSignature> {
    return this.sendSmartTransaction(
      await this.createWithdrawInstructions({ pool, derivedPool, amount }),
      [],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
      simulate,
    );
  }

  async claim({
    miners,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    miners: Miner[];
  }>): Promise<TransactionSignature> {
    const instructions: TransactionInstruction[] = [];

    for (const miner of miners) {
      const claimInstructions = await this.createClaimInstructions(miner);
      instructions.push(...claimInstructions);
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

  async createDepositInstructions({
    pool,
    derivedPool,
    amount,
    authorityAddress = this.walletAddress,
  }: {
    pool: Pool;
    derivedPool?: Pool;
    amount: string | number;
    authorityAddress?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    const data = await this.provider.connection.getAccountInfo(
      pool.mintAddress,
    );
    const tokenProgramAddress = data!.owner;

    const miner = await this.loadMiner(pool);
    const minerAddress = RewarderContext.getMinerAddress(
      authorityAddress,
      pool.address,
    );

    if (!miner) {
      instructions.push(
        await this.program.methods
          .createMiner(authorityAddress)
          .accountsStrict({
            payer: this.walletAddress,
            miner: minerAddress,
            pool: pool.address,
            rewarder: pool.rewarder.address,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      );

      const { instruction } =
        await this.getOrCreateAssociatedTokenAddressInstruction(
          pool.mintAddress,
          minerAddress,
          true,
          tokenProgramAddress,
        );
      if (instruction) instructions.push(instruction);
    }

    const userTokenAddress = this.getAssociatedTokenAddress(
      pool.mintAddress,
      tokenProgramAddress,
    );
    const minerTokenAddress = getAssociatedTokenAddressSync(
      pool.mintAddress,
      minerAddress,
      true,
      tokenProgramAddress,
    );

    instructions.push(
      await this.program.methods
        .depositMiner(SafeAmount.toU64Amount(amount, pool.data.decimals))
        .accountsStrict({
          with: {
            miner: minerAddress,
            pool: pool.address,
            rewarder: pool.rewarder.address,
          },
          authority: authorityAddress,
          mint: pool.mintAddress,
          userToken: userTokenAddress,
          minerToken: minerTokenAddress,
          tokenProgram: tokenProgramAddress,
        })
        .instruction(),
    );

    if (derivedPool) {
      const depositDerivedInstructions =
        await this.createDepositDerivedInstructions({
          derivedPool,
          minerAddress,
          poolAddress: pool.address,
          rewarderAddress: pool.rewarder.address,
          minerTokenAddress,
          tokenProgramAddress,
        });
      instructions.push(...depositDerivedInstructions);
    }

    return instructions;
  }

  async createDepositDerivedInstructions({
    derivedPool,
    minerAddress,
    poolAddress,
    rewarderAddress,
    minerTokenAddress,
    tokenProgramAddress,
  }: {
    derivedPool: Pool;
    minerAddress: PublicKey;
    poolAddress: PublicKey;
    rewarderAddress: PublicKey;
    minerTokenAddress?: PublicKey;
    tokenProgramAddress?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    if (!tokenProgramAddress) {
      const data = await this.provider.connection.getAccountInfo(
        derivedPool.mintAddress,
      );
      tokenProgramAddress = data!.owner;
    }

    if (!minerTokenAddress) {
      minerTokenAddress = getAssociatedTokenAddressSync(
        derivedPool.mintAddress,
        minerAddress,
        true,
        tokenProgramAddress,
      );
    }

    const derivedMiner = await this.loadMiner(derivedPool, minerAddress);
    const derivedMinerAddress = RewarderContext.getMinerAddress(
      minerAddress,
      derivedPool.address,
    );

    if (!derivedMiner) {
      instructions.push(
        await this.program.methods
          .deriveMiner()
          .accountsStrict({
            payer: this.walletAddress,
            authority: minerAddress,
            authorityPool: poolAddress,
            miner: derivedMinerAddress,
            pool: derivedPool.address,
            rewarder: derivedPool.rewarder.address,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      );

      const { instruction } =
        await this.getOrCreateAssociatedTokenAddressInstruction(
          derivedPool.mintAddress,
          derivedMinerAddress,
          true,
          tokenProgramAddress,
        );
      if (instruction) instructions.push(instruction);
    }

    const derivedMinerTokenAddress = getAssociatedTokenAddressSync(
      derivedPool.mintAddress,
      derivedMinerAddress,
      true,
      tokenProgramAddress,
    );

    instructions.push(
      await this.program.methods
        .depositDerivedMiner()
        .accountsStrict({
          with: {
            miner: minerAddress,
            pool: poolAddress,
            rewarder: rewarderAddress,
          },
          withDerived: {
            miner: derivedMinerAddress,
            pool: derivedPool.address,
            rewarder: derivedPool.rewarder.address,
          },
          beneficiary: this.walletAddress,
          mint: derivedPool.mintAddress,
          authorityToken: minerTokenAddress,
          minerToken: derivedMinerTokenAddress,
          tokenProgram: tokenProgramAddress,
        })
        .instruction(),
    );

    return instructions;
  }

  async createWithdrawInstructions({
    pool,
    derivedPool,
    amount,
    authorityAddress = this.walletAddress,
  }: {
    pool: Pool;
    derivedPool?: Pool;
    amount: string | number;
    authorityAddress?: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    const data = await this.provider.connection.getAccountInfo(
      pool.mintAddress,
    );
    const tokenProgramAddress = data!.owner;

    const minerAddress = RewarderContext.getMinerAddress(
      authorityAddress,
      pool.address,
    );

    const { address: userTokenAddress, instruction: createUserAtaIX } =
      await this.getOrCreateAssociatedTokenAddressInstruction(
        pool.mintAddress,
        authorityAddress,
        true,
        tokenProgramAddress,
      );
    if (createUserAtaIX) instructions.push(createUserAtaIX);

    const minerTokenAddress = getAssociatedTokenAddressSync(
      pool.mintAddress,
      minerAddress,
      true,
      tokenProgramAddress,
    );

    instructions.push(
      await this.program.methods
        .withdrawMiner(SafeAmount.toU64Amount(amount, pool.data.decimals))
        .accountsStrict({
          with: {
            miner: minerAddress,
            pool: pool.address,
            rewarder: pool.rewarder.address,
          },
          authority: authorityAddress,
          mint: pool.mintAddress,
          userToken: userTokenAddress,
          minerToken: minerTokenAddress,
          tokenProgram: tokenProgramAddress,
        })
        .instruction(),
    );

    if (derivedPool) {
      const derivedMinerAddress = RewarderContext.getMinerAddress(
        minerAddress,
        derivedPool.address,
      );

      const derivedMinerTokenAddress = getAssociatedTokenAddressSync(
        pool.mintAddress, // = derivedPool.mintAddress
        derivedMinerAddress,
        true,
        tokenProgramAddress,
      );

      instructions.unshift(
        await this.program.methods
          .withdrawDerivedMiner(
            SafeAmount.toU64Amount(amount, pool.data.decimals),
          )
          .accountsStrict({
            with: {
              miner: minerAddress,
              pool: pool.address,
              rewarder: pool.rewarder.address,
            },
            withDerived: {
              miner: derivedMinerAddress,
              pool: derivedPool.address,
              rewarder: derivedPool.rewarder.address,
            },
            beneficiary: this.walletAddress,
            mint: derivedPool.mintAddress,
            authorityToken: minerTokenAddress,
            minerToken: derivedMinerTokenAddress,
            tokenProgram: tokenProgramAddress,
          })
          .instruction(),
      );
    }

    return instructions;
  }

  async createClaimInstructions(
    miner: Miner,
  ): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];
    const remainingAccounts: AccountMeta[] = [];

    if (!miner.amount) {
      const mint = await this.provider.connection.getAccountInfo(
        miner.pool.mintAddress,
      );
      const tokenProgramId = mint!.owner;

      remainingAccounts.push(
        {
          pubkey: this.walletAddress,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: miner.getAssociatedTokenAddress(
            miner.pool.mintAddress,
            tokenProgramId,
          ),
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: miner.pool.mintAddress,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: tokenProgramId,
          isSigner: false,
          isWritable: false,
        },
      );
    }

    const data = await this.provider.connection.getAccountInfo(
      miner.pool.rewarder.mintAddress,
    );
    const tokenProgramAddress = data!.owner;

    const { address: userTokenAddress, instruction: createUserAtaIX } =
      await this.getOrCreateAssociatedTokenAddressInstruction(
        miner.pool.rewarder.mintAddress,
        miner.beneficiaryAddress,
        true,
        tokenProgramAddress,
      );
    if (createUserAtaIX) instructions.push(createUserAtaIX);

    const rewarderTokenAddress = miner.pool.rewarder.getAssociatedTokenAddress(
      miner.pool.rewarder.mintAddress,
      tokenProgramAddress,
    );

    instructions.push(
      await this.program.methods
        .claimMiner()
        .accountsStrict({
          with: {
            miner: miner.address,
            pool: miner.pool.address,
            rewarder: miner.pool.rewarder.address,
          },
          beneficiary: miner.beneficiaryAddress,
          rewarderAuthority: miner.pool.rewarder.authorityAddress,
          mint: miner.pool.rewarder.mintAddress,
          userToken: userTokenAddress,
          rewarderToken: rewarderTokenAddress,
          tokenProgram: tokenProgramAddress,
        })
        .remainingAccounts(remainingAccounts)
        .instruction(),
    );

    return instructions;
  }

  static getRewarderAuthorityAddress(rewarderAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("rewarder_authority"), rewarderAddress.toBuffer()],
      REWARDER_PROGRAM_ID,
    )[0];
  }

  static getMinerAddress(
    userAddress: PublicKey,
    poolAddress: PublicKey,
  ): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("miner"), userAddress.toBuffer(), poolAddress.toBuffer()],
      REWARDER_PROGRAM_ID,
    )[0];
  }
}

export class RewarderListener {
  private rewarderUpdatedEvent: number = -1;
  private rewardsPerWeightUpdatedEvent: number = -1;
  private poolUpdatedEvent: number = -1;
  private rewardsPerAmountUpdatedEvent: number = -1;
  private minerCreatedEvent: number = -1;
  private minerUpdatedEvent: number = -1;

  constructor(readonly program: RewarderProgram) {}

  addRewarderListeners(
    callback: (event: DataUpdatedEvent<Partial<RewarderData>>) => void,
  ) {
    this.removeRewarderListeners();

    this.rewarderUpdatedEvent = this.program.addEventListener(
      "rewarderUpdatedEvent",
      (
        event: DataUpdatedEvent<Partial<RewarderData>>,
        _slot: number,
        signature: TransactionSignature,
      ) => {
        if (signature !== SIMULATED_SIGNATURE) {
          callback(event);
        }
      },
    );

    this.rewardsPerWeightUpdatedEvent = this.program.addEventListener(
      "rewardsPerWeightUpdatedEvent",
      (
        event: DataUpdatedEvent<Partial<RewarderData>>,
        _slot: number,
        signature: TransactionSignature,
      ) => {
        if (signature !== SIMULATED_SIGNATURE) {
          callback(event);
        }
      },
    );
  }

  addPoolListeners(
    callback: (event: DataUpdatedEvent<Partial<PoolData>>) => void,
  ) {
    this.removePoolListeners();

    this.poolUpdatedEvent = this.program.addEventListener(
      "poolUpdatedEvent",
      (
        event: DataUpdatedEvent<Partial<PoolData>>,
        _slot: number,
        signature: TransactionSignature,
      ) => {
        if (signature !== SIMULATED_SIGNATURE) {
          callback(event);
        }
      },
    );

    this.rewardsPerAmountUpdatedEvent = this.program.addEventListener(
      "rewardsPerAmountUpdatedEvent",
      (
        event: DataUpdatedEvent<Partial<PoolData>>,
        _slot: number,
        signature: TransactionSignature,
      ) => {
        if (signature !== SIMULATED_SIGNATURE) {
          callback(event);
        }
      },
    );
  }

  addMinerListeners(
    callback: (event: DataUpdatedEvent<Partial<MinerData> | MinerData>) => void,
  ) {
    this.removeMinerListeners();

    this.minerCreatedEvent = this.program.addEventListener(
      "minerCreatedEvent",
      (
        event: DataUpdatedEvent<Partial<MinerData>>,
        _slot: number,
        signature: TransactionSignature,
      ) => {
        if (signature !== SIMULATED_SIGNATURE) {
          callback({
            pubkey: event.pubkey,
            data: {
              ...event.data,
              amount: new BN(0),
              rewardsDebt: new BN(0),
              rewardsCredit: new BN(0),
              rewardsClaimed: new BN(0),
            },
          });
        }
      },
    );

    this.minerUpdatedEvent = this.program.addEventListener(
      "minerUpdatedEvent",
      (
        event: DataUpdatedEvent<Partial<MinerData>>,
        _slot: number,
        signature: TransactionSignature,
      ) => {
        if (signature !== SIMULATED_SIGNATURE) {
          callback(event);
        }
      },
    );
  }

  removeRewarderListeners() {
    if (this.rewarderUpdatedEvent !== -1) {
      this.program.removeEventListener(this.rewarderUpdatedEvent);
      this.rewarderUpdatedEvent = -1;
    }

    if (this.rewardsPerWeightUpdatedEvent !== -1) {
      this.program.removeEventListener(this.rewardsPerWeightUpdatedEvent);
      this.rewardsPerWeightUpdatedEvent = -1;
    }
  }

  removePoolListeners() {
    if (this.poolUpdatedEvent !== -1) {
      this.program.removeEventListener(this.poolUpdatedEvent);
      this.poolUpdatedEvent = -1;
    }

    if (this.rewardsPerAmountUpdatedEvent !== -1) {
      this.program.removeEventListener(this.rewardsPerAmountUpdatedEvent);
      this.rewardsPerAmountUpdatedEvent = -1;
    }
  }

  removeMinerListeners() {
    if (this.minerCreatedEvent !== -1) {
      this.program.removeEventListener(this.minerCreatedEvent);
      this.minerCreatedEvent = -1;
    }

    if (this.minerUpdatedEvent !== -1) {
      this.program.removeEventListener(this.minerUpdatedEvent);
      this.minerUpdatedEvent = -1;
    }
  }
}
