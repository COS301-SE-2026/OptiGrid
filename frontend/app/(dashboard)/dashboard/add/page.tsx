
"use client"


import { useState, useEffect } from "react";


export default function AddBuildingPage() {
   const buildingTypes = ["Office", "Residential", "Industrial"];

  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");



   useEffect(() => {
    const inter = document.createElement("link");
    inter.rel = "stylesheet";
    inter.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(inter);

    const spaceGrotesk = document.createElement("link");
    spaceGrotesk.rel = "stylesheet";
    spaceGrotesk.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap";
    document.head.appendChild(spaceGrotesk);
  }, []);

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

const headingFont = { fontFamily: "Space Grotesk, sans-serif" };
  const bodyFont = { fontFamily: "Inter, sans-serif" };

return (
    <div className="min-h-screen bg-[#EEF7FF] flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-[#CDE8E5] rounded-3xl shadow-2xl border border-[#7AB2B2] p-8">
        <div className="mb-8">
          <h1 style={headingFont} className="text-4xl font-bold text-[#16313A] mb-2">
            Create Building
          </h1>
          <p style={bodyFont} className="text-sm text-[#4D869C]">
            Add a new building
          </p>
        </div>

        <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2 md:col-span-2">
            <label style={bodyFont} className="text-sm text-[#4D869C]">
              Building Name
            </label>
            <input
              type="text"
              name="buildingName"
              required
              style={bodyFont}
              className="bg-[#EEF7FF] border border-[#7AB2B2] rounded-2xl px-4 py-3 text-[#16313A] outline-none focus:border-[#4D869C]"
            />
          </div>
<div className="flex flex-col gap-2 md:col-span-2">
            <label style={bodyFont} className="text-sm text-[#4D869C]">
              Address
            </label>
            <textarea
              name="address"
              rows={3}
              required
              style={bodyFont}
              className="bg-[#EEF7FF] border border-[#7AB2B2] rounded-2xl px-4 py-3 text-[#16313A] outline-none focus:border-[#4D869C] resize-none"
            />
          </div>

<div className="flex flex-col gap-2">
            <label style={bodyFont} className="text-sm text-[#4D869C]">
              Building Type
            </label>
            <select
              name="buildingType"
              required
              style={bodyFont}
              className="bg-[#EEF7FF] border border-[#7AB2B2] rounded-2xl px-4 py-3 text-[#16313A] outline-none focus:border-[#4D869C]"
            >
              <option value="">Select type</option>
              {buildingTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
 <div className="flex flex-col gap-3">
            <label style={bodyFont} className="text-sm text-[#4D869C]">
              Operating Hours
            </label>

            <div className="flex gap-3 items-center">
              <div className="flex-1 bg-[#EEF7FF] border border-[#7AB2B2] rounded-2xl px-4 py-3 flex items-center justify-between">
                <input
                  type="text"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="08:00"
                  style={bodyFont}
                  className="bg-transparent text-[#16313A] outline-none w-20"
                />
              </div>
              <div className="flex-1 bg-[#EEF7FF] border border-[#7AB2B2] rounded-2xl px-4 py-3 flex items-center justify-between">
                <input
                  type="text"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="18:00"
                  style={bodyFont}
                  className="bg-transparent text-[#16313A] outline-none w-20"
                />
              </div>
            </div>
          </div>

<div className="flex flex-col gap-2">
            <label style={bodyFont} className="text-sm text-[#4D869C]">
              Floor Area (m²)
            </label>
            <input
              type="text"
              name="floorArea"
              required
              style={bodyFont}
              className="bg-[#EEF7FF] border border-[#7AB2B2] rounded-2xl px-4 py-3 text-[#16313A] outline-none focus:border-[#4D869C]"
            />
          </div>
<div className="flex flex-col gap-2">
            <label style={bodyFont} className="text-sm text-[#4D869C]">
              Utility Tariff (R/kWh)
            </label>
            <input
              type="text"
              name="utilityTariff"
              required
              style={bodyFont}
              className="bg-[#EEF7FF] border border-[#7AB2B2] rounded-2xl px-4 py-3 text-[#16313A] outline-none focus:border-[#4D869C]"
            />
          </div>
<div className="flex flex-col gap-2">
            <label style={bodyFont} className="text-sm text-[#4D869C]">
              Number of Occupants
            </label>
            <input
              type="text"
              name="occupants"
              required
              style={bodyFont}
              className="bg-[#EEF7FF] border border-[#7AB2B2] rounded-2xl px-4 py-3 text-[#16313A] outline-none focus:border-[#4D869C]"
            />
          </div>

<div className="flex flex-col gap-2 md:col-span-2">
            <label style={bodyFont} className="text-sm text-[#4D869C]">
              IoT Device IDs (Optional)
            </label>
            <input
              type="text"
              name="iotDeviceIds"
              placeholder="device-001, device-002"
              style={bodyFont}
              className="bg-[#EEF7FF] border border-[#7AB2B2] rounded-2xl px-4 py-3 text-[#16313A] outline-none focus:border-[#4D869C]"
            />
          </div>
<div className="md:col-span-2 flex justify-end pt-4">
            <button
              type="submit"
              style={headingFont}
              className="bg-[#3A6B7C] hover:bg-[#2F5F70] text-white font-semibold px-8 py-3 rounded-2xl transition-all duration-300"
            >
              Create Building
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
