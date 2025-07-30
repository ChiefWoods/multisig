use anchor_lang::{prelude::*, solana_program::pubkey::PUBKEY_BYTES};

use crate::{error::MultisigError, Multisig, Transaction, MULTISIG_SEED, TRANSACTION_SEED};

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub member: Signer<'info>,
    #[account(
        mut,
        seeds = [MULTISIG_SEED, multisig.base.key().as_ref()],
        bump = multisig.bump,
        constraint = multisig.members.contains(&member.key()) @ MultisigError::UnauthorizedMember,
    )]
    pub multisig: Account<'info, Multisig>,
    #[account(
        mut,
        realloc = transaction.to_account_info().data_len() + PUBKEY_BYTES,
        realloc::payer = member,
        realloc::zero = false,
        seeds = [
            TRANSACTION_SEED,
            multisig.key().as_ref(),
            &transaction.id.to_le_bytes()
        ],
        bump = transaction.bump,
        constraint = !transaction.signers.contains(&member.key()) @ MultisigError::MemberAlreadyVoted,
        constraint = !transaction.executed @ MultisigError::TransactionAlreadyExecuted,
    )]
    pub transaction: Account<'info, Transaction>,
    pub system_program: Program<'info, System>,
}

impl CastVote<'_> {
    pub fn handler(ctx: Context<CastVote>) -> Result<()> {
        ctx.accounts
            .transaction
            .signers
            .push(ctx.accounts.member.key());

        Ok(())
    }
}
