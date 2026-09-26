export type FAQItem = { question: string, answer: string};
export type FAQCategory = { category: string, items: FAQItem[] };

export const Categories: FAQCategory[] = [
    {
        category: "Sign Up & Account",
        items: [
            {
                question: "How do I create an account?",
                answer: "Click Get started free on the home page. Fill in your name and email. Then pick a password of at least 8 characters.",
            },
            {
                question: "Can I use an email that is already registered?",
                answer: "No. The form will ask you to log in instead.",
            },
        ],
    },
    {
        category: "Login & Session",
        items: [
            {
                question: "How do I log in?",
                answer: "Open the login page and enter your email and password. Click Log in to reach your dashboard.",
            },
            {
                question: "How do I log out?",
                answer: "Use the Logout button at the bottom of the sidebar.",
            },
            {
                question: "Why was I sent back to the login page?",
                answer: "Your session ended. Log in again to carry on where you left off.",
            },
            {
                question: "Can I use two accounts at the same time?",
                answer: "Yes. Each browser tab keeps its own login.",
            },
        ],
    },
    {
        category: "Appearance",
        items: [
            {
                question: "Does OptiGrid have a dark mode?",
                answer: "Yes. Open Settings and press the theme button.",
            },
            {
                question: "Is my theme saved?",
                answer: "It is. OptiGrid remembers your choice for your account.",
            },
        ],
    },
    {
        category: "Buildings",
        items: [
            {
                question: "How do I add a building?",
                answer: "Click + Add building on the dashboard. Only the name is required.",
            },
            {
                question: "What does the Validate button do?",
                answer: "It looks up the address you typed. The latitude and longitude are then filled in for you.",
            },
            {
                question: "Why should I add the floor area?",
                answer: "Energy use is compared per square metre. Without a floor area the building is left out of that comparison.",
            },
            {
                question: "What is the 3D view?",
                answer: "Open any building to see a model of it. Each sensor sits in its zone and glows with its live load.",
            },
            {
                question: "How do I add a sensor?",
                answer: "Open the building and click Sensors. Use Register sensor to add a new one.",
            },
        ],
    },
    {
        category: "Live Readings",
        items: [
            {
                question: "What does the Live page show?",
                answer: "It shows how much power each building is using right now. You can also see the energy used so far today.",
            },
            {
                question: "Why is a building marked Offline?",
                answer: "No reading has arrived from it in the last five minutes.",
            },
        ],
    },
    {
        category: "Heatmap",
        items: [
            {
                question: "What does the heatmap show?",
                answer: "Your buildings on a map. Sites that use more energy stand out in a stronger colour.",
            },
            {
                question: "Can I look at the past or the future?",
                answer: "Yes. Drag the timeline to look back up to 90 days. You can also look up to 90 days ahead.",
            },
            {
                question: "Why is my building missing from the map?",
                answer: "It has no location yet. Edit the building and use Validate on its address.",
            },
        ],
    },
    {
        category: "Compare Buildings",
        items: [
            {
                question: "How do I compare two buildings?",
                answer: "Open Compare and pick a building in each box. Choose a date range and whether to compare cost or energy.",
            },
            {
                question: "Why is there no efficiency ratio?",
                answer: "Both buildings need a floor area for this number to work.",
            },
        ],
    },
    {
        category: "Demand Forecast",
        items: [
            {
                question: "How do I run a forecast?",
                answer: "Pick a building and a horizon on the Forecast page. Then click Run forecast.",
            },
            {
                question: "What is the difference between weekly and monthly?",
                answer: "Weekly shows the next seven days hour by hour. Monthly covers the next twelve weeks.",
            },
            {
                question: "What is the shaded band on the chart?",
                answer: "It is the range the real demand will most likely fall in. A wide band means the forecast is less certain.",
            },
            {
                question: "How accurate is the forecast?",
                answer: "Look at the MAPE figure below the chart. A lower number means a closer forecast.",
            },
        ],
    },
    {
        category: "Insights",
        items: [
            {
                question: "What are insights?",
                answer: "Tips for moving load to cheaper hours. Each one shows the monthly saving in Rand.",
            },
            {
                question: "Can I approve an insight?",
                answer: "Building managers and administrators can approve or dismiss them. Viewers can still read every one.",
            },
        ],
    },
    {
        category: "Anomaly Alerts",
        items: [
            {
                question: "What is an anomaly alert?",
                answer: "A warning that a reading is outside its normal range.",
            },
            {
                question: "What should I do when I get one?",
                answer: "First check for a known reason like work on site. If there is none, let the building manager know.",
            },
        ],
    },
    {
        category: "ESG",
        items: [
            {
                question: "What does the ESG page show?",
                answer: "A tree that reflects your building's health score. It grows fuller as the score goes up.",
            },
            {
                question: "What do the sliders do?",
                answer: "They let you test a change before you make it. Reset to Baseline puts everything back.",
            },
        ],
    },
    {
        category: "Compliance",
        items: [
            {
                question: "What is in the compliance report?",
                answer: "A summary of last month's energy use in line with ISO 50001. You can download it as a PDF or a JSON file.",
            },
            {
                question: "What does Verify Data Integrity do?",
                answer: "It checks that no record was changed after it was saved.",
            },
        ],
    },
    {
        category: "Tariff Rates",
        items: [
            {
                question: "Who can change tariff rates?",
                answer: "Only administrators can. Rates are set for each season and time of day.",
            },
        ],
    },
];

