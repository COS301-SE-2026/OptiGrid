"use client";

import { useEffect, useState } from "react";

export default function DeleteBuildingPage() {
  useEffect(() => {
    const inter = document.createElement("link");
    inter.rel = "stylesheet";
    inter.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(inter);

    const space = document.createElement("link");
    space.rel = "stylesheet";
    space.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap";
    document.head.appendChild(space);
  }, []);

  const building_name = "Sandton HQ";

  const [confirmation, setConfirmation] = useState("");

  const headingFont = {
    fontFamily: "Space Grotesk, sans-serif",
  };

  const bodyFont = {
    fontFamily: "Inter, sans-serif",
  };

  const isMatch = confirmation === building_name;

  const handleDelete = () => {
    if (!isMatch) return;

    alert("Building permanently deleted");
  };

  return (
    <div className="min-h-screen bg-[#EEF7FF] flex items-center justify-center p-6">

      <div className="w-full max-w-xl bg-[#CDE8E5] border border-[#7AB2B2] rounded-3xl shadow-xl p-8">

        {/* Header */}
        <div className="mb-6">
          <h1
            style={headingFont}
            className="text-3xl font-bold text-[#3A6B7C]"
          >
            Delete Building
          </h1>

          <p
            style={bodyFont}
            className="text-[#4D869C] mt-3 leading-7"
          >
            This permanently removes the building and all of its
            historical energy data.
          </p>

          <p
            style={bodyFont}
            className="text-[#4D869C] mt-1"
          >
            This action cannot be undone.
          </p>
        </div>

        {/* Confirmation */}
        <div className="mb-8">

          <label
            style={bodyFont}
            className="block mb-3 text-[#4D869C]"
          >
            Type <span className="font-semibold">{building_name}</span> to confirm
          </label>

          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            style={bodyFont}
            className="w-full p-4 rounded-2xl bg-[#EEF7FF] border border-[#7AB2B2] outline-none text-[#3A6B7C]"
          />

        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">

          <button
            type="button"
            style={bodyFont}
            className="bg-[#7AB2B2] hover:bg-[#699d9d] text-white px-6 py-3 rounded-2xl transition-all duration-300"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!isMatch}
            onClick={handleDelete}
            style={headingFont}
            className={`px-8 py-3 rounded-2xl text-white transition-all duration-300 ${
              isMatch
                ? "bg-[#8B1E3F] hover:bg-[#741933]"
                : "bg-[#bfa7af] cursor-not-allowed"
            }`}
          >
            Delete Permanently
          </button>

        </div>

      </div>
    </div>
  );
}