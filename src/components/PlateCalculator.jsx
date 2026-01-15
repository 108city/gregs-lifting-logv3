import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PlateCalculator({ onClose }) {
    const [weight, setWeight] = useState("");
    const [barWeight, setBarWeight] = useState("20");
    const [results, setResults] = useState([]);

    const calculate = (targetVal, barVal) => {
        const target = parseFloat(targetVal);
        const bar = parseFloat(barVal);

        if (!target || isNaN(target) || isNaN(bar) || bar < 0) {
            setResults([]);
            return;
        }

        let remainder = (target - bar) / 2;

        if (remainder < 0) {
            setResults([]);
            return;
        }

        const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
        const needed = [];

        for (const p of plates) {
            const count = Math.floor(remainder / p);
            if (count > 0) {
                needed.push({ plate: p, count });
                remainder -= count * p;
                remainder = Math.round(remainder * 100) / 100; // avoid float errors
            }
        }
        setResults(needed);
    };

    const handleWeightChange = (e) => {
        setWeight(e.target.value);
    };

    const handleBarChange = (e) => {
        setBarWeight(e.target.value);
    };

    const onCalculateClick = () => {
        if (!weight) {
            alert("Please enter a target weight");
            return;
        }
        calculate(weight, barWeight);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            onCalculateClick();
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-[90%] max-w-sm shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Plate Calculator 🧮</h3>
                    <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400 hover:text-white">✕</Button>
                </div>

                <div className="space-y-4">
                    <div className="flex gap-4">
                        <div className="space-y-2 flex-1">
                            <Label>Target (kg)</Label>
                            <Input
                                type="number"
                                value={weight}
                                onChange={handleWeightChange}
                                onKeyDown={handleKeyDown}
                                placeholder="100"
                                autoFocus
                                className="text-lg py-6 bg-zinc-950 border-zinc-800"
                            />
                        </div>
                        <div className="space-y-2 w-24">
                            <Label>Bar (kg)</Label>
                            <Input
                                type="number"
                                value={barWeight}
                                onChange={handleBarChange}
                                onKeyDown={handleKeyDown}
                                placeholder="20"
                                className="text-lg py-6 bg-zinc-950 border-zinc-800"
                            />
                        </div>
                    </div>

                    <Button onClick={onCalculateClick} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-6">
                        Calculate
                    </Button>

                    <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 min-h-[150px] flex items-center justify-center">
                        {results.length > 0 ? (
                            <div className="w-full space-y-3">
                                <p className="text-center text-zinc-400 text-sm mb-2">Per Side:</p>
                                {results.map((r, i) => (
                                    <div key={i} className="flex justify-between items-center border-b border-zinc-800/50 pb-2 last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-blue-900/20">
                                                {r.count}
                                            </div>
                                            <span className="text-zinc-300">x</span>
                                            <span className="text-xl font-mono text-white">{r.plate}</span>
                                            <span className="text-xs text-zinc-500">kg</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-zinc-600">
                                {weight ? (parseFloat(weight) < parseFloat(barWeight) ? "Weight < Bar" : "Exact match or invalid") : "Enter weight to see plates"}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
