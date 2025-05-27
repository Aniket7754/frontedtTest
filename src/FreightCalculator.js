import React, { useState } from "react";
import axios from 'axios';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Container3DView from "./Container3DView";

export default function FreightCalculator() {
    const [products, setProducts] = useState([{ productName: "", dimensions: { L: "", w: "", h: "" }, weight: "", quantity: 1, stackable: false, fragile: false }]);
    const [cbm, setCbm] = useState(0);
    const [totalWeight, setTotalWeight] = useState(0);
    const [suggestedContainer, setSuggestedContainer] = useState("");
    const [remainingSpace, setRemainingSpace] = useState(0);
    const [remainingWeight, setRemainingWeight] = useState(0);
    const [containerInfo, setContainerInfo] = useState({ type: "", cbm: 0, maxWeight: 0 });
    const [route, setRoute] = useState({ origin: "Nhava Sheva (JNPT)", destination: "Los Angeles" });
    const [selectedContainerType, setSelectedContainerType] = useState("");
    const [apiResponse, setApiResponse] = useState(null);


    const containerTypes = [
        {
            type: "20ft Standard Container",
            cbm: 28,
            maxWeight: 28000,
            image: "https://alfennzo-production.s3.ap-south-1.amazonaws.com/Support_Images/images%20%281%29.jfif"
        },
        {
            type: "40ft High Cube Container",
            cbm: 58,
            maxWeight: 26500,
            image: "https://alfennzo-production.s3.ap-south-1.amazonaws.com/Support_Images/images%20%282%29.jfif"
        },
        {
            type: "45ft High Cube Container",
            cbm: 76,
            maxWeight: 29000,
            image: "https://alfennzo-production.s3.ap-south-1.amazonaws.com/Support_Images/800px-Container_01_KMJ.jpg"
        }
    ];

    const getSelectedContainerDimensions = (type) => {
        switch (type) {
            case "20ft Standard Container":
                return { L: 589, W: 235, H: 239 };
            case "40ft High Cube Container":
                return { L: 1203, W: 235, H: 269 };
            case "45ft High Cube Container":
                return { L: 1355, W: 235, H: 269 };
            default:
                return { L: 589, W: 235, H: 239 };
        }
    };

    const addProduct = () => {
        setProducts([...products, { productName: "", dimensions: { L: "", w: "", h: "" }, weight: "", quantity: 1, stackable: false, fragile: false }]);
    };

    const removeProduct = (index) => {
        const newProducts = [...products];
        newProducts.splice(index, 1);
        setProducts(newProducts);
    };

    const handleChange = (index, field, value, subfield = null) => {
        const newProducts = [...products];
        if (subfield) {
            newProducts[index][field][subfield] = value.target.value;
        } else if (field === "stackable" || field === "fragile") {
            newProducts[index][field] = value.target.checked;
        } else {
            newProducts[index][field] = value.target.value;
        }
        setProducts(newProducts);
    };

    const calculateLoad = async () => {
        let totalCBM = 0;
        let totalW = 0;

        products.forEach((product) => {
            const l = parseFloat(product.dimensions.L);
            const w = parseFloat(product.dimensions.w);
            const h = parseFloat(product.dimensions.h);
            const weight = parseFloat(product.weight);
            const qty = parseInt(product.quantity);

            if (!isNaN(l) && !isNaN(w) && !isNaN(h) && !isNaN(weight) && !isNaN(qty)) {
                const productCBM = (l * w * h * qty) / 1000000;
                const productWeight = weight * qty;
                totalCBM += productCBM;
                totalW += productWeight;
            }
        });

        setCbm(totalCBM.toFixed(3));
        setTotalWeight(totalW.toFixed(1));

        const matched = containerTypes.find(c => totalCBM <= c.cbm && totalW <= c.maxWeight);

        if (matched) {
            setSuggestedContainer(matched.type);
            setRemainingSpace((matched.cbm - totalCBM).toFixed(2));
            setRemainingWeight((matched.maxWeight - totalW).toFixed(1));
            setContainerInfo(matched);
        } else {
            setSuggestedContainer("Exceeds standard container limits – split into multiple containers");
            setRemainingSpace(0);
            setRemainingWeight(0);
            setContainerInfo({ type: "", cbm: 0, maxWeight: 0 });
        }

        const formattedItems = products.map(p => ({
            productName: p.productName,
            dimensions: p.dimensions,
            weight: parseFloat(p.weight),
            quantity: parseInt(p.quantity),
            properties: p.stackable ? (p.fragile ? "stackable, fragila" : "stackable") : (p.fragile ? "fragila" : "")
        }));

        const outputData = {
            Items: formattedItems,
            containerweight: totalW.toFixed(1),
            originport: route.origin,
            destinationport: route.destination,
            containertype: selectedContainerType  // ✅ send container type
        };


        console.log("== Final Structured Output ==");
        console.log(outputData);

        // Send to API using try/catch
        try {
            const response = await axios.post("https://sandbox.alfennzo.com/api/v1/user/calculate", outputData);
            setApiResponse(response.data.data);
        } catch (error) {
            console.error("API Error:", error.response?.data || error.message);
            setApiResponse(null);
        }

    };
    const exportToCSV = () => {
        if (!apiResponse) return;

        const headers = [
            "Container Weight (kg)",
            "Total CBM",
            "Total Weight (kg)",
            "Remaining Weight (kg)",
            "Fuel Charge (₹)",
            "Port Fees (₹)",
            "Documentation Fees (₹)",
            "Total Charges (₹)"
        ];

        const values = [
            apiResponse.containerweight,
            apiResponse.totalCBM,
            apiResponse.totalWeight,
            apiResponse.remainingWeight,
            apiResponse.fuelCharge,
            apiResponse.portFees,
            apiResponse.documentationFees,
            apiResponse.totalCharges
        ];

        const csvContent =
            headers.join(",") + "\n" + values.join(",") + "\n\n" +
            "Items:\n" +
            "Product Name,L,W,H,Weight,Quantity,Properties\n" +
            apiResponse.items
                .map(item =>
                    `${item.productName},${item.dimensions.L},${item.dimensions.w},${item.dimensions.h},${item.weight},${item.quantity},${item.properties}`
                )
                .join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "freight_calculation.csv";
        link.click();
    };

    // Export PDF
    const exportToPDF = () => {
        if (!apiResponse) return;

        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text("Freight Calculation Summary", 14, 20);

        autoTable(doc, {
            head: [["Metric", "Value"]],
            body: [
                ["Container Weight (kg)", apiResponse.containerweight],
                ["Total CBM", apiResponse.totalCBM],
                ["Total Weight (kg)", apiResponse.totalWeight],
                ["Remaining Weight (kg)", apiResponse.remainingWeight],
                ["Fuel Charge (₹)", apiResponse.fuelCharge],
                ["Port Fees (₹)", apiResponse.portFees],
                ["Documentation Fees (₹)", apiResponse.documentationFees],
                ["Total Charges (₹)", apiResponse.totalCharges]
            ],
            startY: 30
        });

        autoTable(doc, {
            head: [["Product Name", "L", "W", "H", "Weight", "Qty", "Properties"]],
            body: apiResponse.items.map(item => ([
                item.productName,
                item.dimensions.L,
                item.dimensions.w,
                item.dimensions.h,
                item.weight,
                item.quantity,
                item.properties
            ])),
            startY: doc.lastAutoTable.finalY + 10
        });

        doc.save("freight_calculation.pdf");

    };
    return (
        <div className="min-h-screen bg-gray-100 py-10 px-4 md:px-20">
            <h1 className="text-3xl font-bold text-center mb-10">Sea Freight Load Calculator</h1>

            {/* Container Type Section */}
            <div className="bg-white rounded-xl shadow p-4 mb-6 border-t-4 border-blue-600">
                <h2 className="text-lg font-semibold mb-4">1. Select Container Type</h2>
                <div className="flex flex-wrap gap-6 justify-center">
                    {containerTypes.map((type, i) => (
                        <div
                            key={i}
                            onClick={() => setSelectedContainerType(type.type)}
                            className={`w-40 border-2 rounded-lg p-4 text-center hover:shadow cursor-pointer ${selectedContainerType === type.type ? "border-blue-500" : "border-gray-300"
                                }`}
                        >
                            <img
                                src={type.image}
                                alt={type.type}
                                className="mb-2 w-full h-20 object-contain"
                            />
                            <div className="text-sm font-medium">{type.type}</div>
                            <div className="text-xs text-gray-500">
                                {type.cbm} CBM / {type.maxWeight} kg max
                            </div>
                        </div>
                    ))}
                </div>

            </div>

            {/* Route Section */}
            <div className="bg-white rounded-xl shadow p-4 mb-6 border-t-4 border-blue-600">
                <h2 className="text-lg font-semibold mb-4">2. Enter Route Details</h2>
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <label className="block mb-1 font-medium">Origin Port</label>
                        <select className="w-full border rounded-md p-2" onChange={(e) => setRoute({ ...route, origin: e.target.value })}>
                            <option>Nhava Sheva (JNPT)</option>
                            <option>Mumbai</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block mb-1 font-medium">Destination Port</label>
                        <select className="w-full border border-red-500 rounded-md p-2" onChange={(e) => setRoute({ ...route, destination: e.target.value })}>
                            <option>Los Angeles</option>
                            <option>New York</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Cargo Section */}
            <div className="bg-white rounded-xl shadow p-4 mb-6 border-t-4 border-blue-600">
                <h2 className="text-lg font-semibold mb-4 text-blue-800">3. Enter Cargo Details</h2>

                {products.map((product, index) => (
                    <div
                        key={index}
                        className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end mb-4 border-b pb-4"
                    >
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium mb-1">Product Name</label>
                            <input
                                className="border p-2 rounded-md w-full"
                                placeholder="Name"
                                value={product.productName}
                                onChange={(e) => handleChange(index, "productName", e)}
                            />
                        </div>

                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium mb-1">Dimensions (cm)</label>
                            <div className="flex gap-2">
                                <input
                                    className="border p-2 rounded-md w-full"
                                    placeholder="L"
                                    value={product.dimensions.L}
                                    onChange={(e) => handleChange(index, "dimensions", e, "L")}
                                />
                                <input
                                    className="border p-2 rounded-md w-full"
                                    placeholder="W"
                                    value={product.dimensions.w}
                                    onChange={(e) => handleChange(index, "dimensions", e, "w")}
                                />
                                <input
                                    className="border p-2 rounded-md w-full"
                                    placeholder="H"
                                    value={product.dimensions.h}
                                    onChange={(e) => handleChange(index, "dimensions", e, "h")}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Weight (kg)</label>
                            <input
                                className="border p-2 rounded-md w-full"
                                placeholder="Weight"
                                value={product.weight}
                                onChange={(e) => handleChange(index, "weight", e)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Quantity</label>
                            <input
                                className="border p-2 rounded-md w-full"
                                type="number"
                                placeholder="1"
                                value={product.quantity}
                                onChange={(e) => handleChange(index, "quantity", e)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Properties</label>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm">
                                    <input
                                        type="checkbox"
                                        className="mr-1"
                                        checked={product.stackable}
                                        onChange={(e) => handleChange(index, "stackable", e)}
                                    />
                                    Stackable
                                </label>
                                <label className="text-sm">
                                    <input
                                        type="checkbox"
                                        className="mr-1"
                                        checked={product.fragile}
                                        onChange={(e) => handleChange(index, "fragile", e)}
                                    />
                                    Fragile
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end items-center h-full">
                            <button
                                className="bg-red-500 text-white px-2 py-1 rounded-md"
                                onClick={() => removeProduct(index)}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                ))}

                <div className="flex gap-4">
                    <button
                        className="bg-gray-700 text-white px-4 py-2 rounded-md"
                        onClick={addProduct}
                    >
                        + Add Product
                    </button>
                    <button
                        className="bg-blue-600 text-white px-4 py-2 rounded-md"
                        onClick={calculateLoad}
                    >
                        Calculate Load
                    </button>
                </div>
            </div>
            {selectedContainerType && (
                <div className="bg-white rounded-xl shadow p-4 my-6 border-t-4 border-blue-600">
                    <h2 className="text-lg font-semibold mb-4 text-blue-800">
                        4. 3D Container Visualization
                    </h2>
                    <Container3DView
                        products={products.map((p) => ({
                            ...p,
                            dimensions: {
                                L: parseFloat(p.dimensions.L),
                                w: parseFloat(p.dimensions.w),
                                h: parseFloat(p.dimensions.h),
                            },
                        }))}
                        containerDimensions={getSelectedContainerDimensions(selectedContainerType)}
                    />
                </div>
            )}

            {/* Optimization Result */}
            <div className="bg-white rounded-xl shadow p-4 border-t-4 border-green-600">
                <h2 className="text-lg font-semibold mb-4">Optimization Results</h2>
                <div className="bg-yellow-100 p-4 rounded-md mb-4">
                    <p className="text-sm font-semibold">Unpacked Items</p>
                    <ul className="text-xs text-gray-600 list-disc pl-5">
                        {products.map((product, i) => (
                            <li key={i}>{product.name} – {product.length}×{product.width}×{product.height}cm ({product.weight}kg) × {product.quantity}</li>
                        ))}
                    </ul>
                </div>
                {apiResponse && (
                    <div className="bg-white rounded-xl shadow p-6 border border-gray-300 mt-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Freight Charges ({route.origin} → {route.destination})</h2>

                        <div className="text-sm text-gray-700 mb-3">
                            <p><strong>Container Type:</strong> <span className="text-blue-600 font-semibold">{apiResponse.containertype}</span></p>
                            <p><strong>Total CBM:</strong> <span className="text-blue-600 font-semibold">{apiResponse.totalCBM}</span></p>
                            <p><strong>Total Weight:</strong> <span className="text-blue-600 font-semibold">{apiResponse.totalWeight} kg</span></p>
                        </div>


                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 text-left">
                                        <th className="px-4 py-2 border">Container Type</th>
                                        <th className="px-4 py-2 border">Count</th>
                                        <th className="px-4 py-2 border">Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {apiResponse.containers?.map((c, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 border">{c.type}</td>
                                            <td className="px-4 py-2 border">{c.count}</td>
                                            <td className="px-4 py-2 border">${parseFloat(c.price).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-50">
                                        <td className="px-4 py-2 border" colSpan={2}>Fuel Surcharge</td>
                                        <td className="px-4 py-2 border">${apiResponse.fuelCharge}</td>
                                    </tr>
                                    <tr className="bg-gray-50">
                                        <td className="px-4 py-2 border" colSpan={2}>Port Fees</td>
                                        <td className="px-4 py-2 border">${apiResponse.portFees}</td>
                                    </tr>
                                    <tr className="bg-gray-50">
                                        <td className="px-4 py-2 border" colSpan={2}>Documentation</td>
                                        <td className="px-4 py-2 border">${apiResponse.documentationFees}</td>
                                    </tr>
                                    <tr className="bg-gray-200 font-bold">
                                        <td className="px-4 py-2 border" colSpan={2}>Total Estimated Cost</td>
                                        <td className="px-4 py-2 border text-green-700">${apiResponse.totalCharges}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-6">
                            <h3 className="font-semibold text-gray-700 mb-2">Submitted Items</h3>
                            <ul className="text-sm text-gray-600 space-y-1 pl-4 list-disc">
                                {apiResponse.items.map((item, i) => (
                                    <li key={i}>
                                        {item.productName} — {item.dimensions.L}×{item.dimensions.w}×{item.dimensions.h}cm, {item.weight}kg × {item.quantity} ({item.properties})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}


                <p className="mt-2 text-sm">Estimated transit time: 14 days</p>

                <div className="mt-4 flex gap-2">
                    <button onClick={exportToPDF} className="bg-red-600 text-white px-4 py-2 rounded-md">
                        Export PDF
                    </button>
                    <button onClick={exportToCSV} className="bg-green-600 text-white px-4 py-2 rounded-md">
                        Export CSV
                    </button>
                </div>

            </div>
        </div>
    );
}
