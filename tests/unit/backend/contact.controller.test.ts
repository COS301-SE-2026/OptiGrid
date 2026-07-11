import { handleSubmit } from "../../../backend/core/src/controllers/contact.controller"
import { contactService } from "../../../backend/core/src/services/contact.services"
import { Request, Response } from "express"
import { checkIdempotencyKey, saveIdempotencyKey } from "../../../backend/core/src/services/idempotency.services";

jest.mock("../../../backend/core/src/services/contact.services.ts");
jest.mock("../../../backend/core/src/services/idempotency.services", () => ({
    checkIdempotencyKey: jest.fn(),
    saveIdempotencyKey: jest.fn()
}))

describe("Contact-Us page Controller", () => {
    let req: Partial<Request>;
    let resp: Partial<Response>;
    let mockstatus: jest.Mock;
    let json: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        json = jest.fn();
        mockstatus = jest.fn().mockReturnValue({json: json});

        resp = {
            status: mockstatus,
        };
    });

    it("should_return_an_200_when_everything_is_valid_and_save_key", async() => {
        //arrange
        req = {
            headers: {
                "idempotency-key": "test-123"
            },
            body: {
                inquiryType: "Building",
                subject: "Testing",
                message: "we need this message to be more than 10 characters long",
            },
        };
        //act
        (checkIdempotencyKey as jest.Mock).mockResolvedValue(null);
        (contactService.sendMail as jest.Mock).mockResolvedValue({id: "email-111"});
        await handleSubmit(req as Request, resp as Response);
        //assert
        expect(checkIdempotencyKey).toHaveBeenCalledWith("contact", "test-123")
        expect(saveIdempotencyKey).toHaveBeenCalledWith("contact", "test-123", expect.any(Object));
        expect(contactService.sendMail).toHaveBeenCalledWith(req.body);
        expect(mockstatus).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith({
            success: true,
            message: "Recieved the ticket",
            id: "email-111",
        });
        
    });

    it("should_return_400_if_field_missing", async () => {
        //arrange
        req = {
            headers: {
                "idempotency-key": "test-123"
            },
            body: {
                inquiryType: "Building",
                subject: "Testing",
            },
        };
        //act 
        (checkIdempotencyKey as jest.Mock).mockResolvedValue(null)
        await handleSubmit(req as Request, resp as Response);
        //assert
        expect(saveIdempotencyKey).not.toHaveBeenCalled();
        expect(contactService.sendMail).not.toHaveBeenCalled();
        expect(mockstatus).toHaveBeenLastCalledWith(400);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({success: false}));
    });

    it("should_return_cahced_responese_if_key_exists", async () => {
        req = {
            headers: {
                "idempotency-key": "test-duplicate-123"
            },
            body: {
                inquiryType: "Building",
                subject: "Testing",
                message: "we need this duplicate message",
            },
        };

        const cached = {
            success: true,
            message: "Received the ticket",
            id: "email-old-id-from-redis"
        };
        //act
        (checkIdempotencyKey as jest.Mock).mockResolvedValue(cached);
        await handleSubmit(req as Request, resp as Response);
        //assert
        expect(checkIdempotencyKey).toHaveBeenCalledWith("contact", "test-duplicate-123");
        expect(contactService.sendMail).not.toHaveBeenCalled();
        expect(saveIdempotencyKey).not.toHaveBeenCalled();
        expect(mockstatus).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith(cached);
    })
})