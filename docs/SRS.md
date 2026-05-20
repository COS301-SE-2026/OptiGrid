# Software Requirements and Design Specifications (SRS)
**Project Name:** OptiGrid
**Team Name:** Coreflow

---

## 1. Introduction 
Project Overview
BUsiness Need
Project Scope

***

## 2. User Stories & User Characteristics 
Intended Users and how they  will use system

***

## 3. Use Cases
***
## 1. Data Ingestion
### Use Cases

**Use Case 1: Configure API Data Feed**
* **Actor:** Admin
* **TUCBW:** The Admin enters API credentials for a new building's IoT sensor network and clicks "Connect".
* **TUCEW:** The system verifies the connection and begins displaying real-time data ingestion status.

**Use Case 2: Register Sensor**
* **Actor:** Admin
* **TUCBW:** The Admin selects a building profile, clicks "Register Sensor," and enters the MAC address for a newly installed IoT meter.
* **TUCEW:** The system registers the new sensor, linking its incoming telemetry stream to the specified building and physical zone.

**Use Case 3: Remove Sensor**
* **Actor:** Admin
* **TUCBW:** The Admin selects an existing sensor from the building inventory and clicks "Remove."
* **TUCEW:** The system severs the telemetry link and archives the sensor's historical data.

**Use Case 4: Edit Sensor Details**
* **Actor:** Admin
* **TUCBW:** The Admin selects a sensor and modifies its metadata (e.g., location name, calibration threshold).
* **TUCEW:** The system saves the updated details and applies them to the dashboard views.

### Use Case Diagram
![Data Ingestion Diagram](./images/Data_Ingestion.png)

***

## 2. Data Storage
### Use Cases

**Use Case 5: Upload Historical Batch Data**
* **Actor:** Admin
* **TUCBW:** The Admin selects a historical CSV data file and clicks "Upload" in the data storage portal.
* **TUCEW:** The Admin receives a notification that the batch data was successfully parsed and stored.

**Use Case 6: Monitor System Health**
* **Actor:** Admin
* **TUCBW:** The Admin opens the DevOps Health Dashboard from the global navigation menu.
* **TUCEW:** The Admin views live operational metrics detailing API ingestion rates, database uptime, and microservice failure logs.

**Use Case 7: Delete Data**
* **Actor:** Admin
* **TUCBW:** The Admin selects a legacy batch data file or timeframe and clicks "Delete Data."
* **TUCEW:** The system permanently purges the selected records to free up storage space.

### Use Case Diagram
![Data Storage Use Case Diagram](./images/Data_Storage.png)

***

## 3. Monitoring Dashboard
### Use Cases

**Use Case 8: View Real-Time Energy Dashboard**
* **Actor:** User (Includes Viewer, Manager, Admin)
* **TUCBW:** The User navigates to the "Energy Dashboard" tab from the main menu.
* **TUCEW:** The User sees interactive charts showing current energy draw and peak usage trends for their assigned buildings.

**Use Case 9: Compare Building Energy Usage**
* **Actor:** User (Includes Viewer, Manager, Admin)
* **TUCBW:** The User selects multiple buildings from the comparison menu and clicks "Compare".
* **TUCEW:** The system renders a side-by-side graphical comparison of the selected buildings.

**Use Case 10: Export Energy Report**
* **Actor:** User (Includes Viewer, Manager, Admin)
* **TUCBW:** The User selects a date range, filters for specific usage, and clicks "Export".
* **TUCEW:** The User successfully downloads a formatted report containing the requested charts and aggregate data.

### Use Case Diagram
![Monitoring Dashboard Diagram](./images/Monitoring_Dashboard.png)

***

## 4. Demand Forecasting
### Use Cases

**Use Case 11: View Energy Demand Forecast**
* **Actor:** User (Includes Manager, Admin)
* **TUCBW:** The User selects the "Demand Forecast" view for the upcoming 72 hours.
* **TUCEW:** The system displays the predicted energy load, incorporating weather and occupancy inputs.

**Use Case 12: Update Forecast Model**
* **Actor:** Admin
* **TUCBW:** The Admin uploads a newly trained, higher-accuracy machine learning prediction model.
* **TUCEW:** The system validates the model, hot-swaps it with the currently active version, and generates all future forecasts using the updated algorithm.

**Use Case 13: Delete Forecast Model**
* **Actor:** Admin
* **TUCBW:** The Admin selects a deprecated forecast model from the system repository and clicks "Delete."
* **TUCEW:** The system removes the model from the repository.

### Use Case Diagram
![Demand Forecasting Use Case Diagram](./images/Demand_Forecasting.png)

***

## 5. Optimisation Recommendations
### Use Cases

**Use Case 14: View Optimisation Recommendations**
* **Actor:** User (Includes Viewer, Manager, Admin)
* **TUCBW:** The User opens the "Insights" panel from the dashboard.
* **TUCEW:** The User views a high-level list of suggested load-shifting strategies.

