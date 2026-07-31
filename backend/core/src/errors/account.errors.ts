export class AccountDeactivatedError extends Error {
    readonly code = 'ACCOUNT_DEACTIVATED';

    constructor() {
        super('This account is deactivated. Recover the account to regain access.');
        this.name = 'AccountDeactivatedError';
    }
}

export class AccountAlreadyActiveError extends Error {
    readonly code = 'ACCOUNT_ALREADY_ACTIVE';

    constructor() {
        super('This account is already active. Please log in normally.');
        this.name = 'AccountAlreadyActiveError';
    }
}

export class AccountNotFoundError extends Error {
    readonly code = 'ACCOUNT_NOT_FOUND';

    constructor() {
        super('Account profile was not found.');
        this.name = 'AccountNotFoundError';
    }
}

export class LastActiveAdminError extends Error {
    readonly code = 'LAST_ACTIVE_ADMIN';

    constructor() {
        super('The last active administrator cannot be permanently deleted.');
        this.name = 'LastActiveAdminError';
    }
}

export class SelfPermanentDeletionError extends Error {
    readonly code = 'SELF_PERMANENT_DELETION_FORBIDDEN';

    constructor() {
        super('Administrators cannot permanently delete their own account.');
        this.name = 'SelfPermanentDeletionError';
    }
}
