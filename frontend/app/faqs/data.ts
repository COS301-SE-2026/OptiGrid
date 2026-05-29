export type FAQItem = { question: string, answer: string};
export type FAQCategory = { category: string, items: FAQItem[] };

export const Categories: FAQCategory[] = [
    {
        category: "Sign Up & Account",
        items: [
            {
                question: "How do I create an OptiGrid account?",
                answer: "Click 'Get started free' on the landing page, fill in your first name, last name, email address, and a password of at least 8 characters, then submit. You will be redirected to the login page once your account is created.",
            },
            {
                question: "Can I sign up with an email that is already registered?",
                answer: "No. If the email address is already in use, you will see an error message on the sign up form. Use a different email or log in to your existing account.",
            },
        ],
    },
    {
        category: "Login & Session",
        items: [
            {
                question: "How do I log in?",
                answer: "Navigate to the Login page, enter your registered email address and password, and click 'Log in'. You will be taken to your dashboard on success.",
            },
            {
                question: "How do I log out?",
                answer: "Click the 'Logout' button at the bottom of the sidebar in any dashboard page. Your session will be cleared and you will be redirected to the login page.",
            },
        ],
    },
    {
        category: "Appearance",
        items: [
            {
                question: "Does OptiGrid support dark mode?",
                answer: "Yes. Use the sun/moon icon button in the dashboard header to toggle between light and dark mode. Your preference is saved to your account and will be restored the next time you log in.",
            },
        ],
    },
    {
        category: "Buildings",
        items: [
            {
                question: "How do I add a building?",
                answer: "Click 'Add building' in the dashboard. Fill in the required details and save. The new building will appear in your portfolio immediately.",
            },
            {
                question: "How do I edit a building's details?",
                answer: "From the Buildings list, click the edit action for the building you want to update, make your changes, and save.",
            },
            {
                question: "Can I delete a building?",
                answer: "Yes. From the Buildings list you can delete a building. This action is permanent — all associated data for that building will be removed.",
            },
        ],
    },
    {
        category: "Demand Forecast",
        items: [
            {
                question: "What does the Demand Forecast page show?",
                answer: "It shows a combined chart of historical energy consumption (kWh) and an ML-driven short-term demand forecast for a selected building, including a confidence band around the prediction.",
            },
            {
                question: "How accurate are the forecasts?",
                answer: "Forecast accuracy is measured by MAPE (Mean Absolute Percentage Error). The summary panel on the forecast page shows the current MAPE for the selected building so you can assess reliability.",
            },
            {
                question: "How do I generate a forecast for a different building?",
                answer: "Use the building selector on the Forecast page to pick any building in your portfolio. The chart and summary metrics will update automatically once you click Run forecast.",
            },
            {
                question: "What is the peak kWh figure in the forecast summary?",
                answer: "It is the highest single predicted demand value within the forecast window, along with the timestamp it is expected to occur. Use it to plan ahead for peak tariff periods.",
            },
        ],
    },
];