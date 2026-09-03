export type FAQItem = { question: string, answer: string};
export type FAQCategory = { category: string, items: FAQItem[] };

export const Categories: FAQCategory[] = [
    {
        category: "Sign Up & Account",
        items: [
            {
                question: "How do I create an OptiGrid account?",
                answer: "Click 'Get started free' on the landing page, fill in your first name, last name, email address, and a password of at least 8 characters, then re-enter the password to confirm it. Once the account is created you are signed in and taken straight to your dashboard.",
            },
            {
                question: "Can I sign up with an email that is already registered?",
                answer: "No. If the email address is already in use, the sign up form shows a message telling you to log in instead. Use a different email or log in to your existing account.",
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
            {
                question: "Why was I sent back to the login page?",
                answer: "Your session expired or the browser cookie was cleared. Any dashboard page checks for a valid session and sends you to the login page when it does not find one, so logging in again will get you back.",
            },
        ],
    },
    {
        category: "Appearance",
        items: [
            {
                question: "Does OptiGrid support dark mode?",
                answer: "Yes. Open Settings from the sidebar and use the theme card, which shows the mode you are in and a button to switch to the other one.",
            },
            {
                question: "Is my theme preference saved?",
                answer: "Your choice is remembered in the browser you set it in, so if you also use OptiGrid on another computer you will need to set it there as well.",
            },
        ],
    },
    {
        category: "Buildings",
        items: [
            {
                question: "How do I add a building?",
                answer: "Click '+ Add building' at the top of the dashboard. Only the building name is required, so you can fill in as much of the rest as you have to hand. Saving returns you to the dashboard with the new building in the list.",
            },
            {
                question: "Why should I fill in the floor area?",
                answer: "It is what makes the efficiency comparison work. OptiGrid divides a building's energy use by its floor area, so a building with no floor area recorded is left out of the efficiency ratio on the Compare page.",
            },
        ],
    },
    {
        category: "Live Readings",
        items: [
            {
                question: "What does the Live page show?",
                answer: "It lists your buildings with the demand each one is drawing right now in kW, the energy it has used so far today in kWh, and a status badge. The busiest buildings are sorted to the top.",
            },
            {
                question: "How often does it update?",
                answer: "Readings stream in as the sensors report them, and the page refreshes the rest of the building details every five seconds. The line under the heading tells you whether the connection is live and when the page last updated.",
            },
            {
                question: "Why is a building showing as Offline?",
                answer: "No reading has arrived from it in the last five minutes, so the figures shown next to it are stale. Buildings that are reporting normally show a Normal badge instead.",
            },
        ],
    },
    {
        category: "Compare Buildings",
        items: [
            {
                question: "How do I compare two buildings?",
                answer: "Open Compare, pick a building in each of the two selectors, then choose a date range and whether you want to compare cost or energy. The chart redraws to plot both buildings over that period.",
            },
            {
                question: "What does the key insights panel tell me?",
                answer: "It gives you an efficiency ratio, which weighs the two buildings against each other once their energy use is measured per square metre, and the total difference between them over the period you picked.",
            },
            {
                question: "Why is there no efficiency ratio for my comparison?",
                answer: "That figure needs the floor area of both buildings. If either one has no floor area recorded, the ratio cannot be worked out and only the total difference is shown.",
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
                answer: "Forecast accuracy is measured by MAPE (Mean Absolute Percentage Error). The model accuracy card in the forecast summary shows the current MAPE for the selected building so you can judge how much to rely on it.",
            },
            {
                question: "How do I generate a forecast for a different building?",
                answer: "Use the building selector on the Forecast page to pick any building in your portfolio, then click 'Run forecast'. The chart and summary metrics update once it finishes.",
            },
            {
                question: "What is the peak demand figure in the forecast summary?",
                answer: "It is the highest single predicted demand value within the forecast window, along with the timestamp it is expected to occur. Use it to plan ahead for peak tariff periods.",
            },
            {
                question: "What is the difference between the weekly and monthly horizon?",
                answer: "Weekly projects the next seven days at an hourly resolution, which suits day to day planning. Monthly projects the next twelve weeks and is better for spotting seasonal movement.",
            },
            {
                question: "What is the shaded area around the forecast line?",
                answer: "That is the confidence range. The prediction itself is the dashed line, and the shading shows the span the actual demand is expected to fall within. A wider band means there is more uncertainty in that part of the forecast.",
            },
        ],
    },
    {
        category: "Insights",
        items: [
            {
                question: "What are insights?",
                answer: "They are load shifting suggestions worked out from your consumption and forecast data. Each one describes the strategy, the load it proposes to move, the window it applies to, and the estimated monthly saving in Rand.",
            },
            {
                question: "What do the statuses on a recommendation mean?",
                answer: "Pending is waiting on a decision and Applying has been approved and is being put into effect. Implemented has been carried out, Dismissed was reviewed and turned down, and Expired passed its window before anyone acted on it.",
            },
            {
                question: "Can I approve a recommendation myself?",
                answer: "Approving and dismissing is handled by the team that runs the building, so those buttons only appear for them. You can still read every recommendation and its estimated saving, and raise anything worth acting on with them.",
            },
            {
                question: "What does the confidence score mean?",
                answer: "It reflects how strongly the underlying forecast supports the suggested shift. Treat a lower confidence score as a reason to sanity check the saving against what you know about the site before relying on it.",
            },
        ],
    },
    {
        category: "Anomaly Alerts",
        items: [
            {
                question: "What is an anomaly alert?",
                answer: "It is raised when a reading moves outside the range expected for that building and measurement. The measurements covered are voltage, current, power, and energy. The alert points at the specific measure that moved.",
            },
            {
                question: "What should I do when I see one?",
                answer: "The Anomaly page gives you a read-only view of alerts across your buildings. Check whether the reading lines up with something you already know about, such as planned work on site, and pass anything unexpected to the team that manages that building.",
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
                answer: "OptiGrid is an energy intelligence platform for teams that run more than one building. It brings meter and sensor readings, anomaly detection, demand forecasting, and cost tracking into one workspace so decisions are made from data rather than from guesswork.",
            },
            {
                question: "Who is OptiGrid for?",
                answer: "Facility and portfolio teams who need to keep energy spend under control across several sites. Roles range from viewers who read the numbers, to building managers who act on alerts and recommendations, to administrators who manage users and tariffs.",
            },
            {
                question: "What does OptiGrid need from my buildings?",
                answer: "Meter, BMS, or IoT gateway readings for the buildings you want to track. Details such as floor area are optional, though recording them unlocks the per square metre efficiency comparison between buildings.",
            },
            {
                question: "Which currency are the figures shown in?",
                answer: "Costs and savings are shown in South African Rand and worked out from the tariff rates configured for your organisation.",
            },
        ],
    },
    {
        category: "Sign Up & Account",
        items: [
            {
                question: "How do I create an OptiGrid account?",
                answer: "Click 'Get started free', fill in your first name, last name, email address, and a password of at least 8 characters, then re-enter the password to confirm it. Once the account is created you are signed in and taken straight to your dashboard.",
            },
            {
                question: "Can I sign up with an email that is already registered?",
                answer: "No. If the email address is already in use, the sign up form tells you to log in instead. Use a different email or log in to your existing account.",
            },
            {
                question: "Do I need to install anything?",
                answer: "No. OptiGrid runs in the browser, so once you have an account you can open it from any computer without setting up software.",
            },
        ],
    },
    {
        category: "What You Can Do",
        items: [
            {
                question: "What does the dashboard show?",
                answer: "Every building in your portfolio with its energy use and cost figures, so you can see how the whole estate is performing before drilling into a single site.",
            },
            {
                question: "Can I see readings as they happen?",
                answer: "Yes. The Live page lists your buildings with the demand each one is drawing right now in kW and the energy used so far today in kWh. Readings stream in as sensors report them, and a building with nothing arriving for five minutes is flagged as offline.",
            },
            {
                question: "How does OptiGrid compare two buildings?",
                answer: "Pick two buildings, a date range, and whether you are comparing cost or energy. The chart plots both over that period, and the insights panel gives the total difference along with an efficiency ratio once floor area is recorded for both.",
            },
            {
                question: "What can OptiGrid forecast?",
                answer: "Short term demand for any building in your portfolio, plotted against historical consumption with a confidence range around the prediction. Weekly covers the next seven days hour by hour and monthly covers the next twelve weeks.",
            },
            {
                question: "How accurate are the forecasts?",
                answer: "Accuracy is reported as MAPE, the mean absolute percentage error, and shown per building so you can judge how much weight to give a prediction.",
            },
        ],
    },
    {
        category: "Alerts & Recommendations",
        items: [
            {
                question: "What is an anomaly alert?",
                answer: "It is raised when a reading moves outside the range expected for that building. Voltage, current, power, and energy are each covered, and the alert points at the specific measure that moved.",
            },
            {
                question: "What are insights?",
                answer: "Load shifting suggestions worked out from your consumption and forecast data. Each one describes the strategy, the load it proposes to move, the window it applies to, and the estimated monthly saving in Rand.",
            },
            {
                question: "Does OptiGrid change anything at my site on its own?",
                answer: "No. Recommendations are put to the team that runs the building, and it is up to them to approve or dismiss each one.",
            },
        ],
    },
    {
        category: "Access & Support",
        items: [
            {
                question: "Can different people see different things?",
                answer: "Yes. Access follows the role on the account, so administrators, building managers, and viewers each see the pages that suit their work.",
            },
            {
                question: "Is there a record of what changes?",
                answer: "Administrators and building managers have an audit trail covering activity on the platform, which is useful when you need to trace who changed what.",
            },
            {
                question: "Where do I find guides once I have signed up?",
                answer: "The help centre opens from the sidebar after you log in. It holds the user manual, video tutorials with written steps, and a support contact form.",
            },
            {
                question: "How do I reach the team before signing up?",
                answer: "Use the Contact link in the footer to send us a message and we will get back to you.",
            },
        ],
    },
];