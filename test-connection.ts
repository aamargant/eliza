import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://eljhxykcoeybvtodgtnh.supabase.co";
const supabaseKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsamh4eWtjb2V5YnZ0b2RndG5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1MTg2MDIsImV4cCI6MjA1NDA5NDYwMn0.WuwXux6mUN2WwDP6R7-Tx_av_Oso7QXNOqtyrYf142A";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        const { data, error } = await supabase
            .from("accounts")
            .select("*")
            .limit(1);

        if (error) {
            console.error("Error:", error.message);
            return;
        }

        console.log("Connection successful!");
        console.log("Data:", data);
    } catch (err) {
        console.error("Unexpected error:", err);
    }
}

testConnection();
