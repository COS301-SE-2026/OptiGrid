import { useState } from "react";


export default function AddBuildingPage() {
   const buildingTypes = ["Office", "Residential", "Industrial"];

  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");

  const handleSubmit = (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);

    const iotRaw = formData.get("iotDeviceIds");

    const data = {
      buildingName: formData.get("buildingName"),
      address: formData.get("address"),
      buildingType: formData.get("buildingType"),
      operatingHours: {
        start: startTime,
        end: endTime,
      },
      floorArea: formData.get("floorArea"),
      utilityTariff: formData.get("utilityTariff"),
      occupants: formData.get("occupants"),
    iotDeviceIds: formData.get("iotDeviceIds") || "",
    };

    console.log("Building Data:", data);

    alert("Building created successfully");

    e.target.reset();
}

}
