// Load environment variables from .env file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
          const value = match[2].trim();
          process.env[key] = value;
          console.log(`Set ${key}=${value}`);
        }
      }
    }
  } catch (error) {
    console.error('Error loading .env file:', error);
  }
}

loadEnv();

console.log('\nEnvironment variables after loading:');
console.log('CACHE_STORE:', process.env.CACHE_STORE);
console.log('CACHE_DIR:', process.env.CACHE_DIR);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY); 