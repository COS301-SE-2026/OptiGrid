import { contactService } from '../../../backend/core/src/services/contact.services';
import { Resend } from 'resend' ;

//we have to mock the resend thing as to not keep on sending emails to our account
const mockSend = jest.fn();

jest.mock("resend", () => {
    return {
        Resend: jest.fn().mockImplementation(() => {
            return {
                emails: { 
                send: (payload: any) => mockSend(payload),
                }
            };
        }),
    };
});

describe("COntact-US Page services", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should_send_email_succesfully", async () => {
        //arrange
        const valid = {
            inquiryType: "Building",
            subject: "We testing succesfull path",
            message: "Email sent succesfully, we recieved it",
        };
        //act
        const out = await contactService.sendMail(valid);
        //assert
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
            to: "cos301.coreflow@gmail.com",
            subject: "We testing succesfull path"
        }));
        expect(out.id).toBe("mocked-id");
    });

    it("should_thorw_error_if_resend_send_error_obj", async () =>{
        //arrange
        mockSend.mockResolvedValueOnce({
            data:null,
            error: {
                message: "API key is missing or invalid"
            },
        });

        const failed = {
            inquiryType: "Building",
            subject: "Testing Failure",
            message: "something went wrong and its not working",
        };
        //act and assett
        await expect(contactService.sendMail(failed)).rejects.toThrow( "Failed to send: API key is missing or invalid");
    });

    it("should_throw_error_if_network_issues_arise", async () => {
        //arrange
        mockSend.mockRejectedValueOnce(
            new(Error)('Network Fault')
        );

        const networkFailed = {
            inquiryType: "Building",
            subject: "Testing Failure",
            message: "something went wrong and its not working",
        }
        //act n assert
        await expect(contactService.sendMail(networkFailed)).rejects.toThrow('Network Fault');
    }); 
})