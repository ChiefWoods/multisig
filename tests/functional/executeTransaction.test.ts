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
import { Keypair, PublicKey } from "@solana/web3.js";
import { getMultisigPda, getTransactionPda } from "../pda";
import { fetchMultisigAcc, fetchTransactionAcc } from "../accounts";
import { MINT, MINT_DECIMALS } from "../constants";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("executeTransaction", () => {
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
  let transactionPda: PublicKey;

  async function castVote(member: Keypair) {
    await program.methods
      .castVote()
      .accountsPartial({
        member: member.publicKey,
        multisig: multisigPda,
        transaction: transactionPda,
      })
      .signers([member])
      .rpc();
  }

  async function proposeTransaction(
    transactionTypes: IdlTypes<Multisig>["transactionType"][],
    proposer: Keypair
  ) {
    await program.methods
      .proposeTransaction(transactionTypes)
      .accountsPartial({
        proposer: proposer.publicKey,
        multisig: multisigPda,
      })
      .signers([proposer])
      .rpc();
  }

  async function executeTransaction(member: Keypair) {
    await program.methods
      .executeTransaction()
      .accountsPartial({
        member: member.publicKey,
        multisig: multisigPda,
        transaction: transactionPda,
      })
      .signers([member])
      .rpc();
  }

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

  test("executes a transaction with an instruction", async () => {
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

    await proposeTransaction(transactionTypes, creator);

    transactionPda = getTransactionPda(multisigPda, preNextTransactionId);

    await castVote(memberA);
    await castVote(memberB);

    await program.methods
      .executeTransaction()
      .accountsPartial({
        member: creator.publicKey,
        multisig: multisigPda,
        transaction: transactionPda,
      })
      .remainingAccounts(
        keys
          .map((k) => {
            return {
              pubkey: k.pubkey,
              // multisig account cannot be a signer
              isSigner: k.pubkey.equals(multisigPda) ? false : k.isSigner,
              isWritable: k.isWritable,
            };
          })
          .concat({
            pubkey: programId,
            isSigner: false,
            isWritable: false,
          })
      )
      .signers([creator])
      .rpc();

    const transactionAcc = await fetchTransactionAcc(program, transactionPda);

    expect(transactionAcc.executed).toBe(true);
  });

  test("executes a transaction with multisig add member action", async () => {
    const memberToAdd = memberC.publicKey;

    const transactionTypes: IdlTypes<Multisig>["transactionType"][] = [
      {
        multisigAction: [
          {
            addMember: {
              member: memberToAdd,
            },
          },
        ],
      },
    ];

    await proposeTransaction(transactionTypes, creator);

    transactionPda = getTransactionPda(multisigPda, preNextTransactionId);

    await castVote(memberA);
    await castVote(memberB);

    await executeTransaction(creator);

    const multisigAcc = await fetchMultisigAcc(program, multisigPda);

    expect(multisigAcc.members).toContainEqual(memberToAdd);
  });

  test("executes a transaction with multisig remove member action", async () => {
    const memberToRemove = memberA.publicKey;

    const transactionTypes: IdlTypes<Multisig>["transactionType"][] = [
      {
        multisigAction: [
          {
            removeMember: {
              member: memberToRemove,
            },
          },
        ],
      },
    ];

    await proposeTransaction(transactionTypes, creator);

    transactionPda = getTransactionPda(multisigPda, preNextTransactionId);

    await castVote(memberA);
    await castVote(memberB);

    await executeTransaction(creator);

    const multisigAcc = await fetchMultisigAcc(program, multisigPda);

    expect(multisigAcc.members).not.toContainEqual(memberToRemove);
  });

  test("executes a transaction with multisig set threshold action", async () => {
    const newThreshold = 3;

    const transactionTypes: IdlTypes<Multisig>["transactionType"][] = [
      {
        multisigAction: [
          {
            setThreshold: {
              threshold: newThreshold,
            },
          },
        ],
      },
    ];

    await proposeTransaction(transactionTypes, creator);

    transactionPda = getTransactionPda(multisigPda, preNextTransactionId);

    await castVote(memberA);
    await castVote(memberB);

    await executeTransaction(creator);

    const multisigAcc = await fetchMultisigAcc(program, multisigPda);

    expect(multisigAcc.threshold).toBe(newThreshold);
  });

  test("throws if executor is not part of multisig", async () => {
    const newThreshold = 3;

    const transactionTypes: IdlTypes<Multisig>["transactionType"][] = [
      {
        multisigAction: [
          {
            setThreshold: {
              threshold: newThreshold,
            },
          },
        ],
      },
    ];

    await proposeTransaction(transactionTypes, creator);

    transactionPda = getTransactionPda(multisigPda, preNextTransactionId);

    await castVote(memberA);
    await castVote(memberB);

    try {
      await executeTransaction(memberC);
    } catch (err) {
      expectAnchorError(err, "UnauthorizedMember");
    }
  });

  test("throws if there are insufficient votes", async () => {
    const newThreshold = 3;

    const transactionTypes: IdlTypes<Multisig>["transactionType"][] = [
      {
        multisigAction: [
          {
            setThreshold: {
              threshold: newThreshold,
            },
          },
        ],
      },
    ];

    await proposeTransaction(transactionTypes, creator);

    transactionPda = getTransactionPda(multisigPda, preNextTransactionId);

    await castVote(memberA);

    try {
      await executeTransaction(creator);
    } catch (err) {
      expectAnchorError(err, "InsufficientVotes");
    }
  });

  test("throws if adding a member that already exists", async () => {
    const memberToAdd = memberA.publicKey;

    const transactionTypes: IdlTypes<Multisig>["transactionType"][] = [
      {
        multisigAction: [
          {
            addMember: {
              member: memberToAdd,
            },
          },
        ],
      },
    ];

    await proposeTransaction(transactionTypes, creator);

    transactionPda = getTransactionPda(multisigPda, preNextTransactionId);

    await castVote(memberA);
    await castVote(memberB);

    try {
      await executeTransaction(creator);
    } catch (err) {
      expectAnchorError(err, "MemberAlreadyExists");
    }
  });

  test("throws if member count drops below threshold if member is removed", async () => {
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
      {
        multisigAction: [
          {
            removeMember: {
              member: memberB.publicKey,
            },
          },
        ],
      },
    ];

    await proposeTransaction(transactionTypes, creator);

    transactionPda = getTransactionPda(multisigPda, preNextTransactionId);

    await castVote(memberA);
    await castVote(memberB);

    try {
      await executeTransaction(creator);
    } catch (err) {
      expectAnchorError(err, "CannotRemoveMemberBelowThreshold");
    }
  });

  test("throws if removing a member that does not exist", async () => {
    const transactionTypes: IdlTypes<Multisig>["transactionType"][] = [
      {
        multisigAction: [
          {
            removeMember: {
              member: memberC.publicKey,
            },
          },
        ],
      },
    ];

    await proposeTransaction(transactionTypes, creator);

    transactionPda = getTransactionPda(multisigPda, preNextTransactionId);

    await castVote(memberA);
    await castVote(memberB);

    try {
      await executeTransaction(creator);
    } catch (err) {
      expectAnchorError(err, "MemberDoesNotExist");
    }
  });

  test("throws if threshold is invalid", async () => {
    const transactionTypes: IdlTypes<Multisig>["transactionType"][] = [
      {
        multisigAction: [
          {
            setThreshold: {
              threshold: 4,
            },
          },
        ],
      },
    ];

    await proposeTransaction(transactionTypes, creator);

    transactionPda = getTransactionPda(multisigPda, preNextTransactionId);

    await castVote(memberA);
    await castVote(memberB);

    try {
      await executeTransaction(creator);
    } catch (err) {
      expectAnchorError(err, "InvalidThreshold");
    }
  });
});
