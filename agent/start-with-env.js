// Load environment variables from .env file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  console.log('Loading .env file from:', envPath);
  
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    
    for (const line of envLines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const match = trimmedLine.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          
          // Handle comments at the end of the line
          const commentIndex = value.indexOf('#');
          if (commentIndex > 0) {
            value = value.substring(0, commentIndex).trim();
          }
          
          process.env[key] = value;
          console.log(`Set ${key}=${value}`);
        }
      }
    }
  } catch (error) {
    console.error('Error loading .env file:', error);
  }
}

// Load environment variables
loadEnv();

// Verify key environment variables
console.log('\nKey environment variables:');
console.log('CACHE_STORE:', process.env.CACHE_STORE);
console.log('CACHE_DIR:', process.env.CACHE_DIR);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY);

// Start the agent
console.log('\nStarting agent...');
const child = spawn('node', ['--loader', 'ts-node/esm', 'src/index.ts'], {
  stdio: 'inherit',
  env: process.env
});

child.on('error', (error) => {
  console.error('Failed to start agent:', error);
});

child.on('close', (code) => {
  console.log(`Agent process exited with code ${code}`);
}); 