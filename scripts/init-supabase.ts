import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

async function initializeSupabase() {
    // Load environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_API_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error(
            "Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_API_KEY environment variables."
        );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // Read SQL initialization script
        const sqlScript = readFileSync(
            join(__dirname, "init-supabase.sql"),
            "utf-8"
        );

        // Split script into individual statements
        const statements = sqlScript
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

        console.log("Initializing Supabase database...");

        // Execute each statement
        for (const statement of statements) {
            try {
                const { error } = await supabase.rpc("exec", {
                    sql: statement,
                });
                if (error) {
                    console.error(
                        `Error executing statement: ${error.message}`
                    );
                    console.error("Statement:", statement);
                }
            } catch (err) {
                console.error("Error:", err);
                console.error("Failed statement:", statement);
            }
        }

        console.log("Database initialization completed successfully!");
    } catch (error) {
        console.error("Failed to initialize database:", error);
        process.exit(1);
    }
}

// Run initialization
initializeSupabase().catch(console.error);
