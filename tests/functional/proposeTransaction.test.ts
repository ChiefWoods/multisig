import { IdlTypes, Program } from "@coral-xyz/anchor";
import { LiteSVMProvider } from "anchor-litesvm";
import { beforeEach, describe, expect, test } from "bun:test";
import { LiteSVM } from "litesvm";
import { Multisig } from "../../target/types/multisig";
import {
  expectAnchorError,
  fundedSystemAccountInfo,
  getSetup,
  initAta,
} from "../setup";
import { Keypair } from "@solana/web3.js";
import { getMultisigPda, getTransactionPda } from "../pda";
import { fetchMultisigAcc, fetchTransactionAcc } from "../accounts";
import { MINT, MINT_DECIMALS } from "../constants";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("proposeTransaction", () => {
  let { litesvm, provider, program } = {} as {
    litesvm: LiteSVM;
    provider: LiteSVMProvider;
    program: Program<Multisig>;
  };

  const [creator, base, memberA, memberB, memberC] = Array.from(
    { length: 5 },
    () => Keypair.generate()
  );
  const multisigPda = getMultisigPda(base.publicKey);
  let preNextTransactionId: number;

  beforeEach(async () => {
    ({ litesvm, provider, program } = await getSetup([
      ...[creator, base, memberA, memberB, memberC].map((kp) => {
        return {
          pubkey: kp.publicKey,
          account: fundedSystemAccountInfo(),
        };
      }),
    ]));

    initAta(litesvm, MINT, multisigPda, 100 * 10 ** MINT_DECIMALS);
    initAta(litesvm, MINT, creator.publicKey, 0);

    await program.methods
      .createMultisig(
        [creator.publicKey, memberA.publicKey, memberB.publicKey],
        2
      )
      .accounts({
        creator: creator.publicKey,
        base: base.publicKey,
      })
      .signers([creator, base])
      .rpc();

    const preMultisigAcc = await fetchMultisigAcc(program, multisigPda);
    preNextTransactionId = preMultisigAcc.nextTransactionId;
  });

  test("proposes a transaction with a custom instruction", async () => {
    const multisigAta = getAssociatedTokenAddressSync(
      MINT,
      multisigPda,
      true,
      TOKEN_PROGRAM_ID
    );
    const creatorAta = getAssociatedTokenAddressSync(
      MINT,
      creator.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );
    const { data, keys, programId } = createTransferCheckedInstruction(
      multisigAta,
      MINT,
      creatorAta,
      multisigPda,
      10 * 10 ** MINT_DECIMALS,
      MINT_DECIMALS,
      [],
      TOKEN_PROGRAM_ID
    );

    const transactionTypes: IdlTypes<Multisig>["transactionType"][] = [
      {
        instruction: [
          {
            data,
            accounts: keys,
            programId,
          },
        ],
      },
    ];

    await program.methods
      .proposeTransaction(transactionTypes)
      .accountsPartial({
        proposer: creator.publicKey,
        multisig: multisigPda,
      })
      .signers([creator])
      .rpc();

    const transactionPda = getTransactionPda(multisigPda, preNextTransactionId);
    const transactionAcc = await fetchTransactionAcc(program, transactionPda);

    expect(transactionAcc.executed).toBe(false);
    expect(transactionAcc.id).toBe(preNextTransactionId);
    expect(transactionAcc.multisig).toStrictEqual(multisigPda);
    expect(transactionAcc.proposer).toStrictEqual(creator.publicKey);
    expect(transactionAcc.signers).toStrictEqual([]);
    expect(transactionAcc.transactionTypes[0].instruction[0]).toStrictEqual(
      transactionTypes[0].instruction[0]
    );
  });

  test("proposes a transaction with to add a new member", async () => {
    const transactionTypes: IdlTypes<Multisig>["transactionType"][] = [
      {
        multisigAction: [
          {
            addMember: {
              member: memberC.publicKey,
            },
          },
        ],
      },
    ];

    await program.methods
      .proposeTransaction(transactionTypes)
      .accountsPartial({
        proposer: creator.publicKey,
        multisig: multisigPda,
      })
      .signers([creator])
      .rpc();

    const transactionPda = getTransactionPda(multisigPda, preNextTransactionId);
    const transactionAcc = await fetchTransactionAcc(program, transactionPda);

    expect(transactionAcc.transactionTypes[0].multisigAction[0]).toStrictEqual(
      transactionTypes[0].multisigAction[0]
    );
  });

  test("proposes a transaction with to remove a member", async () => {
    const transactionTypes: IdlTypes<Multisig>["transactionType"][] = [
      {
        multisigAction: [
          {
            removeMember: {
              member: memberA.publicKey,
            },
          },
        ],
      },
    ];

    await program.methods
      .proposeTransaction(transactionTypes)
      .accountsPartial({
        proposer: creator.publicKey,
        multisig: multisigPda,
      })
      .signers([creator])
      .rpc();

    const transactionPda = getTransactionPda(multisigPda, preNextTransactionId);
    const transactionAcc = await fetchTransactionAcc(program, transactionPda);

    expect(transactionAcc.transactionTypes[0].multisigAction[0]).toStrictEqual(
      transactionTypes[0].multisigAction[0]
    );
  });

  test("proposes a transaction with to set a new threshold", async () => {
    const transactionTypes: IdlTypes<Multisig>["transactionType"][] = [
      {
        multisigAction: [
          {
            setThreshold: {
              threshold: 3,
            },
          },
        ],
      },
    ];

    await program.methods
      .proposeTransaction(transactionTypes)
      .accountsPartial({
        proposer: creator.publicKey,
        multisig: multisigPda,
      })
      .signers([creator])
      .rpc();

    const transactionPda = getTransactionPda(multisigPda, preNextTransactionId);
    const transactionAcc = await fetchTransactionAcc(program, transactionPda);

    expect(transactionAcc.transactionTypes[0].multisigAction[0]).toStrictEqual(
      transactionTypes[0].multisigAction[0]
    );
  });

  test("propose a transaction with an instruction and multisig action", async () => {
    const multisigAta = getAssociatedTokenAddressSync(
      MINT,
      multisigPda,
      true,
      TOKEN_PROGRAM_ID
    );
    const creatorAta = getAssociatedTokenAddressSync(
      MINT,
      creator.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );
    const { data, keys, programId } = createTransferCheckedInstruction(
      multisigAta,
      MINT,
      creatorAta,
      multisigPda,
      10 * 10 ** MINT_DECIMALS,
      MINT_DECIMALS,
      [],
      TOKEN_PROGRAM_ID
    );

    const transactionTypes: IdlTypes<Multisig>["transactionType"][] = [
      {
        instruction: [
          {
            data,
            accounts: keys,
            programId,
          },
        ],
      },
      {
        multisigAction: [
          {
            addMember: {
              member: memberC.publicKey,
            },
          },
        ],
      },
    ];

    await program.methods
      .proposeTransaction(transactionTypes)
      .accountsPartial({
        proposer: creator.publicKey,
        multisig: multisigPda,
      })
      .signers([creator])
      .rpc();

    const transactionPda = getTransactionPda(multisigPda, preNextTransactionId);
    const transactionAcc = await fetchTransactionAcc(program, transactionPda);

    expect(transactionAcc.transactionTypes[0].instruction[0]).toStrictEqual(
      transactionTypes[0].instruction[0]
    );
    expect(transactionAcc.transactionTypes[1].multisigAction[0]).toStrictEqual(
      transactionTypes[1].multisigAction[0]
    );
  });

  test("throws if proposer is not a member", async () => {
    const transactionTypes: IdlTypes<Multisig>["transactionType"][] = [
      {
        multisigAction: [
          {
            setThreshold: {
              threshold: 3,
            },
          },
        ],
      },
    ];

    try {
      await program.methods
        .proposeTransaction(transactionTypes)
        .accountsPartial({
          proposer: memberC.publicKey,
          multisig: multisigPda,
        })
        .signers([memberC])
        .rpc();
    } catch (err) {
      expectAnchorError(err, "UnauthorizedMember");
    }
  });

  test("throws if transaction types list is empty", async () => {
    const transactionTypes: IdlTypes<Multisig>["transactionType"][] = [];

    try {
      await program.methods
        .proposeTransaction(transactionTypes)
        .accountsPartial({
          proposer: creator.publicKey,
          multisig: multisigPda,
        })
        .signers([creator])
        .rpc();
    } catch (err) {
      expectAnchorError(err, "EmptyTransactionTypesList");
    }
  });
});
