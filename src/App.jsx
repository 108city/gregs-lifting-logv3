import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ================== Storage helpers (SSR/sandbox safe) ==================
const STORAGE_KEY = "liftlog-web-v6";
const canUseLS = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const rawLoad = (key) => {
  try {
    if (canUseLS()) {
      const cur = window.localStorage.getItem(key);
      if (cur) return JSON.parse(cur);
    }
  } catch (error) {
    console.warn("localStorage load failed", error);
  }
  return {};
};

const load = () => {
  const v6 = rawLoad(STORAGE_KEY);
  if (Object.keys(v6).length) return v6;
  const v5 = rawLoad("liftlog-web-v5");
  return v5;
};

const save = (data) => {
  try {
    if (canUseLS()) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (error) {
    console.warn("localStorage save failed", error);
  }
};

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0,10);
const weeksBetween = (startIso, endIso=today()) => {
  try {
    const a = new Date(startIso + 'T00:00:00');
    const b = new Date(endIso + 'T00:00:00');
    const ms = b - a; if (isNaN(ms)) return 0;
    return Math.floor(ms / (1000*60*60*24*7));
  } catch { return 0; }
};

// ================== Data shape ==================
// db = {
//   exercises: [{id, name}],
//   program: {
//     activeWorkoutId: string | null,
//     workouts: [
//       { id, name, startDate, days: [ { id, name, blocks: [ { id, exerciseId, sets, reps } ] } ] }
//     ]
//   },
//   sessions: [ { id, date, dayId, entries: [ { id, blockId, exerciseId, sets: [ { reps, kg } ] } ] } ]
// }

const makeBlankWorkout = (name = "Workout 1") => ({
  id: uid(),
  name,
  startDate: today(),
  days: [
    { id: uid(), name: "Day 1", blocks: [] },
    { id: uid(), name: "Day 2", blocks: [] },
    { id: uid(), name: "Day 3", blocks: [] },
  ],
});

const defaultDb = () => ({
  exercises: [],
  program: {
    activeWorkoutId: null,
    workouts: [],
  },
  sessions: [],
});

// Migrate old shape (program.days) into workouts
const migrate = (db) => {
  if (!db || typeof db !== 'object') return defaultDb();
  const base = { ...defaultDb(), ...db };
  if (base.program && Array.isArray(base.program.days)) {
    const w = {
      id: uid(),
      name: "Workout 1",
      startDate: today(),
      days: base.program.days.map(d => ({ ...d })),
    };
    base.program = { activeWorkoutId: w.id, workouts: [w] };
  } else if (!base.program || !Array.isArray(base.program.workouts) || base.program.workouts.length === 0) {
    const w = makeBlankWorkout("Workout 1");
    base.program = { activeWorkoutId: w.id, workouts: [w] };
  } else if (!base.program.activeWorkoutId) {
    base.program.activeWorkoutId = base.program.workouts[0].id;
  }
  // Ensure arrays
  base.sessions = Array.isArray(base.sessions) ? base.sessions.map(s => ({
    ...s,
    entries: Array.isArray(s.entries) ? s.entries.map(e => ({
      ...e,
      sets: Array.isArray(e.sets) ? e.sets : [],
    })) : [],
  })) : [];
  base.exercises = Array.isArray(base.exercises) ? base.exercises : [];
  return base;
};

const getActiveWorkout = (db) => db.program.workouts.find(w => w.id === db.program.activeWorkoutId);

