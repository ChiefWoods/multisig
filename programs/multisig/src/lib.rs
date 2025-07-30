pub mod constants;
pub mod error;
pub mod instructions;
pub mod macros;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("2nWYcvY67gVE2prfPGSZJedXJFfuBqx1edXscJhxZe9T");

#[program]
pub mod multisig {
    use super::*;

    pub fn create_multisig(
        ctx: Context<CreateMultisig>,
        members: Vec<Pubkey>,
        threshold: u8,
    ) -> Result<()> {
        CreateMultisig::handler(ctx, members, threshold)
    }

    pub fn propose_transaction(
        ctx: Context<ProposeTransaction>,
        transaction_types: Vec<TransactionType>,
    ) -> Result<()> {
        ProposeTransaction::handler(ctx, transaction_types)
    }

    pub fn cast_vote(ctx: Context<CastVote>) -> Result<()> {
        CastVote::handler(ctx)
    }

    pub fn execute_transaction(ctx: Context<ExecuteTransaction>) -> Result<()> {
        ExecuteTransaction::handler(ctx)
    }
}
