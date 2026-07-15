import { Resend } from "resend";

let resend: Resend | undefined;

function getResendClient(): Resend {
    const api = process.env.NODE_ENV === "test" ? "dummy" : process.env.RESEND_API_KEY;

    if (!api) {
        throw new Error("Missing RESEND_API_KEY. Set it to enable contact email.");
    }

    resend ??= new Resend(api);
    return resend;
}

//data we need to pass through
export interface Contact{
    inquiryType: string;
    subject: string;
    message: string;
}

export const contactService = {
    sendMail: async (data: Contact) => {
        const { inquiryType, subject, message } = data;
        const resendClient = getResendClient();

        const emailLoad = {
            from: "OptiGrid Support <onboarding@resend.dev>",
            to: "cos301.coreflow@gmail.com",
            subject,
            //before asking why, this html is not frontwnd html, it is needed 
            //for the body of the email
            html: `<h2>New Ticket </h2>
            <p>Inquiry Type: ${inquiryType}</p>
            <hr /> 
            <p>Message: </p>
            <p>${message}</p>`,
        };

        const resendResp = await resendClient.emails.send(emailLoad);
        const responseData = resendResp?.data;
        const error = resendResp?.error;

        if(error) throw new Error(`Failed to send: ${error.message}`);
        if(responseData) return responseData;
        if(process.env.NODE_ENV === 'test') return { id: 'mocked-id' };

        return responseData;
    }
};
