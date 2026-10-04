// mcp/server.js
//
// The Lifting Log MCP server: tools that let Claude read and edit Greg's
// lifting-log data (exercises, programs/templates, workout log, local
// schedule entries). Transport-agnostic — api/mcp/*.js wires it to HTTP.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ToolError, genId, assertDate, todayIso, norm,
  findExercise, resolveExercise, resolveExercises, resolveProgram, findDay, resolveDay,
  activateProgram, buildItems, summarizeDay, summarizeProgram, summarizeWorkout,
} from "./model.js";

const INSTRUCTIONS = `This server edits Greg's Lifting Log — his personal workout-tracking app.

Data model:
- exercises: the exercise database (name + category). Programs and workouts reference these.
- programs: lifting programs. Each has dated start/end, and days (templates such as "Upper A" or "Day 2 — Lower") that list exercises with sets, reps, rest, per-side and superset grouping. Exactly one program is active; the app's Log tab trains from it.
- workout log: completed sessions with sets of reps × kg.
- schedule entries: optional local overrides on the Schedule tab.

Rules:
- The dated training plan (runs, classes, rest days, which lift on which date) lives in BodyOS, not here. Use the BodyOS connector (save_training_plan, update_workout_status) for that. A local schedule entry set here overrides BodyOS for that date — use it only for one-off fixes such as marking a day missed.
- Exercise names must match the exercise database. If a lift isn't there, tell the user and ask before calling create_exercise — don't add exercises silently.
- Weights are kg. When perSide is true, reps are per side.
- Never delete a workout or schedule entry without the user's explicit confirmation.
- Changes appear in the app the next time it's opened or brought to the foreground.`;

const ok = (obj) => ({
  content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }],
});
const fail = (msg) => ({ content: [{ type: "text", text: msg }], isError: true });

/** Wrap a handler: ToolErrors become readable tool errors; others are logged. */
const guard = (fn) => async (args) => {
  try {
    return ok(await fn(args));
  } catch (e) {
    if (e instanceof ToolError) return fail(e.message);
    console.error("[lifting-mcp]", e);
    return fail(`Unexpected error: ${e?.message || e}`);
  }
};

