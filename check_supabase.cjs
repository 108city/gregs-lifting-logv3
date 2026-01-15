
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://zsqscoiqhlocvixyuyvu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzcXNjb2lxaGxvY3ZpeHl1eXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3ODI1MjgsImV4cCI6MjA3MTM1ODUyOH0.8I9uqeOTkfkJcKXEeZdM_y6xiY1X7OFghQ-VGA7vVbg";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkCloudData() {
    console.log("Checking Supabase cloud data...");

    const { data, error } = await supabase
        .from("lifting_logs")
        .select("*");

    if (error) {
        console.error("Error fetching data:", error);
        return;
    }

    console.log(`Found ${data.length} rows.`);
    data.forEach(row => {
        console.log(`\n--- Row: ${row.id} (Updated: ${row.updated_at}) ---`);
        const db = row.data;
        if (db) {
            console.log(`Exercises: ${db.exercises?.length || 0}`);
            console.log(`Log Entries: ${db.log?.length || 0}`);

            // Check for specific duplicates the user mentioned
            const logNames = new Set();
            (db.log || []).forEach(w => (w.entries || []).forEach(e => logNames.add(e.name || e.exerciseName)));

            console.log("Unique exercise names in logs:", Array.from(logNames).filter(n =>
                n.toLowerCase().includes("face") ||
                n.toLowerCase().includes("lateral") ||
                n.toLowerCase().includes("bench")
            ));
        }
    });
}

checkCloudData();
