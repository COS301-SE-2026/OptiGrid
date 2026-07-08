import { validateSignUp, validateBody, loginSchema, signupSchema } from '../../../backend/core/src/validation/user_auth.validation';

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

	it('rejects signup payloads carrying unexpected fields to guard against mass assignment', async () => {
		//Arrange
		const req = {
			body: {
				email: 'user@example.com',
				password: 'SecurePass123!',
				name: 'Jane Doe',
				role: 'admin',
				tenant_id: '11111111-1111-4111-8111-111111111111',
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
	});

	it('passes valid login payloads to and rejects any extra fields', async () => {
		const res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		} as any;

		
		const validReq = { body: { email: 'user@example.com', password: 'SecurePass123!' } } as any;
		const validNext = jest.fn();
		await validateBody(loginSchema)(validReq, res, validNext);
		expect(validNext).toHaveBeenCalledTimes(1);
		const invalidReq = { body: { email: 'user@example.com', password: 'SecurePass123!', is_admin: true } } as any;
		const invalidNext = jest.fn();
		await validateBody(loginSchema)(invalidReq, res, invalidNext);

		expect(invalidNext).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(400);
	});
});