export default function App() {
  const [db, setDb] = useState(() => migrate({ ...defaultDb(), ...load() }));
  useEffect(() => { save(db); }, [db]);

  const [tab, setTab] = useState("log");
  const activeWorkout = getActiveWorkout(db);

  return (
    <div className="min-h-screen p-4 md:p-8 bg-black text-blue-500">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Greg's Lifting Log</h1>
          {activeWorkout && (
            <div className="text-right text-xs md:text-sm">
              <div className="font-medium">{activeWorkout.name}</div>
              <div className="text-muted-foreground">Started {activeWorkout.startDate} · Week {weeksBetween(activeWorkout.startDate) + 1}</div>
            </div>
          )}
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-blue-900 text-white">
            <TabsTrigger value="log">Log</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="program">Program</TabsTrigger>
            <TabsTrigger value="exercises">Exercises</TabsTrigger>
          </TabsList>

          <TabsContent value="log"><LogTab db={db} setDb={setDb} /></TabsContent>
          <TabsContent value="progress"><ProgressTab db={db} /></TabsContent>
          <TabsContent value="program"><ProgramTab db={db} setDb={setDb} /></TabsContent>
          <TabsContent value="exercises"><ExercisesTab db={db} setDb={setDb} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ================== Exercises ==================
function ExercisesTab({ db, setDb }) {
  const [name, setName] = useState("");
  const add = () => { if (!name.trim()) return; setDb({ ...db, exercises: [...db.exercises, { id: uid(), name: name.trim() }] }); setName(""); };

  const sortedExercises = useMemo(() => [...db.exercises].sort((a,b)=>a.name.localeCompare(b.name)), [db.exercises]);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-col md:flex-row gap-2">
        <Input placeholder="Add exercise (e.g., Bench Press)" value={name} onChange={e=>setName(e.target.value)} />
        <Button onClick={add}>Add</Button>
      </div>
      <Separator />
      <div className="space-y-2">
        {sortedExercises.length === 0 ? <p className="text-sm text-muted-foreground">No exercises yet.</p> :
          sortedExercises.map(ex => (
            <div key={ex.id} className="p-2 rounded border flex items-center justify-between">
              <span>{ex.name}</span>
              <Button variant="ghost" size="sm" onClick={()=> setDb({
                ...db,
                exercises: db.exercises.filter(e=>e.id!==ex.id),
                program:{
                  ...db.program,
                  workouts: db.program.workouts.map(w=> ({
                    ...w,
                    days: w.days.map(d=> ({...d, blocks: d.blocks.filter(b=>b.exerciseId!==ex.id)}))
                  }))
                },
                sessions: db.sessions.map(s=>({...s, entries:s.entries.filter(en=>en.exerciseId!==ex.id)}))
              })}>Delete</Button>
            </div>
          ))}
      </div>
    </Card>
  );
}

// ================== Helper: commit-on-blur number input ==================
function NumberInputCommit({ value, min = 1, max = 999, onCommit, className = "" }) {
  const [text, setText] = React.useState(String(value));
  React.useEffect(() => { setText(String(value)); }, [value]);

  const commit = () => {
    const raw = text.trim() === "" ? String(value) : text;
    const num = /^\d+$/.test(raw) ? parseInt(raw, 10) : value;
    const clamped = Math.max(min, Math.min(max, num));
    onCommit(clamped);
    setText(String(clamped));
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      className={className}
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        if (t === "" || /^\d+$/.test(t)) setText(t);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur(); // triggers commit
        }
      }}
      placeholder="0"
    />
  );
}

