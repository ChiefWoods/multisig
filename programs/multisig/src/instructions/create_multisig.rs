use anchor_lang::prelude::*;

use crate::{error::MultisigError, Multisig, MULTISIG_SEED};

#[derive(Accounts)]
#[instruction(members: Vec<Pubkey>)]
pub struct CreateMultisig<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    pub base: Signer<'info>,
    #[account(
        init,
        payer = creator,
        space = Multisig::space(&members),
        seeds = [MULTISIG_SEED, base.key().as_ref()],
        bump,
    )]
    pub multisig: Account<'info, Multisig>,
    pub system_program: Program<'info, System>,
}

impl CreateMultisig<'_> {
    pub fn handler(
        ctx: Context<CreateMultisig>,
        members: Vec<Pubkey>,
        threshold: u8,
    ) -> Result<()> {
        require!(!members.is_empty(), MultisigError::EmptyMembersList);
        require!(
            members.contains(&ctx.accounts.creator.key()),
            MultisigError::CreatorNotInMembers
        );
        require!(
            threshold as usize <= members.len(),
            MultisigError::InvalidThreshold
        );

        ctx.accounts.multisig.set_inner(Multisig {
            threshold,
            bump: ctx.bumps.multisig,
            next_transaction_id: 0,
            base: ctx.accounts.base.key(),
            members,
        });

        Ok(())
    }
}
