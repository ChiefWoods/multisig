import { Program } from "@coral-xyz/anchor";
import { LiteSVMProvider } from "anchor-litesvm";
import { beforeEach, describe, expect, test } from "bun:test";
import { LiteSVM } from "litesvm";
import { Multisig } from "../../target/types/multisig";
import { expectAnchorError, fundedSystemAccountInfo, getSetup } from "../setup";
import { Keypair } from "@solana/web3.js";
import { getMultisigPda } from "../pda";
import { fetchMultisigAcc } from "../accounts";

describe("createMultisig", () => {
  let { litesvm, provider, program } = {} as {
    litesvm: LiteSVM;
    provider: LiteSVMProvider;
    program: Program<Multisig>;
  };

  const [creator, base, memberA, memberB] = Array.from({ length: 4 }, () =>
    Keypair.generate()
  );

  beforeEach(async () => {
    ({ litesvm, provider, program } = await getSetup([
      ...[creator, base, memberA, memberB].map((kp) => {
        return {
          pubkey: kp.publicKey,
          account: fundedSystemAccountInfo(),
        };
      }),
    ]));
  });

  test("creates a multisig", async () => {
    const members = [creator.publicKey, memberA.publicKey, memberB.publicKey];
    const threshold = 2;

    await program.methods
      .createMultisig(members, threshold)
      .accounts({
        creator: creator.publicKey,
        base: base.publicKey,
      })
      .signers([creator, base])
      .rpc();

    const multisigPda = getMultisigPda(base.publicKey);
    const multisigAcc = await fetchMultisigAcc(program, multisigPda);

    expect(multisigAcc.threshold).toBe(threshold);
    expect(multisigAcc.base).toStrictEqual(base.publicKey);
    expect(multisigAcc.members).toEqual(members);
  });

  test("throws if no members are provided", async () => {
    try {
      await program.methods
        .createMultisig([], 2)
        .accounts({
          creator: creator.publicKey,
          base: base.publicKey,
        })
        .signers([creator, base])
        .rpc();
    } catch (err) {
      expectAnchorError(err, "EmptyMembersList");
    }
  });

  test("throws if no members does not include creator", async () => {
    try {
      await program.methods
        .createMultisig([memberA.publicKey, memberB.publicKey], 2)
        .accounts({
          creator: creator.publicKey,
          base: base.publicKey,
        })
        .signers([creator, base])
        .rpc();
    } catch (err) {
      expectAnchorError(err, "CreatorNotInMembers");
    }
  });

  test("throws if threshold is more than member count", async () => {
    const members = [creator.publicKey, memberA.publicKey, memberB.publicKey];
    const threshold = members.length + 1;

    try {
      await program.methods
        .createMultisig(
          [creator.publicKey, memberA.publicKey, memberB.publicKey],
          threshold
        )
        .accounts({
          creator: creator.publicKey,
          base: base.publicKey,
        })
        .signers([creator, base])
        .rpc();
    } catch (err) {
      expectAnchorError(err, "InvalidThreshold");
    }
  });
});
