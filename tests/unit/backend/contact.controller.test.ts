import { handleSubmit } from "../../../backend/core/src/controllers/contact.controller"
import { contactService } from "../../../backend/core/src/services/contact.services"
import { Request, Response } from "express"

jest.mock("../../../backend/core/src/services/contact.services.ts");

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

    it("should_return_an_200_when_everything_is_valid", async() => {
        //arrange
        req = {
            body: {
                inquiryType: "Building",
                subject: "Testing",
                message: "we need this message to be more than 10 characters long",
            },
        };
        //act
        (contactService.sendMail as jest.Mock).mockResolvedValue({id: "email-111"});
        await handleSubmit(req as Request, resp as Response);
        //assert
        expect(contactService.sendMail).toHaveBeenCalledWith(req.body);
        expect(mockstatus).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith({
            success: true,
            message: "Received the ticket",
            id: "email-111",
        });
        
    });

    it("should_return_400_if_field_missing", async () => {
        //arrange
        req = {
            body: {
                inquiryType: "Building",
                subject: "Testing",
            },
        };
        //acr and assert
        await handleSubmit(req as Request, resp as Response);
        expect(contactService.sendMail).not.toHaveBeenCalled();
        expect(mockstatus).toHaveBeenLastCalledWith(400);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({success: false}));
    });
})