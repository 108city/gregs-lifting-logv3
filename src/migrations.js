
// Helper to safely get the list of migrations applied
function getApplied(db) {
    return Array.isArray(db?.migrationsApplied) ? db.migrationsApplied : [];
}

export function runMigrations(db) {
    if (!db) return null;

    let changed = false;
    let newDb = { ...db };
    const applied = new Set(getApplied(newDb));

    // --- MIGRATION: Merge Duplicates (v1) ---
    const MIGRATION_KEY = "merge-duplicates-v1";
    if (!applied.has(MIGRATION_KEY)) {
        console.log(`[Migrations] Running ${MIGRATION_KEY}...`);

        // 1. Define transformation rules
        // Source Name -> { targetName, targetCategory }
        const MERGES = {
            "Face Pulls": { targetName: "Face Pull", category: "Back" },
            "DB Benchpress": { targetName: "Bench Press", category: "Chest" },
            "Lateral Raise": { targetName: "Lateral Raises", category: "Shoulders" },
            // While we are at it, ensure targets have correct categories immediately
            "Face Pull": { targetName: "Face Pull", category: "Back" },
            "Bench Press": { targetName: "Bench Press", category: "Chest" },
            "Lateral Raises": { targetName: "Lateral Raises", category: "Shoulders" },
        };

        // 2. Update Log Entries
        if (Array.isArray(newDb.log)) {
            newDb.log = newDb.log.map(workout => {
                let workoutChanged = false;
                const newEntries = (workout.entries || []).map(entry => {
                    const rule = MERGES[entry.exerciseName];
                    if (rule) {
                        if (entry.exerciseName !== rule.targetName) {
                            workoutChanged = true;
                            return { ...entry, exerciseName: rule.targetName };
                        }
                    }
                    return entry;
                });

                if (workoutChanged) {
                    return { ...workout, entries: newEntries };
                }
                return workout;
            });
        }

        // 3. Update Exercises List
        // We need to:
        // a) Remove the "Source" exercises if they are truly different entries
        // b) Update the "Target" exercises with the correct category
        if (Array.isArray(newDb.exercises)) {
            const sourcesToRemove = new Set(["Face Pulls", "DB Benchpress", "Lateral Raise"]);

            newDb.exercises = newDb.exercises.filter(ex => !sourcesToRemove.has(ex.name));

            // Now update categories for targets
            newDb.exercises = newDb.exercises.map(ex => {
                const rule = MERGES[ex.name]; // e.g. "Bench Press" -> { category: "Chest" }
                if (rule && rule.category) {
                    return { ...ex, category: rule.category };
                }
                return ex;
            });

            // Ensure targets exist if they were ONLY present as sources? 
            // (The user implies targets likely exist, but if "DB Benchpress" was the ONLY one, we renamed the log, 
            // but we might have deleted the only exercise definition if we aren't careful.
            // However, since we renamed the logs, the app will likely work, but "Bench Press" might be missing from exercises list if it wasn't there before.
            // Let's safe-add them if missing.)

            const existingNames = new Set(newDb.exercises.map(e => e.name));
            const targetsNeeded = [
                { name: "Face Pull", category: "Back" },
                { name: "Bench Press", category: "Chest" },
                { name: "Lateral Raises", category: "Shoulders" }
            ];

            targetsNeeded.forEach(t => {
                if (!existingNames.has(t.name)) {
                    newDb.exercises.push({ id: Date.now() + Math.random(), name: t.name, category: t.category });
                }
            });
        }

        applied.add(MIGRATION_KEY);
        newDb.migrationsApplied = Array.from(applied);
        changed = true;
        console.log(`[Migrations] ${MIGRATION_KEY} complete.`);
    }

    // --- MIGRATION: Robust Merging (v2) ---
    const V2_KEY = "merge-duplicates-v2";
    if (!applied.has(V2_KEY)) {
        console.log(`[Migrations] Running ${V2_KEY}...`);

        // Normalization Map (lowercase source -> { targetName, category })
        const NORM_MAP = {
            "face pull": { name: "Face Pull", cat: "Back" },
            "face pulls": { name: "Face Pull", cat: "Back" },
            "lateral raise": { name: "Lateral Raises", cat: "Shoulders" },
            "lateral raises": { name: "Lateral Raises", cat: "Shoulders" },
            "db benchpress": { name: "Bench Press", cat: "Chest" },
            "db bench press": { name: "Bench Press", cat: "Chest" },
            "bench press": { name: "Bench Press", cat: "Chest" },
        };

        // 1. Update Logs
        if (Array.isArray(newDb.log)) {
            newDb.log = newDb.log.map(workout => {
                let workoutChanged = false;
                const newEntries = (workout.entries || []).map(entry => {
                    const lower = entry.exerciseName.toLowerCase().trim();
                    const rule = NORM_MAP[lower];
                    if (rule && entry.exerciseName !== rule.name) {
                        workoutChanged = true;
                        return { ...entry, exerciseName: rule.name };
                    }
                    return entry;
                });
                return workoutChanged ? { ...workout, entries: newEntries } : workout;
            });
        }

        // 2. Cleanup & Standardize Exercises List
        if (Array.isArray(newDb.exercises)) {
            // Create a set of "Source" names to delete (the ones that AREN'T the target names)
            const targets = new Set(["Face Pull", "Bench Press", "Lateral Raises"]);
            const sourcesToDelete = new Set(["face pulls", "face pull", "lateral raise", "lateral raises", "db benchpress", "db bench press", "bench press"]);

            // Filter out anything that matches our sources UNLESS it is the exact target name we want to keep
            newDb.exercises = newDb.exercises.filter(ex => {
                const lower = ex.name.toLowerCase().trim();
                if (sourcesToDelete.has(lower) && !targets.has(ex.name)) return false;
                return true;
            });

            // Update categories for targets
            newDb.exercises = newDb.exercises.map(ex => {
                const lower = ex.name.toLowerCase().trim();
                const rule = NORM_MAP[lower];
                if (rule && targets.has(ex.name)) {
                    return { ...ex, category: rule.cat };
                }
                return ex;
            });

            // Ensure they exist
            const existing = new Set(newDb.exercises.map(e => e.name));
            [
                { name: "Face Pull", cat: "Back" },
                { name: "Bench Press", cat: "Chest" },
                { name: "Lateral Raises", cat: "Shoulders" }
            ].forEach(t => {
                if (!existing.has(t.name)) {
                    newDb.exercises.push({ id: Date.now() + Math.random(), name: t.name, category: t.cat });
                }
            });
        }

        applied.add(V2_KEY);
        newDb.migrationsApplied = Array.from(applied);
        changed = true;
        console.log(`[Migrations] ${V2_KEY} complete.`);
    }

    // --- MIGRATION: More Robust Merging (v3) ---
    const V3_KEY = "merge-duplicates-v3";
    if (!applied.has(V3_KEY)) {
        console.log(`[Migrations] Running ${V3_KEY}...`);

        const NORM_MAP_V3 = {
            "back squat": { name: "Squat", cat: "Legs" },
            "squat": { name: "Squat", cat: "Legs" },
            "low row": { name: "Row", cat: "Back" },
            "row": { name: "Row", cat: "Back" },
        };

        // 1. Update Logs
        if (Array.isArray(newDb.log)) {
            newDb.log = newDb.log.map(workout => {
                let workoutChanged = false;
                const newEntries = (workout.entries || []).map(entry => {
                    const lower = entry.exerciseName.toLowerCase().trim();
                    const rule = NORM_MAP_V3[lower];
                    if (rule && entry.exerciseName !== rule.name) {
                        workoutChanged = true;
                        return { ...entry, exerciseName: rule.name };
                    }
                    return entry;
                });
                return workoutChanged ? { ...workout, entries: newEntries } : workout;
            });
        }

        // 2. Cleanup & Standardize Exercises List
        if (Array.isArray(newDb.exercises)) {
            const targets = new Set(["Squat", "Row"]);
            const sourcesToDelete = new Set(["back squat", "squat", "low row", "row"]);

            newDb.exercises = newDb.exercises.filter(ex => {
                const lower = ex.name.toLowerCase().trim();
                if (sourcesToDelete.has(lower) && !targets.has(ex.name)) return false;
                return true;
            });

            newDb.exercises = newDb.exercises.map(ex => {
                const lower = ex.name.toLowerCase().trim();
                const rule = NORM_MAP_V3[lower];
                if (rule && targets.has(ex.name)) {
                    return { ...ex, category: rule.cat };
                }
                return ex;
            });

            const existing = new Set(newDb.exercises.map(e => e.name));
            [
                { name: "Squat", cat: "Legs" },
                { name: "Row", cat: "Back" }
            ].forEach(t => {
                if (!existing.has(t.name)) {
                    newDb.exercises.push({ id: Date.now() + Math.random(), name: t.name, category: t.cat });
                }
            });
        }

        applied.add(V3_KEY);
        newDb.migrationsApplied = Array.from(applied);
        changed = true;
        console.log(`[Migrations] ${V3_KEY} complete.`);
    }

    // --- MIGRATION: Aggressive Deduplication (v4) ---
    const V4_KEY = "exercise-dedupe-v4";
    if (!applied.has(V4_KEY)) {
        console.log(`[Migrations] Running ${V4_KEY}...`);

        if (Array.isArray(newDb.exercises)) {
            const seen = new Map(); // normalizedName -> fullExerciseObject
            const deduplicated = [];

            // Preferred names (targets we want to keep)
            const targets = new Set(["Squat", "Row", "Face Pull", "Bench Press", "Lateral Raises"]);

            newDb.exercises.forEach(ex => {
                if (!ex.name) return;
                const lower = ex.name.toLowerCase().trim();

                if (!seen.has(lower)) {
                    seen.set(lower, ex);
                } else {
                    // We already saw this name variation. Should we swap it?
                    // If the current one is an exact target name and the seen one isn't, swap.
                    const currentSeen = seen.get(lower);
                    if (targets.has(ex.name) && !targets.has(currentSeen.name)) {
                        seen.set(lower, ex);
                    }
                }
            });
            newDb.exercises = Array.from(seen.values());
            applied.add(V4_KEY);
            newDb.migrationsApplied = Array.from(applied);
            changed = true;
        }
    }

    // --- MIGRATION: Robust "Row" & "Squat" Fix (v7) ---
    const V7_KEY = "definitive-merge-v7";
    if (!applied.has(V7_KEY)) {
        console.log(`[Migrations] Running ${V7_KEY}...`);

        // Helper to normalize strings for comparison (strip non-alpha, lowercase)
        const ultraNormalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

        const CANONICAL_MAP = {
            [ultraNormalize("face pull")]: "Face Pull",
            [ultraNormalize("face pulls")]: "Face Pull",
            [ultraNormalize("facepull")]: "Face Pull",
            [ultraNormalize("lateral raise")]: "Lateral Raises",
            [ultraNormalize("lateral raises")]: "Lateral Raises",
            [ultraNormalize("lateralraise")]: "Lateral Raises",
            [ultraNormalize("db benchpress")]: "Bench Press",
            [ultraNormalize("db bench press")]: "Bench Press",
            [ultraNormalize("bench press")]: "Bench Press",
            [ultraNormalize("benchpress")]: "Bench Press",
            [ultraNormalize("back squat")]: "Squat",
            [ultraNormalize("back squats")]: "Squat",
            [ultraNormalize("squat")]: "Squat",
            [ultraNormalize("squats")]: "Squat",
            [ultraNormalize("low row")]: "Row",
            [ultraNormalize("low rows")]: "Row",
            [ultraNormalize("row")]: "Row",
            [ultraNormalize("rows")]: "Row"
        };

        const CANONICAL_CATS = {
            "Face Pull": "Back",
            "Lateral Raises": "Shoulders",
            "Bench Press": "Chest",
            "Squat": "Legs",
            "Row": "Back"
        };

        // 1. Update Logs
        if (Array.isArray(newDb.log)) {
            newDb.log = newDb.log.map(workout => {
                let workoutChanged = false;
                const newEntries = (workout.entries || []).map(entry => {
                    const norm = ultraNormalize(entry.exerciseName);
                    const targetName = CANONICAL_MAP[norm];
                    if (targetName && entry.exerciseName !== targetName) {
                        workoutChanged = true;
                        return { ...entry, exerciseName: targetName };
                    }
                    return entry;
                });
                return workoutChanged ? { ...workout, entries: newEntries } : workout;
            });
        }

        // 2. Standardize Exercises List
        if (Array.isArray(newDb.exercises)) {
            const seenNorms = new Set();
            const cleanedExercises = [];

            // Sort so we process exact canonical names first (preferring them)
            const sortedToProcess = [...newDb.exercises].sort((a, b) => {
                const aTarget = CANONICAL_MAP[ultraNormalize(a.name)];
                const bTarget = CANONICAL_MAP[ultraNormalize(b.name)];
                if (a.name === aTarget && b.name !== bTarget) return -1;
                if (b.name === bTarget && a.name !== aTarget) return 1;
                return 0;
            });

            sortedToProcess.forEach(ex => {
                const norm = ultraNormalize(ex.name);
                const targetName = CANONICAL_MAP[norm] || ex.name;
                const finalNorm = ultraNormalize(targetName);

                if (!seenNorms.has(finalNorm)) {
                    seenNorms.add(finalNorm);
                    // Update the exercise itself if it's a variation
                    if (CANONICAL_MAP[norm]) {
                        cleanedExercises.push({
                            ...ex,
                            name: targetName,
                            category: CANONICAL_CATS[targetName] || ex.category
                        });
                    } else {
                        cleanedExercises.push(ex);
                    }
                }
            });

            newDb.exercises = cleanedExercises;

            // Ensure all targets exist
            const currentExNames = new Set(newDb.exercises.map(e => e.name));
            Object.entries(CANONICAL_CATS).forEach(([name, cat]) => {
                if (!currentExNames.has(name)) {
                    newDb.exercises.push({
                        id: Date.now() + Math.random(),
                        name,
                        category: cat,
                        updatedAt: new Date().toISOString()
                    });
                }
            });
        }

        applied.add(V7_KEY);
        newDb.migrationsApplied = Array.from(applied);
        changed = true;
        console.log(`[Migrations] ${V7_KEY} complete.`);
    }

    return changed ? newDb : null;
}
