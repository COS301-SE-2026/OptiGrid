"use client";

import { useState, useEffect } from "react";

export default function EditBuildingPage() {
  const buildingTypes = ["Residential", "Office", "Industrial"];

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

  const [formData, setFormData] = useState({
    building_name: "building A",
    building_type: "Office",
    physical_address: "123 Street, Pretoria",
    square_footage: "2500",
    max_occupancy: "120",
    operating_start: "08:00",
    operating_end: "18:00",
  });


   const headingFont = {
    fontFamily: "Space Grotesk, sans-serif",
  };

  const bodyFont = {
    fontFamily: "Inter, sans-serif",
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const data = {
      building_name: formData.building_name,
      building_type: formData.building_type,
      physical_address: formData.physical_address,
      square_footage: formData.square_footage,
      max_occupancy: formData.max_occupancy,
      operating_hours: {
        start: formData.operating_start,
        end: formData.operating_end,
      },
    };

    console.log("Updated Building:", data);

    alert("Building updated successfully!");
  };


  return (
    <div className="min-h-screen bg-[#EEF7FF] flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-[#CDE8E5] rounded-3xl shadow-xl border border-[#7AB2B2] p-8">

     
        <div className="mb-8">
          <h1
            style={headingFont}
            className="text-4xl font-bold text-[#4D869C]"
          >
            Edit Building
          </h1>

          <p
            style={bodyFont}
            className="text-[#4D869C] text-sm mt-2"
          >
            Update building information
          </p>
        </div>

        
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >

          
          <div className="md:col-span-2">
            <label
              style={bodyFont}
              className="block mb-2 text-[#4D869C]"
            >
              Building Name
            </label>

            <input
              type="text"
              name="building_name"
              value={formData.building_name}
              onChange={handleChange}
              style={bodyFont}
              className="w-full p-3 rounded-2xl bg-[#EEF7FF] border border-[#7AB2B2] outline-none"
            />
          </div>

          
          <div className="md:col-span-2">
            <label
              style={bodyFont}
              className="block mb-2 text-[#4D869C]"
            >
              Physical Address
            </label>

            <textarea
              name="physical_address"
              value={formData.physical_address}
              onChange={handleChange}
              rows={3}
              style={bodyFont}
              className="w-full p-3 rounded-2xl bg-[#EEF7FF] border border-[#7AB2B2] outline-none resize-none"
            />
          </div>

          
          <div>
            <label
              style={bodyFont}
              className="block mb-2 text-[#4D869C]"
            >
              Building Type
            </label>

            <select
              name="building_type"
              value={formData.building_type}
              onChange={handleChange}
              style={bodyFont}
              className="w-full p-3 rounded-2xl bg-[#EEF7FF] border border-[#7AB2B2] outline-none"
            >
              {buildingTypes.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              ))}
            </select>
          </div>



          
          <div>
            <label
              style={bodyFont}
              className="block mb-2 text-[#4D869C]"
            >
              Square Footage
            </label>

            <input
              type="text"
              name="square_footage"
              value={formData.square_footage}
              onChange={handleChange}
              style={bodyFont}
              className="w-full p-3 rounded-2xl bg-[#EEF7FF] border border-[#7AB2B2] outline-none"
            />
          </div>


          <div>
            <label
              style={bodyFont}
              className="block mb-2 text-[#4D869C]"
            >
              Max Occupancy
            </label>

            <input
              type="text"
              name="max_occupancy"
              value={formData.max_occupancy}
              onChange={handleChange}
              style={bodyFont}
              className="w-full p-3 rounded-2xl bg-[#EEF7FF] border border-[#7AB2B2] outline-none"
            />
          </div>


          <div className="md:col-span-2">
            <label
              style={bodyFont}
              className="block mb-2 text-[#4D869C]"
            >
              Operating Hours
            </label>

            <div className="flex gap-4">
              <input
                type="text"
                name="operating_start"
                value={formData.operating_start}
                onChange={handleChange}
                style={bodyFont}
                className="w-full p-3 rounded-2xl bg-[#EEF7FF] border border-[#7AB2B2] outline-none"
              />

              <input
                type="text"
                name="operating_end"
                value={formData.operating_end}
                onChange={handleChange}
                style={bodyFont}
                className="w-full p-3 rounded-2xl bg-[#EEF7FF] border border-[#7AB2B2] outline-none"
              />
            </div>
          </div>
<div className="md:col-span-2 flex justify-end gap-4 pt-4">

  <button
    type="button"
    style={bodyFont}
    className="bg-[#7AB2B2] hover:bg-[#699d9d] text-white px-6 py-3 rounded-2xl transition-all duration-300"
  >
    Cancel
  </button>

  <button
    type="submit"
    style={headingFont}
    className="bg-[#3A6B7C] hover:bg-[#2F5F70] text-white px-8 py-3 rounded-2xl transition-all duration-300"
  >
    Save Changes
  </button>

          </div>

        </form>
      </div>
    </div>
  );


}