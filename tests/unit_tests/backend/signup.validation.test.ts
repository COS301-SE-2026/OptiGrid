import { validateSignUp, signupSchema } from '../../../backend/core/src/validation/user_auth.validation';

/**so this test suite is for signup validation, we test that valid payloads pass through to next()
and invalid payload return proper errors with 400 status**/
describe('signup validation', () => {
	it('passes valid signup payloads to next()', async () => {
		// Arrange
		const req = {
			body: {
				email: 'user@example.com',
				password: 'SecurePass123!',
				name: 'Jane Doe',
			},
		} as any;
		const res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		} as any;
		const next = jest.fn();

		// Act
		await validateSignUp(signupSchema)(req, res, next);

		// Assert
		expect(req.body).toEqual({
			email: 'user@example.com',
			password: 'SecurePass123!',
			name: 'Jane Doe',
		});
		expect(next).toHaveBeenCalledTimes(1);
		expect(res.status).not.toHaveBeenCalled();
	});

	it('returns a 400 with validation errors for an invalid payload', async () => {
		// Arrange
		const req = {
			body: {
				email: 'bad-email',
				password: 'weak',
				name: 'Jo',
			},
		} as any;
		const res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		} as any;
		const next = jest.fn();

		// Act
		await validateSignUp(signupSchema)(req, res, next);

		// Assert
		expect(next).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({
				message: 'Validation error',
				errors: expect.arrayContaining([
					expect.objectContaining({ field: 'email' }),
					expect.objectContaining({ field: 'password' }),
					expect.objectContaining({ field: 'name' }),
				]),
			}),
		);
	});
});