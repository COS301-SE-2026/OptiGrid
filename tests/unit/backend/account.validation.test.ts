import {
    changePasswordSchema,
    updateProfileSchema,
} from '../../../backend/core/src/validation/account.validation';

describe('updateProfileSchema', () => {
    it.each([
        ['Thandi', 'Mokoena'],
        ["Seán", "O'Connor"],
        ['Mary-Jane', 'van der Merwe'],
        ['Nomvula', ''],
        ['Zoë', 'St. Clair'],
    ])('accepts %s %s', (firstName, lastName) => {
        expect(updateProfileSchema.safeParse({ firstName, lastName }).success).toBe(true);
    });

    it('trims names and folds repeated spaces', () => {
        const parsed = updateProfileSchema.parse({ firstName: '  Thandi  ', lastName: 'van   der  Merwe ' });

        expect(parsed).toEqual({ firstName: 'Thandi', lastName: 'van der Merwe' });
    });

    it('gives one clear message for an empty first name', () => {
        const result = updateProfileSchema.safeParse({ firstName: '   ', lastName: 'Mokoena' });

        expect(result.success).toBe(false);
        expect(result.error?.issues.map((issue) => issue.message)).toEqual(['Enter your first name.']);
    });

    it.each([
        ['Th4ndi', 'Mokoena'],
        ['-Thandi', 'Mokoena'],
        ['Thandi', '<script>'],
        ['A'.repeat(61), 'Mokoena'],
    ])('rejects %s %s', (firstName, lastName) => {
        expect(updateProfileSchema.safeParse({ firstName, lastName }).success).toBe(false);
    });

    it('does not accept an email or role change', () => {
        expect(updateProfileSchema.safeParse({ firstName: 'Thandi', lastName: 'Mokoena', email: 'x@example.com' }).success).toBe(false);
        expect(updateProfileSchema.safeParse({ firstName: 'Thandi', lastName: 'Mokoena', roleType: 'ADMIN' }).success).toBe(false);
    });
});

describe('changePasswordSchema', () => {
    const valid = { currentPassword: 'OldPass123!', newPassword: 'NewPass456!' };

    it('accepts a strong new password', () => {
        expect(changePasswordSchema.parse(valid)).toEqual(valid);
    });

    it('still accepts the checkbox value sent by pages opened before it was removed', () => {
        expect(changePasswordSchema.parse({ ...valid, signOutOtherDevices: false })).toEqual({ ...valid, signOutOtherDevices: false });
    });

    it.each([
        ['Short1!', 'needs at least 8 characters'],
        ['alllowercase1!', 'Mix upper and lower case'],
        ['NoNumbers!!', 'Mix upper and lower case'],
        ['NoSymbols123', 'Mix upper and lower case'],
    ])('rejects %s', (newPassword, message) => {
        const result = changePasswordSchema.safeParse({ ...valid, newPassword });

        expect(result.success).toBe(false);
        expect(result.error?.issues.some((issue) => issue.message.includes(message))).toBe(true);
    });

    it('rejects a new password longer than bcrypt can store', () => {
        const result = changePasswordSchema.safeParse({ ...valid, newPassword: `Aa1!${'é'.repeat(40)}` });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('too long');
    });

    it('requires the current password', () => {
        expect(changePasswordSchema.safeParse({ ...valid, currentPassword: '' }).success).toBe(false);
    });

    
    it('rejects reusing the current password', () => {
        const result = changePasswordSchema.safeParse({ currentPassword: 'SamePass123!', newPassword: 'SamePass123!' });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['newPassword']);
    });

    it('rejects unknown fields and non-boolean flags', () => {
        expect(changePasswordSchema.safeParse({ ...valid, confirmPassword: 'NewPass456!' }).success).toBe(false);
        expect(changePasswordSchema.safeParse({ ...valid, signOutOtherDevices: 'yes' }).success).toBe(false);
    });
});