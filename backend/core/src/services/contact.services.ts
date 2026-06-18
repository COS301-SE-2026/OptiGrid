import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

//data we need to pass through
export interface Contact{
    inquiryType: string;
    subject: string;
    message: string;
}

export const contactService = {
    sendMail: async (data: Contact) => {
        const { inquiryType, subject, message } = data;

        const emailLoad = {
            from: "OptiGrid Support <onboarding@resend.dev>",
            to: "cos301.coreflow@gmail.com",
            subject: `[${inquiryType}] &{subject}`,
            //before asking why, this html is not frontwnd html, it is needed 
            //for the body of the email
            html: `<h2>New Ticket </h2>
            <p>Inquiry Type: ${inquiryType}</p>
            <hr /> 
            <p>Message: </p>
            <p>${message}</p?`,
        };

        const {data:responseData, error} = await resend.emails.send(emailLoad);

        if(error) throw new Error("Failed to send: $error.message");
        return responseData;
    }
};