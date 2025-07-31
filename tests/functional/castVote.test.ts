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

describe("castVote", () => {
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

    transactionPda = getTransactionPda(multisigPda, preNextTransactionId);
  });

  test("casts a vote", async () => {
    await castVote(creator);

    const transactionAcc = await fetchTransactionAcc(program, transactionPda);

    expect(transactionAcc.signers).toContainEqual(creator.publicKey);
  });

  test("throws if voter is not a member", async () => {
    try {
      await castVote(memberC);
    } catch (err) {
      expectAnchorError(err, "UnauthorizedMember");
    }
  });

  test("throws if voter has already voted", async () => {
    await castVote(creator);

    expect(async () => {
      await castVote(creator);
    }).toThrow();
  });

  test("throws if transaction has already executed", async () => {
    await castVote(creator);
    await castVote(memberA);

    await program.methods
      .executeTransaction()
      .accountsPartial({
        member: creator.publicKey,
        multisig: multisigPda,
        transaction: transactionPda,
      })
      .signers([creator])
      .rpc();

    try {
      await castVote(memberB);
    } catch (err) {
      expectAnchorError(err, "TransactionAlreadyExecuted");
    }
  });
});
