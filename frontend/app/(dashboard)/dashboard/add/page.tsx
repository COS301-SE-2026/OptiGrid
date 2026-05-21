
"use client"

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AddBuildingPage() {
  const router = useRouter();
  const buildingTypes = [
    { label: "Residential", value: "Residential" },
    { label: "Commercial", value: "Commercial" },
    { label: "Industrial", value: "Industrial" },
    { label: "Healthcare", value: "Healthcare" },
    { label: "Construction", value: "Construction" },
    { label: "Mixed Use", value: "Mixed_Use" },
    { label: "Shopping Centre", value: "ShoppingCentre" },
    { label: "Other", value: "Other" },
  ];

  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");

  const toPositiveNumberOrUndefined = (value: FormDataEntryValue | null) => {
    if (value === null) {
      return undefined;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return undefined;
    }

    return numericValue;
  };



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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formElement = (e.currentTarget || e.target) as HTMLFormElement;
    const formData = new FormData(formElement);

    const data = {
      building_name: formData.get("building_name"),
      physical_address: formData.get("physical_address"),
      building_type: formData.get("building_type"),
      square_footage: formData.get("square_footage"),
      max_occupancy: formData.get("max_occupancy"),
      operatingHours: { start: startTime, end: endTime },
    };

    console.log("Building Data:", data);
    alert("Building created successfully");

    const buildingPayload: Record<string, unknown> = {
      building_name: String(data.building_name || "").trim(),
      physical_address: String(data.physical_address || "").trim() || undefined,
      building_type: String(data.building_type || "") || undefined,
      square_footage: toPositiveNumberOrUndefined(formData.get("square_footage")),
      max_occupancy: toPositiveNumberOrUndefined(formData.get("max_occupancy")),
      timezone: "UTC",
    };
    Object.keys(buildingPayload).forEach((k) => buildingPayload[k] === undefined && delete buildingPayload[k]);
    const idempotencyKey = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    if (typeof fetch === "function") {
      fetch("/api/buildings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(buildingPayload),
        credentials: "include",
      })
        .then(async (resp) => {
          if (resp.ok) {
            window.alert("Building created successfully");
            formElement.reset();
            setStartTime('08:00');
            setEndTime('18:00');
            router.push('/dashboard');
            router.refresh();
          } 
          //error case
          else {
            const body = await resp.json().catch(() => ({}));
            const detailMessage =
              Array.isArray(body?.details) && body.details[0]?.message
                ? body.details[0].message
                : undefined;
            window.alert(`Error: ${detailMessage || body?.message || 'Failed to create building'}`);
          }
        })
        .catch(() => window.alert("Network error while creating building"));
    } else {
      console.error("Fetch Api did not work, may be unsupported in this browser");
      window.alert("System Error: Unable to create building");
    }
  };

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

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2 md:col-span-2">
            <label style={bodyFont} className="text-sm text-[#4D869C]">
              Building Name
            </label>
            <input
              type="text"
              name="building_name"
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
              name="physical_address"
              rows={3}
              required
              minLength={5}
              style={bodyFont}
              className="bg-[#EEF7FF] border border-[#7AB2B2] rounded-2xl px-4 py-3 text-[#16313A] outline-none focus:border-[#4D869C] resize-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label style={bodyFont} className="text-sm text-[#4D869C]">
              Building Type
            </label>
            <select
              name="building_type"
              required
              style={bodyFont}
              className="bg-[#EEF7FF] border border-[#7AB2B2] rounded-2xl px-4 py-3 text-[#16313A] outline-none focus:border-[#4D869C]"
              defaultValue=""
            >
              <option value="" disabled>Select building type</option>
              {buildingTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label style={bodyFont} className="text-sm text-[#4D869C]">
              Square Footage
            </label>
            <input
              type="text"
              name="square_footage"
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
              name="max_occupancy"
              style={bodyFont}
              className="bg-[#EEF7FF] border border-[#7AB2B2] rounded-2xl px-4 py-3 text-[#16313A] outline-none focus:border-[#4D869C]"
            />
          </div>

          <div className="flex flex-col gap-3 md:col-span-2">
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
              Square Footage
            </label>
            <input
              type="number"
              name="square_footage"
              required
              min={1}
              step={1}
              style={bodyFont}
              className="bg-[#EEF7FF] border border-[#7AB2B2] rounded-2xl px-4 py-3 text-[#16313A] outline-none focus:border-[#4D869C]"
            />
          </div>

<div className="flex flex-col gap-2">
            <label style={bodyFont} className="text-sm text-[#4D869C]">
              Number of Occupants
            </label>
            <input
              type="number"
              name="max_occupancy"
              required
              min={1}
              step={1}
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
