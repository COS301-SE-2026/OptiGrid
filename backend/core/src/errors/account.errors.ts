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
        super('The last active administrator cannot be removed. Make another user an administrator first.');
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

export class PasswordNotAvailableError extends Error {
    readonly code = 'PASSWORD_NOT_AVAILABLE';

    constructor() {
        super('This account signs in with Google. Its password is managed by Google.');
        this.name = 'PasswordNotAvailableError';
    }
}

export class CurrentPasswordIncorrectError extends Error {
    readonly code = 'INVALID_CURRENT_PASSWORD';

    constructor() {
        super('Your current password is not correct.');
        this.name = 'CurrentPasswordIncorrectError';
    }
}

export class PasswordRejectedError extends Error {
    readonly code: 'SAME_PASSWORD' | 'WEAK_PASSWORD';

    constructor(code: 'SAME_PASSWORD' | 'WEAK_PASSWORD', message: string) {
        super(message);
        this.code = code;
        this.name = 'PasswordRejectedError';
    }
}
