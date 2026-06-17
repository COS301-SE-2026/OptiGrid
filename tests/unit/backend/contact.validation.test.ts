import { contactSchema } from "../../../backend/core/validation/contact.validation"; 

describe("Contatc Validation schema", () =>{
    it("should_pass_if_valid_data_given", () => {
        //arrange
        const valid= {
            inquiryType: 'Building',
            subject: 'Testing to see if works',
            message: 'Something related to my builidng is not working, help needed'
        };
        //act and then assert
        const out = contactSchema.safeParse(valid);
        expect(out.success).toBe(true);
    });

    it("should_fail_if_some_fields_missing", () => {
        //arrange
        const missing = {
            inquiryType: 'Building'  
    
        };
        //act n assert
        const out = contactSchema.safeParse(missing);
        expect(out.success).toBe(false); 
    });

    it("should_fail_if_message_is_is_less_than_10_characters", () => {
        //arrange
        const shortMsg = {
            inquiryType: 'LessCHaracters',
            subject: 'less than 10 characters',
            message: '123456789'
        }
        //act  assert
        const out = contactSchema.safeParse(shortMsg);
        expect(out.success).toBe(false);
    });
} )