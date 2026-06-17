import {sendMail} from '../../../backend/core/src/services/contact.services.ts';
import { Resend } from 'resend' ;

//we have to mock the resend thing as to not keep on sending emails to our account
jest.mock("resend", () => {
    return {
        Resend: jest.fn().mockImplementation(() => {
            emails: { send: jest.fn().mockResolvedValue({
                data: {
                    id: "mocked-id",
                    error: null
                },
            })}
        }),
    };
});


describe("COntact-US Page services", () => {
    let mockedResend: any;
    beforeEach(() => {
        jest.clearAllMocks();
        mockedResend = new Resend("mock-key");
    });

    it("should_send_email_succesfully", async () => {
        //arrange
        const valid = {
            inquiryType: "Building",
            subject: "We testing succesfull path",
            message: "Email sent succesfully, we recieved it",
        };
        //act
        const out = await sendMail(valid);
        //assert
        expect(mockedResend.emails.send).toHaveBeenCalledTimes(1);
        expect(mockedResend.emails.send).toHaveBeenCalledWith(expect.objectContaining({
            to: "cos301.coreflow@gmail.com",
            subject: "We testing succesfull path"
        }));
        expect(out.id).toBe("mocked-id");
    });

    it("should_thorw_error_if_resend_send_error_obj", async () =>{
        //arrange
        mockedResend.emails.send.mockResolvedValueOnce({
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
        await expect(sendMail(failed)).rejects.toThrow( "API key is missing or invalid");
    });

    it("should_throw_error_if_network_issues_arise", async () => {
        //arrange
        mockedResend.emails.send.mockResolvedValueOnce(
            new(Error)('Network Fault')
        );

        const networkFailed = {
            inquiryType: "Building",
            subject: "Testing Failure",
            message: "something went wrong and its not working",
        }
        //act n assert
        await expect(sendMail(networkFailed).rejects.toThrow('Network Fault'));
    }); 
})