// ================== Program (Workouts + 3-day designer) ==================
function ProgramTab({ db, setDb }) {
  const workouts = db.program.workouts;
  const activeWorkoutId = db.program.activeWorkoutId;
  const activeWorkout = workouts.find(w=>w.id===activeWorkoutId);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(activeWorkoutId);
  useEffect(()=>{ if (!selectedWorkoutId && workouts[0]) setSelectedWorkoutId(workouts[0].id); }, [workouts, selectedWorkoutId]);

  const setActiveWorkout = (id) => setDb({ ...db, program: { ...db.program, activeWorkoutId: id }});
  const addWorkout = () => {
    const w = makeBlankWorkout(`Workout ${workouts.length+1}`);
    setDb({ ...db, program: { ...db.program, workouts: [...workouts, w], activeWorkoutId: w.id }});
    setSelectedWorkoutId(w.id);
  };
  const renameWorkout = (id, name) => setDb({ ...db, program: { ...db.program, workouts: workouts.map(w=>w.id===id?{...w, name}:w) }});
  const setStartDate = (id, startDate) => setDb({ ...db, program: { ...db.program, workouts: workouts.map(w=>w.id===id?{...w, startDate}:w) }});
  const deleteWorkout = (id) => {
    if (workouts.length<=1) return;
    const filtered = workouts.filter(w=>w.id!==id);
    const nextActive = db.program.activeWorkoutId===id ? filtered[0].id : db.program.activeWorkoutId;
    setDb({ ...db, program: { ...db.program, workouts: filtered, activeWorkoutId: nextActive }});
    setSelectedWorkoutId(nextActive);
  };

  const w = workouts.find(x=>x.id===selectedWorkoutId);
  const days = w?.days || [];
  const [activeDayId, setActiveDayId] = useState(days[0]?.id);
  useEffect(()=>{ if (days.length && !days.find(d=>d.id===activeDayId)) setActiveDayId(days[0].id); }, [days, activeDayId]);

  const mutateWorkout = (fn) => setDb({ ...db, program: { ...db.program, workouts: workouts.map(x=> x.id===w.id ? fn(x) : x) }});

  const addBlock = (exerciseId) => { if (!w || !exerciseId) return; mutateWorkout((wk)=> ({...wk, days: wk.days.map(d=> d.id===activeDayId ? { ...d, blocks: [...d.blocks, { id: uid(), exerciseId, sets: 3, reps: 8 }] } : d)})); };
  const updateBlock = (blockId, patch) => mutateWorkout((wk)=> ({...wk, days: wk.days.map(d=> d.id===activeDayId ? { ...d, blocks: d.blocks.map(b=> b.id===blockId?{...b, ...patch}:b) } : d)}));
  const removeBlock = (blockId) => mutateWorkout((wk)=> ({...wk, days: wk.days.map(d=> d.id===activeDayId ? { ...d, blocks: d.blocks.filter(b=> b.id!==blockId) } : d)}));

  return (
    <Card className="p-4 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Workout block</Label>
          <Select value={selectedWorkoutId} onValueChange={setSelectedWorkoutId}>
            <SelectTrigger><SelectValue placeholder="Select workout" /></SelectTrigger>
            <SelectContent>
              {workouts.map(wk=> <SelectItem key={wk.id} value={wk.id}>{wk.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {w && (
          <div className="space-y-1">
            <Label>Workout name</Label>
            <Input value={w.name} onChange={e=>renameWorkout(w.id, e.target.value)} />
          </div>
        )}
        {w && (
          <div className="space-y-1">
            <Label>Start date</Label>
            <Input type="date" value={w.startDate} onChange={e=>setStartDate(w.id, e.target.value)} />
            <div className="text-xs text-muted-foreground">Week {weeksBetween(w.startDate)+1} since start</div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={addWorkout}>Add workout</Button>
        <Button variant={activeWorkoutId===selectedWorkoutId?"default":"outline"} onClick={()=>setActiveWorkout(selectedWorkoutId)}>
          {activeWorkoutId===selectedWorkoutId?"Active":"Set as active"}
        </Button>
        <Button variant="destructive" onClick={()=>deleteWorkout(selectedWorkoutId)} disabled={workouts.length<=1}>Delete workout</Button>
      </div>

      <Separator />

      {!w ? (
        <p className="text-sm text-muted-foreground">No workout selected. Create or select one above.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Training Day</Label>
              <Select value={activeDayId} onValueChange={setActiveDayId}>
                <SelectTrigger><SelectValue placeholder="Choose day" /></SelectTrigger>
                <SelectContent>
                  {days.map(d=> <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Add exercise</Label>
              <AddExercisePicker exercises={db.exercises} onPick={addBlock} />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            {days.find(d=>d.id===activeDayId)?.blocks.length===0 && <p className="text-sm text-muted-foreground">No exercises for this day. Add some above.</p>}
            {days.find(d=>d.id===activeDayId)?.blocks.map((b, idx) => {
              const ex = db.exercises.find(e=>e.id===b.exerciseId);
              return (
                <div key={b.id} className="p-3 rounded border grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                  <div className="md:col-span-2 font-medium">{idx+1}. {ex?.name || "(deleted)"}</div>

                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Sets</Label>
                    <NumberInputCommit
                      value={b.sets}
                      min={1}
                      max={20}
                      className="w-24"
                      onCommit={(n) => updateBlock(b.id, { sets: n })}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Reps</Label>
                    <NumberInputCommit
                      value={b.reps}
                      min={1}
                      max={50}
                      className="w-24"
                      onCommit={(n) => updateBlock(b.id, { reps: n })}
                    />
                  </div>

                  <div className="flex justify-end"><Button variant="ghost" onClick={()=>removeBlock(b.id)}>Remove</Button></div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

function AddExercisePicker({ exercises, onPick }) {
  const [id, setId] = useState("");
  useEffect(()=>{ if (!id && exercises[0]) setId(exercises[0].id); }, [exercises, id]);
  const sorted = useMemo(()=>[...exercises].sort((a,b)=>a.name.localeCompare(b.name)), [exercises]);
  return (
    <div className="flex gap-2">
      <Select value={id} onValueChange={setId}>
        <SelectTrigger><SelectValue placeholder="Select exercise" /></SelectTrigger>
        <SelectContent>
          {sorted.map(ex => (<SelectItem value={ex.id} key={ex.id}>{ex.name}</SelectItem>))}
        </SelectContent>
      </Select>
      <Button onClick={()=> onPick(id)} disabled={!id || exercises.length===0}>Add</Button>
    </div>
  );
}

// ================== Log ==================
// ---- Performance marker helpers (up / hold / down) ----
function ratingBg(r) {
  return r === "up"
    ? "bg-green-600 text-white"
    : r === "hold"
    ? "bg-amber-500 text-black"
    : r === "down"
    ? "bg-red-600 text-white"
    : "bg-zinc-800 text-zinc-200";
}

function ratingDot(r) {
  return r === "up"
    ? "bg-green-600"
    : r === "hold"
    ? "bg-amber-500"
    : r === "down"
    ? "bg-red-600"
    : "bg-zinc-700";
}

function LogTab({ db, setDb }) {
  const activeWorkout = getActiveWorkout(db);
  const days = activeWorkout?.days || [];
  const [date, setDate] = useState(today());
  const [dayId, setDayId] = useState(days[0]?.id || "");
  useEffect(()=>{ if (!dayId && days[0]) setDayId(days[0].id); }, [days, dayId]);

  const day = days.find(d=>d.id===dayId);
  const lastSession = useMemo(() => db.sessions.filter(s=>s.dayId===dayId && s.date<date).sort((a,b)=>b.date.localeCompare(a.date))[0], [db.sessions, dayId, date]);

  const [working, setWorking] = useState(() => seedFromProgram(db, day, date, lastSession));
  useEffect(()=> setWorking(seedFromProgram(db, day, date, lastSession)), [db, dayId, date, lastSession]);

  const [viewing, setViewing] = useState(null);

  const editSet = (entryId, setIdx, patch) => setWorking(w => ({
    ...w,
    entries: w.entries.map(e => e.id===entryId ? { ...e, sets: e.sets.map((s,i)=> i===setIdx ? { ...s, ...patch } : s) } : e)
  }));

  const saveSession = () => {
    if (!day) return;
    const normalizedEntries = working.entries.map(e => ({
      ...e,
      sets: e.sets.map(st => ({
        reps: clampInt(st.reps === "" ? "0" : String(st.reps), 0, 10000),
        kg: clampFloat(st.kg === "" ? "0" : String(st.kg), 0, 100000)
      }))
    }));
    const existingIndex = db.sessions.findIndex(s => s.date===date && s.dayId===dayId);
    const newSession = { id: existingIndex>=0 ? db.sessions[existingIndex].id : uid(), date, dayId, entries: normalizedEntries };
    const nextSessions = existingIndex>=0 ? db.sessions.map((s,i)=> i===existingIndex ? newSession : s) : [...db.sessions, newSession];
    setDb({ ...db, sessions: nextSessions });
  };

  return (
    <Card className="p-4 space-y-4">
      {!activeWorkout ? (
        <div className="text-sm text-muted-foreground">No active workout. Create one in the Program tab and set it active.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e=>setDate(e.target.value)} />
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label>Training Day ({activeWorkout.name})</Label>
              <Select value={dayId} onValueChange={setDayId}>
                <SelectTrigger><SelectValue placeholder="Choose day" /></SelectTrigger>
                <SelectContent>
                  {days.map(d=> <SelectItem value={d.id} key={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!day || day.blocks.length===0 ? (
            <p className="text-sm text-muted-foreground">This day has no programmed exercises yet. Define it in the Program tab.</p>
          ) : (
            <div className="space-y-4">
              {working.entries.map(entry => {
                const ex = db.exercises.find(e=>e.id===entry.exerciseId);
                const block = day.blocks.find(b=>b.id===entry.blockId);
                const prevEntry = lastSession?.entries.find(e=>e.blockId===entry.blockId);
                return (
                  <div key={entry.id} className="rounded border">
                    <div className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{ex?.name}</div>
                        <div className="text-xs text-muted-foreground">Target: {block?.sets} × {block?.reps}</div>
                      </div>
                    </div>
                    <Separator />
                    <div className="p-3 space-y-2">
                      {entry.sets.map((s, idx) => {
                        const prev = prevEntry?.sets[idx];
                        const globalBest = maxKgForExercise(db, entry.exerciseId, date);
                        return (
                          <div key={idx} className="grid grid-cols-4 gap-2 items-center">
                            <div className="text-sm text-muted-foreground">Set {idx+1}</div>
                            <Input type="text" inputMode="numeric" value={String(s.reps)} onChange={e=>editSet(entry.id, idx, { reps: e.target.value })} placeholder="Reps" />
                            <Input type="text" inputMode="decimal" value={String(s.kg)} onChange={e=>editSet(entry.id, idx, { kg: e.target.value })} placeholder="Weight (kg)" />
                            <div className="text-xs text-muted-foreground">{prev ? `Last: ${prev.reps}r @ ${prev.kg || 0}kg` : (globalBest > 0 ? `Prev best: ${globalBest}kg` : "–")}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-2 justify-end">
                <Button onClick={saveSession}>Save</Button>
              </div>
            </div>
          )}

          <RecentSessions db={db} dayId={dayId} onSelect={setViewing} />

          {viewing && (
            <ViewedSession session={viewing} db={db} onClose={()=>setViewing(null)} onLoadIntoEditor={() => {
              setDate(viewing.date);
              setWorking({ date: viewing.date, entries: viewing.entries.map(e => ({...e, sets: e.sets.map(s=>({ reps: String(s.reps), kg: String(s.kg) })) })) });
              setViewing(null);
            }} />
          )}
        </>
      )}
    </Card>
  );
}

function seedFromProgram(db, day, date, lastSession) {
  if (!day) return { date, entries: [] };
  const lastMaxFor = (exerciseId) => maxKgForExercise(db, exerciseId, date);
  return {
    date,
    entries: day.blocks.map(b => {
      const prevEntry = lastSession?.entries.find(e=>e.blockId===b.id);
      return {
        id: uid(),
        blockId: b.id,
        exerciseId: b.exerciseId,
        sets: Array.from({ length: b.sets }, (_,i) => ({
          reps: String(b.reps),
          kg: prevEntry?.sets?.[i]?.kg !== undefined
                ? String(prevEntry.sets[i].kg)
                : (lastMaxFor(b.exerciseId) ? String(lastMaxFor(b.exerciseId)) : "")
        }))
      };
    })
  };
}

function RecentSessions({ db, dayId, onSelect }) {
  const list = useMemo(() => db.sessions.filter(s=>s.dayId===dayId).sort((a,b)=>a.date.localeCompare(b.date)).slice(-5).reverse(), [db.sessions, dayId]);
  if (!dayId) return null;
  return (
    <div className="pt-4">
      <h3 className="font-medium mb-2">Recent sessions (this day)</h3>
      {list.length===0 ? <p className="text-sm text-muted-foreground">No sessions yet.</p> : (
        <div className="space-y-2">
          {list.map(s => (
            <div key={s.id} className="p-2 rounded border flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{s.date}</div>
                <div className="text-xs text-muted-foreground">Top set: {maxInSession(s).toFixed(1)} kg</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={()=>onSelect && onSelect(s)}>View</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ViewedSession({ session, db, onClose, onLoadIntoEditor }) {
  return (
    <Card className="p-4 space-y-3 border-2">
      <div className="flex items-center justify-between">
        <div className="font-medium">Session: {session.date}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onLoadIntoEditor}>Load into editor</Button>
          <Button size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
      <Separator />
      <div className="space-y-3">
        {session.entries.map((e,i)=>{
          const ex = db.exercises.find(x=>x.id===e.exerciseId);
          return (
            <div key={e.id} className="rounded border">
              <div className="p-3 font-medium">{i+1}. {ex?.name || e.exerciseId}</div>
              <Separator />
              <div className="p-3 space-y-1 text-sm">
                {e.sets.map((s, idx)=>(
                  <div key={idx} className="flex items-center gap-2"><div className="w-12 text-muted-foreground">Set {idx+1}</div><div>{s.reps} reps @ {s.kg} kg</div></div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const maxInSession = (s) => { let m = 0; if (!s || !Array.isArray(s.entries)) return 0; for (const e of s.entries) if (Array.isArray(e.sets)) for (const st of e.sets) m = Math.max(m, Number(st.kg)||0); return m; };

function maxKgForExercise(db, exerciseId, beforeDate) {
  let m = -Infinity;
  if (!db || !Array.isArray(db.sessions)) return 0;
  for (const s of db.sessions) {
    if (beforeDate && s.date >= beforeDate) continue;
    if (!Array.isArray(s.entries)) continue;
    for (const e of s.entries) if (e.exerciseId === exerciseId && Array.isArray(e.sets)) {
      for (const st of e.sets) m = Math.max(m, Number(st.kg) || 0);
    }
  }
  return m === -Infinity ? 0 : m;
}

// ================== Progress ==================
function ProgressTab({ db }) {
  const [exerciseId, setExerciseId] = useState(db.exercises[0]?.id || "");
  useEffect(()=>{ if (!exerciseId && db.exercises[0]) setExerciseId(db.exercises[0].id); }, [db.exercises, exerciseId]);
  const trendRaw = useMemo(() => buildTrend(db, exerciseId), [db.sessions, exerciseId]);
  const trend = Array.isArray(trendRaw) ? trendRaw : [];

  const exercise = db.exercises.find(e=>e.id===exerciseId);
  const start = trend.length ? (trend[0]?.max ?? 0) : 0;
  const end = trend.length ? (trend[trend.length-1]?.max ?? 0) : 0;
  const delta = (Number.isFinite(end) ? end : 0) - (Number.isFinite(start) ? start : 0);

  return (
    <Card className="p-4 space-y-4">
      {db.exercises.length===0 ? <p className="text-sm text-muted-foreground">Add exercises first.</p> : (
        <>
          <div className="space-y-1">
            <Label>Exercise</Label>
            <Select value={exerciseId} onValueChange={setExerciseId}>
              <SelectTrigger><SelectValue placeholder="Select exercise" /></SelectTrigger>
              <SelectContent>
                {db.exercises.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(ex => (
                  <SelectItem value={ex.id} key={ex.id}>{ex.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-64">
            {trend.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">No data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-20} textAnchor="end" height={40} />
                  <YAxis tick={{ fontSize: 12 }} domain={[dataMin => Math.floor(dataMin||0), dataMax => Math.ceil((dataMax||0)+5)]} />
                  <Tooltip formatter={(v)=>`${v} kg`} />
                  <Line type="monotone" dataKey="max" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="text-sm text-muted-foreground">Change in max for <span className="font-medium text-foreground">{exercise?.name || '–'}</span>: {Number.isFinite(delta) ? delta.toFixed(1) : '0.0'} kg</div>
        </>
      )}
    </Card>
  );
}

function buildTrend(db, exerciseId) {
  if (!exerciseId) return [];
  const byDate = new Map();
  if (!db || !Array.isArray(db.sessions)) return [];
  for (const s of db.sessions) {
    if (!Array.isArray(s.entries)) continue;
    for (const e of s.entries) if (e && e.exerciseId===exerciseId) {
      const sets = Array.isArray(e.sets) ? e.sets : [];
      const max = Math.max(0, ...sets.map(st => Number(st.kg)||0));
      const prev = byDate.get(s.date) || 0; byDate.set(s.date, Math.max(prev, max));
    }
  }
  return Array.from(byDate.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([date, max]) => ({ date, max }));
}

// Utils
const clampInt = (v, min, max) => { const n = parseInt(v, 10); if (isNaN(n)) return min; return Math.max(min, Math.min(max, n)); };
const clampFloat = (v, min, max) => { const n = parseFloat(v); if (isNaN(n)) return min; return Math.max(min, Math.min(max, n)); };

// Minimal tests (console)
if (typeof window !== 'undefined' && !window.__LIFTLOG_TESTS__) {
  window.__LIFTLOG_TESTS__ = true;
  (function runTests(){
    console.assert(clampInt("5", 1, 10) === 5, 'clampInt basic');
    console.assert(clampFloat("5.5", 0, 10) === 5.5, 'clampFloat basic');
    const ex1 = { id: 'ex1', name: 'Bench' };
    const w1 = { id: 'w1', name: 'Workout 1', startDate: '2025-08-01', days: [{ id: 'd1', name: 'Day 1', blocks: [{ id: 'b1', exerciseId: 'ex1', sets: 3, reps: 5 }] }] };
    const last = { id: 's0', date: '2025-08-01', dayId: 'd1', entries: [{ id:'e1', blockId:'b1', exerciseId:'ex1', sets:[{reps:5,kg:80},{reps:5,kg:80},{reps:5,kg:80}] }] };
    const dbTest = { exercises:[ex1], program:{activeWorkoutId:'w1', workouts:[w1]}, sessions:[last, { id:'s1', date:'2025-08-05', dayId:'d1', entries:[{ id:'e2', blockId:'b1', exerciseId:'ex1', sets:[{reps:5,kg:82.5},{reps:5,kg:82.5},{reps:5,kg:82.5}] }]}] };
    const tr = buildTrend(dbTest, 'ex1');
    console.assert(Array.isArray(tr) && tr.length === 2 && tr[0].max === 80 && tr[1].max === 82.5, 'buildTrend aggregates by date');
    const seeded = seedFromProgram(dbTest, w1.days[0], '2025-08-02', last);
    console.assert(String(seeded.entries[0].sets[0].kg) === '80', 'seedFromProgram prefill last');
    console.log('%cLiftLog ready','color:green;font-weight:bold');
  })();
}