const READ = { readOnlyHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

const date = z.string().describe("YYYY-MM-DD");
const itemSchema = z.object({
  exercise: z.string().describe("Exercise name exactly as in the exercise database"),
  sets: z.number().int().min(1).max(20),
  reps: z.union([z.number().int(), z.string()]).describe('Whole number (8) or a range ("6-8")'),
  rest: z.union([z.number(), z.string()]).optional().describe('Rest — seconds (90) or "2 min". Default 90s'),
  perSide: z.boolean().optional().describe("Reps are per side / each arm or leg"),
  superset: z.string().optional().describe('Same label on consecutive exercises groups them as a superset (e.g. "A")'),
  note: z.string().optional().describe("Coaching cue shown under the exercise"),
});

export function buildServer({ store, pushWorkout = null }) {
  const server = new McpServer(
    { name: "lifting-log", version: "1.0.0" },
    { instructions: INSTRUCTIONS }
  );
  const tool = (name, config, handler) => server.registerTool(name, config, guard(handler));

  /* ─────────────────────────── read ─────────────────────────── */

  tool("get_overview", {
    title: "Lifting log overview",
    description: "Start here. Today's date, the active program and its days, counts, and the most recent workouts.",
    inputSchema: {},
    annotations: READ,
  }, async () => {
    const data = await store.read();
    const active = (data.programs || []).find((p) => p.id === data.activeProgramId);
    const done = (data.log || []).filter((w) => w.completed !== false)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return {
      today: todayIso(),
      activeProgram: active ? summarizeProgram(active, data) : null,
      counts: {
        programs: (data.programs || []).length,
        exercises: (data.exercises || []).length,
        workoutsLogged: done.length,
        scheduleEntries: (data.schedule || []).length,
      },
      recentWorkouts: done.slice(0, 5).map((w) => summarizeWorkout(w, data)),
    };
  });

  tool("list_programs", {
    title: "List programs",
    description: "All lifting programs with dates, which one is active, and their day names.",
    inputSchema: {},
    annotations: READ,
  }, async () => {
    const data = await store.read();
    return (data.programs || []).map((p) => summarizeProgram(p, data));
  });

  tool("get_program", {
    title: "Get a program",
    description: "Full detail of a program: every day with its exercises, sets, reps, rest, supersets and notes. Defaults to the active program.",
    inputSchema: { program: z.string().optional().describe("Program name or id; omit for the active program") },
    annotations: READ,
  }, async ({ program }) => {
    const data = await store.read();
    return summarizeProgram(resolveProgram(data, program), data, { full: true });
  });

  tool("list_exercises", {
    title: "List exercises",
    description: "The exercise database, optionally filtered by category (Chest, Back, Legs, Shoulders, Arms…) or a search term.",
    inputSchema: {
      category: z.string().optional(),
      search: z.string().optional().describe("Substring match on the name"),
    },
    annotations: READ,
  }, async ({ category, search }) => {
    const data = await store.read();
    return (data.exercises || [])
      .filter((e) => !category || norm(e.category) === norm(category))
      .filter((e) => !search || norm(e.name).includes(norm(search)))
      .sort((a, b) => (a.category || "").localeCompare(b.category || "") || a.name.localeCompare(b.name))
      .map((e) => ({ name: e.name, category: e.category }));
  });

  tool("list_workouts", {
    title: "List logged workouts",
    description: "Logged workouts, newest first, with every set. Excludes unfinished drafts unless asked.",
    inputSchema: {
      from: date.optional(),
      to: date.optional(),
      limit: z.number().int().min(1).max(100).optional().describe("Default 10"),
      includeIncomplete: z.boolean().optional().describe("Include in-progress drafts that never hit End Workout"),
    },
    annotations: READ,
  }, async ({ from, to, limit = 10, includeIncomplete = false }) => {
    if (from) assertDate(from, "from");
    if (to) assertDate(to, "to");
    const data = await store.read();
    return (data.log || [])
      .filter((w) => includeIncomplete || w.completed !== false)
      .filter((w) => (!from || w.date >= from) && (!to || w.date <= to))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, limit)
      .map((w) => summarizeWorkout(w, data, { full: true }));
  });

  tool("exercise_history", {
    title: "Exercise history",
    description: "Every logged session of one exercise: sets, top weight and volume per session, newest first. Use for progression questions.",
    inputSchema: {
      exercise: z.string(),
      limit: z.number().int().min(1).max(100).optional().describe("Default 10"),
    },
    annotations: READ,
  }, async ({ exercise, limit = 10 }) => {
    const data = await store.read();
    const ex = resolveExercise(data, exercise);
    const sessions = [];
    for (const w of data.log || []) {
      if (w.completed === false) continue;
      for (const e of w.entries || []) {
        if (e.exerciseId !== ex.id && norm(e.exerciseName) !== norm(ex.name)) continue;
        const sets = e.sets || [];
        sessions.push({
          date: w.date,
          sets: sets.map((s) => `${s.reps}×${s.kg}kg`).join(", "),
          topKg: Math.max(0, ...sets.map((s) => Number(s.kg) || 0)),
          volumeKg: sets.reduce((v, s) => v + (Number(s.reps) || 0) * (Number(s.kg) || 0), 0),
          ...(e.rating ? { rating: e.rating } : {}),
        });
      }
    }
    sessions.sort((a, b) => b.date.localeCompare(a.date));
    return { exercise: ex.name, category: ex.category, sessions: sessions.slice(0, limit) };
  });

  tool("list_schedule_entries", {
    title: "List local schedule entries",
    description: "Local schedule overrides (not the BodyOS plan — use the BodyOS connector for that), with whether each is ticked done.",
    inputSchema: { from: date.optional(), to: date.optional() },
    annotations: READ,
  }, async ({ from, to }) => {
    const data = await store.read();
    const ticks = data.planTicks || {};
    return (data.schedule || [])
      .filter((e) => (!from || e.date >= from) && (!to || e.date <= to))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({
        date: e.date, type: e.type, name: e.name,
        ...(e.notes ? { notes: e.notes } : {}),
        status: ticks[e.id] ? "completed" : e.status || "planned",
      }));
  });

  /* ─────────────────────────── write ─────────────────────────── */

  tool("create_exercise", {
    title: "Create exercise",
    description: "Add an exercise to the database. Ask the user first. Returns the existing one if the name is already taken.",
    inputSchema: {
      name: z.string().min(1),
      category: z.string().min(1).describe("Chest, Back, Legs, Shoulders, Arms, Core…"),
    },
    annotations: WRITE,
  }, async ({ name, category }) => store.mutate((data) => {
    const existing = findExercise(data, name);
    if (existing) return { created: false, exercise: { name: existing.name, category: existing.category } };
    data.exercises = data.exercises || [];
    data.exercises.push({ id: genId(), name: name.trim(), category: category.trim(), updatedAt: new Date().toISOString() });
    return { created: true, exercise: { name: name.trim(), category: category.trim() } };
  }));

  tool("create_program", {
    title: "Create program",
    description: "Create a lifting program with its day templates. By default it becomes the active program and the previous one is end-dated (archived, not deleted). Fails, listing closest matches, if any exercise isn't in the database.",
    inputSchema: {
      name: z.string().min(1),
      startDate: date,
      endDate: date.optional(),
      note: z.string().optional(),
      days: z.array(z.object({ name: z.string().min(1), items: z.array(itemSchema).min(1) })).min(1),
      setActive: z.boolean().optional().describe("Default true"),
    },
    annotations: WRITE,
  }, async ({ name, startDate, endDate, note, days, setActive = true }) => {
    assertDate(startDate, "startDate");
    if (endDate) assertDate(endDate, "endDate");
    return store.mutate((data) => {
      if ((data.programs || []).some((p) => norm(p.name) === norm(name))) {
        throw new ToolError(`A program named "${name}" already exists. Use set_program_day or update_program to change it.`);
      }
      // Resolve every exercise up front so all unknowns are reported together.
      resolveExercises(data, days.flatMap((d) => d.items.map((i) => i.exercise)));
      const program = {
        id: genId(), name: name.trim(), startDate,
        ...(endDate ? { endDate } : {}),
        ...(note ? { note } : {}),
        days: days.map((d) => ({ id: genId(), name: d.name.trim(), items: buildItems(data, d.items) })),
        updatedAt: new Date().toISOString(),
      };
      data.programs = [...(data.programs || []), program];
      const previous = setActive ? activateProgram(data, program.id) : null;
      return {
        created: summarizeProgram(program, data, { full: true }),
        ...(previous ? { previousActiveEnded: { name: previous.name, endDate: previous.endDate } } : {}),
      };
    });
  });

  tool("set_program_day", {
    title: "Set a program day",
    description: "Replace the exercises of one day in a program (creates the day if it doesn't exist). Optionally rename it.",
    inputSchema: {
      program: z.string().optional().describe("Program name or id; omit for the active program"),
      day: z.string().describe('Day name, e.g. "Upper A"'),
      items: z.array(itemSchema).min(1),
      rename: z.string().optional(),
    },
    annotations: WRITE,
  }, async ({ program, day, items, rename }) => store.mutate((data) => {
    const p = resolveProgram(data, program);
    const built = buildItems(data, items);
    let d = findDay(p, day);
    const created = !d;
    if (!d) { d = { id: genId(), name: day.trim(), items: [] }; p.days = [...(p.days || []), d]; }
    d.items = built;
    if (rename) d.name = rename.trim();
    p.updatedAt = new Date().toISOString();
    return { program: p.name, dayCreated: created, day: summarizeDay(d) };
  }));

  tool("swap_exercise", {
    title: "Swap an exercise",
    description: "Replace one exercise with another in a program, keeping sets, reps, rest and superset pairing. Applies to every day unless a day is given. Existing notes are kept — check them in the result and fix with set_program_day if they no longer fit.",
    inputSchema: {
      program: z.string().optional().describe("Program name or id; omit for the active program"),
      day: z.string().optional().describe("Limit to this day"),
      from: z.string().describe("Exercise currently in the program"),
      to: z.string().describe("Replacement — must be in the exercise database"),
    },
    annotations: WRITE,
  }, async ({ program, day, from, to }) => store.mutate((data) => {
    const p = resolveProgram(data, program);
    const fromEx = findExercise(data, from);
    const toEx = resolveExercise(data, to);
    const days = day ? [resolveDay(p, day)] : p.days || [];
    const changed = [];
    for (const d of days) {
      for (const it of d.items || []) {
        const hit = (fromEx && it.exerciseId === fromEx.id) || norm(it.name) === norm(from);
        if (!hit) continue;
        it.exerciseId = toEx.id;
        it.name = toEx.name;
        changed.push({ day: d.name, sets: it.sets, reps: it.reps, ...(it.note ? { noteKept: it.note } : {}) });
      }
    }
    if (!changed.length) {
      const where = day ? `day "${day}"` : `"${p.name}"`;
      const present = [...new Set(days.flatMap((d) => (d.items || []).map((i) => i.name)))];
      throw new ToolError(`"${from}" isn't in ${where}. Exercises there: ${present.join(", ")}.`);
    }
    p.updatedAt = new Date().toISOString();
    return { program: p.name, from, to: toEx.name, changed };
  }));

  tool("update_program", {
    title: "Update program details",
    description: "Change a program's name, start/end date or note. Pass endDate: null to clear it.",
    inputSchema: {
      program: z.string().optional().describe("Program name or id; omit for the active program"),
      name: z.string().optional(),
      startDate: date.optional(),
      endDate: date.nullable().optional(),
      note: z.string().optional(),
    },
    annotations: WRITE,
  }, async ({ program, name, startDate, endDate, note }) => store.mutate((data) => {
    const p = resolveProgram(data, program);
    if (name) {
      if ((data.programs || []).some((x) => x.id !== p.id && norm(x.name) === norm(name))) {
        throw new ToolError(`Another program is already named "${name}".`);
      }
      p.name = name.trim();
    }
    if (startDate) p.startDate = assertDate(startDate, "startDate");
    if (endDate === null) delete p.endDate;
    else if (endDate) p.endDate = assertDate(endDate, "endDate");
    if (note !== undefined) p.note = note;
    p.updatedAt = new Date().toISOString();
    return summarizeProgram(p, data);
  }));

  tool("set_active_program", {
    title: "Set active program",
    description: "Make a program the one the Log tab trains from. The previously active program is end-dated (archived, not deleted).",
    inputSchema: { program: z.string().describe("Program name or id") },
    annotations: WRITE,
  }, async ({ program }) => store.mutate((data) => {
    const p = resolveProgram(data, program);
    if (data.activeProgramId === p.id) return { alreadyActive: p.name };
    const previous = activateProgram(data, p.id);
    return {
      active: summarizeProgram(p, data),
      ...(previous ? { previousActiveEnded: { name: previous.name, endDate: previous.endDate } } : {}),
    };
  }));

  tool("log_workout", {
    title: "Log a workout",
    description: "Record a lifting session (e.g. one the user forgot to log). Replaces an existing entry with the same id, or the same date + program day, instead of duplicating. Completed workouts are mirrored to BodyOS, which ticks the matching planned day.",
    inputSchema: {
      date,
      program: z.string().optional().describe("Program name or id the session came from"),
      day: z.string().optional().describe("Program day name, e.g. \"Upper A\" (needs program, or uses the active one)"),
      entries: z.array(z.object({
        exercise: z.string(),
        sets: z.array(z.object({
          reps: z.number().int().min(0).max(1000),
          kg: z.number().min(0).max(1000),
        })).min(1),
        rating: z.enum(["easy", "moderate", "hard"]).optional(),
      })).min(1),
      id: z.string().optional().describe("Existing workout id to replace"),
      completed: z.boolean().optional().describe("Default true. false saves an in-progress draft that won't count in stats"),
    },
    annotations: WRITE,
  }, async ({ date: d, program, day, entries, id, completed = true }) => {
    assertDate(d, "date");
    const { workout, replaced, data } = await store.mutate((data) => {
      let programId = null, dayId = null;
      if (day || program) {
        const p = resolveProgram(data, program);
        programId = p.id;
        if (day) dayId = resolveDay(p, day).id;
      }
      const exMap = resolveExercises(data, entries.map((e) => e.exercise));
      data.log = data.log || [];
      let idx = id ? data.log.findIndex((w) => w.id === id) : -1;
      if (id && idx < 0) throw new ToolError(`No workout with id "${id}".`);
      if (idx < 0 && programId && dayId) {
        idx = data.log.findIndex((w) => w.date === d && w.programId === programId && w.dayId === dayId);
      }
      const workout = {
        id: idx >= 0 ? data.log[idx].id : genId(),
        date: d, programId, dayId,
        completed,
        ...(completed ? { endedAt: new Date().toISOString() } : {}),
        entries: entries.map((e) => {
          const ex = exMap.get(e.exercise);
          return { exerciseId: ex.id, exerciseName: ex.name, rating: e.rating ?? null, sets: e.sets.map((s) => ({ reps: s.reps, kg: s.kg })) };
        }),
      };
      if (idx >= 0) data.log[idx] = workout; else data.log.push(workout);
      return { workout, replaced: idx >= 0, data: structuredClone(data) };
    });
    // Network call after the transaction commits (transactions may retry).
    const bodyos = completed && pushWorkout ? await pushWorkout(workout, data) : { pushed: false, reason: completed ? "push disabled" : "draft, not pushed" };
    return { replaced, workout: summarizeWorkout(workout, data, { full: true }), bodyos };
  });

  tool("delete_workout", {
    title: "Delete a workout",
    description: "Permanently remove a logged workout by id (get it from list_workouts). Only with the user's explicit confirmation. The BodyOS copy is not removed.",
    inputSchema: { id: z.string() },
    annotations: DESTRUCTIVE,
  }, async ({ id }) => store.mutate((data) => {
    const idx = (data.log || []).findIndex((w) => w.id === id);
    if (idx < 0) throw new ToolError(`No workout with id "${id}".`);
    const [removed] = data.log.splice(idx, 1);
    return { deleted: summarizeWorkout(removed, data), note: "The copy mirrored to BodyOS (if any) is unchanged." };
  }));

  tool("set_schedule_entry", {
    title: "Set a schedule entry",
    description: "Add or replace the local Schedule-tab entry for one date — e.g. mark a day missed, or tick a day done. It overrides the BodyOS plan for that date. For planning sessions, use the BodyOS connector instead.",
    inputSchema: {
      date,
      name: z.string().min(1),
      type: z.enum(["lift", "run", "hiit", "rest", "walk", "class", "other"]),
      notes: z.string().optional(),
      status: z.enum(["planned", "missed"]).optional().describe("missed shows a red Missed badge and breaks the streak"),
      completed: z.boolean().optional().describe("true ticks it done, false unticks"),
    },
    annotations: WRITE,
  }, async ({ date: d, name, type, notes, status, completed }) => {
    assertDate(d, "date");
    return store.mutate((data) => {
      data.schedule = data.schedule || [];
      data.planTicks = data.planTicks || {};
      const existing = data.schedule.find((e) => e.date === d);
      const entry = {
        id: existing?.id || genId(),
        blockId: existing?.blockId || "claude-mcp",
        blockName: existing?.blockName || "Added via Claude",
        date: d, type, name: name.trim(),
        ...(notes ? { notes } : {}),
        ...(status === "missed" ? { status: "missed" } : {}),
      };
      data.schedule = [...data.schedule.filter((e) => e.date !== d), entry]
        .sort((a, b) => a.date.localeCompare(b.date));
      if (completed === true) data.planTicks[entry.id] = { tickedAt: new Date().toISOString(), source: "claude-mcp" };
      if (completed === false) delete data.planTicks[entry.id];
      return { replaced: !!existing, entry: { date: d, type, name: entry.name, status: data.planTicks[entry.id] ? "completed" : entry.status || "planned" } };
    });
  });

  tool("remove_schedule_entry", {
    title: "Remove a schedule entry",
    description: "Delete the local schedule entry on a date (and its tick), so the BodyOS plan shows for that date again. Only with the user's confirmation.",
    inputSchema: { date },
    annotations: DESTRUCTIVE,
  }, async ({ date: d }) => {
    assertDate(d, "date");
    return store.mutate((data) => {
      const hits = (data.schedule || []).filter((e) => e.date === d);
      if (!hits.length) throw new ToolError(`No local schedule entry on ${d}.`);
      data.schedule = data.schedule.filter((e) => e.date !== d);
      for (const e of hits) if (data.planTicks) delete data.planTicks[e.id];
      return { removed: hits.map((e) => ({ date: e.date, name: e.name })) };
    });
  });

  return server;
}
