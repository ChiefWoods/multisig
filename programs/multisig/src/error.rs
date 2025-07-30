use anchor_lang::prelude::*;

#[error_code]
pub enum MultisigError {
    #[msg("Member list cannot be empty")]
    EmptyMembersList,
    #[msg("Creator must be included in the members list")]
    CreatorNotInMembers,
    #[msg("Threshold cannot be greater than the number of members")]
    InvalidThreshold,
    #[msg("Member is not part of the multisig")]
    UnauthorizedMember,
    #[msg("Transaction types list cannot be empty")]
    EmptyTransactionTypesList,
    #[msg("Member has already voted on this transaction")]
    MemberAlreadyVoted,
    #[msg("Transaction has already been executed")]
    TransactionAlreadyExecuted,
    #[msg("Amount of signers do not meet threshold")]
    InsufficientVotes,
    #[msg("Member already exists in the multisig")]
    MemberAlreadyExists,
    #[msg("Member list will drop below threshold if member is removed")]
    CannotRemoveMemberBelowThreshold,
    #[msg("Member does not exist in the multisig")]
    MemberDoesNotExist,
}