export const PublicCategories: FAQCategory[] = [
    {
        category: "About OptiGrid",
        items: [
            {
                question: "What is OptiGrid?",
                answer: "An energy platform for people who run more than one building. It shows where your energy goes and how to use less.",
            },
            {
                question: "Who is it for?",
                answer: "Facility teams and building owners who want to cut energy costs.",
            },
            {
                question: "What do I need to get started?",
                answer: "Your buildings need meters or sensors that send readings. Everything else is set up in the app.",
            },
            {
                question: "Which currency does it use?",
                answer: "All costs are shown in South African Rand.",
            },
        ],
    },
    {
        category: "Sign Up & Account",
        items: [
            {
                question: "How do I create an account?",
                answer: "Click Get started free. Fill in your name and email and pick a password.",
            },
            {
                question: "Do I need to install anything?",
                answer: "No. OptiGrid runs in your web browser.",
            },
        ],
    },
    {
        category: "What You Can Do",
        items: [
            {
                question: "Can I see readings as they happen?",
                answer: "Yes. The Live page updates every few seconds.",
            },
            {
                question: "Can I see my buildings on a map?",
                answer: "Yes. A heatmap shows which sites use the most energy. You can also look back or ahead in time.",
            },
            {
                question: "Is there a 3D view?",
                answer: "Each building has a 3D model with its sensors placed inside.",
            },
            {
                question: "Can OptiGrid predict demand?",
                answer: "It can. Forecasts reach up to twelve weeks ahead.",
            },
            {
                question: "Can I compare buildings?",
                answer: "Pick any two and compare their cost or energy over time.",
            },
        ],
    },
    {
        category: "Alerts & Reports",
        items: [
            {
                question: "How will I know if something is wrong?",
                answer: "OptiGrid raises an alert when a reading looks unusual.",
            },
            {
                question: "Will it help me save money?",
                answer: "Yes. It suggests moving load to cheaper hours and shows what you would save.",
            },
            {
                question: "Does OptiGrid change anything on site by itself?",
                answer: "No. Your team decides what to act on.",
            },
            {
                question: "Can I get reports for an audit?",
                answer: "You can download an ISO 50001 report with a digital signature.",
            },
            {
                question: "What is the ESG score?",
                answer: "A score from 0 to 100 for how green a building runs. Sliders let you test changes before you make them.",
            },
        ],
    },
    {
        category: "Access & Support",
        items: [
            {
                question: "Can different people see different things?",
                answer: "Yes. What you see depends on your role.",
            },
            {
                question: "How do I contact the team?",
                answer: "Use the Contact link at the bottom of the page.",
            },
        ],
    },
];