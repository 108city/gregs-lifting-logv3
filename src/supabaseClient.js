// src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zsqscoiqhlocvixyuyvu.supabase.co"; // <-- your URL
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzcXNjb2lxaGxvY3ZpeHl1eXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3ODI1MjgsImV4cCI6MjA3MTM1ODUyOH0.8I9uqeOTkfkJcKXEeZdM_y6xiY1X7OFghQ-VGA7vVbg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