**Use Case 15: Review Optimisation Recommendations**
* **Actor:** Manager, Admin
* **TUCBW:** The Manager or Admin clicks on a specific optimisation recommendation to evaluate its feasibility.
* **TUCEW:** The system displays detailed cost-saving estimates, allowing the user to approve or dismiss the insight.

**Use Case 16: Update Tariff Rates**
* **Actor:** Admin
* **TUCBW:** The Admin navigates to the billing settings and inputs the new seasonal Time-of-Use rates.
* **TUCEW:** The system recalculates all future optimisation cost-saving insights based on the newly entered rates.

### Use Case Diagram
![Optimisation Recommendations Use Case Diagram](./images/Optimisation_Recommendations.png)

***

## 6. Anomaly Detection
### Use Cases

**Use Case 17: Configure Alert Thresholds**
* **Actor:** User (Includes Manager, Admin)
* **TUCBW:** The User navigates to the Anomaly Settings panel and inputs a new percentage threshold for power spikes.
* **TUCEW:** The system saves the custom threshold and applies it to future real-time anomaly evaluations.

**Use Case 18: Suppress Alerts During Maintenance**
* **Actor:** User (Includes Manager, Admin)
* **TUCBW:** The User creates a "Maintenance Window" in the system calendar for an upcoming generator test.
* **TUCEW:** The system updates its rules to temporarily mute anomaly alerts for that specific building during the defined timeframe.

**Use Case 19: Manage Anomaly Alerts**
* **Actor:** Manager, Admin
* **TUCBW:** The Manager clicks the link provided in an automated anomaly SMS alert.
* **TUCEW:** The Manager marks the alert as "Investigating" and closes the ticket.

### Use Case Diagram
![Anomaly Detection Use Case Diagram](./images/Anamoly_Detection.png)

***

## 7. Administration
### Use Cases

**Use Case 20: Register**
* **Actor:** User
* **TUCBW:** A new User accesses the portal and completes the self-registration form.
* **TUCEW:** The system creates a preliminary profile pending Admin approval.

**Use Case 21: Login**
* **Actor:** User
* **TUCBW:** The User enters their credentials into the portal.
* **TUCEW:** The system authenticates the user and loads their role-specific dashboard.

**Use Case 22: Recover Account**
* **Actor:** User
* **TUCBW:** The User clicks "Forgot Password," enters their email, and submits the request.
* **TUCEW:** The User receives a secure recovery link via email and successfully updates their credentials.

**Use Case 23: View Building**
* **Actor:** User
* **TUCBW:** The User selects a building from the portfolio directory.
* **TUCEW:** The system loads the foundational metadata and status of that specific building.

**Use Case 24: Register Building**
* **Actor:** Admin
* **TUCBW:** The Admin clicks "Add Building" and submits the configuration form.
* **TUCEW:** The new building appears in the multi-tenant portfolio list.

**Use Case 25: Edit Building Details**
* **Actor:** Admin
* **TUCBW:** The Admin selects an existing building and updates its square footage or operating hours.
* **TUCEW:** The system saves the updated building configuration.

**Use Case 26: Delete Building**
* **Actor:** Admin
* **TUCBW:** The Admin selects a building and initiates the deletion process.
* **TUCEW:** The system removes the building and archives all associated historical data.

**Use Case 27: Delete User Account**
* **Actor:** Admin
* **TUCBW:** The Admin selects an active user profile and clicks "Deactivate/Delete."
* **TUCEW:** The system revokes the user's access tokens and removes their login capability.

**Use Case 28: Edit User Details**
* **Actor:** Admin
* **TUCBW:** The Admin modifies an existing user's contact information or department.
* **TUCEW:** The system saves the updated user profile.

**Use Case 29: Assign Role-Based Access**
* **Actor:** Admin
* **TUCBW:** The Admin selects a user, assigns a specific role (e.g., Viewer), and restricts their view to certain buildings.
* **TUCEW:** The system saves the permissions, ensuring the user can only access authorized data upon login.

**Use Case 30: View Audit Logs**
* **Actor:** Admin
* **TUCBW:** The Admin accesses the Security & Audit tab and filters the system logs.
* **TUCEW:** The system displays a chronological ledger of user logins and configuration modifications.

### Use Case Diagram
![Administration Use Case Diagram](./images/Administration.png)

***

## 4. Functional Requirements
Requirements to satisfy use cases

## 5. API Service Contracts
Swagger docs basically

## 6. Domain Model
Domain Model of system

## 7. Architectural Requirements
### 7.1 Quality Requirements
non-functional requirements essentially
### 7.2 Architectural Patterns
high level system with design
### 7.3 Design Patterns
design patterns used in the project
### 7.4 Constraints
Constraints for the project
### 7.5 Technology Requirements
Tech Stack

## 8. Traceability Matrix
mapping use cases and requirements