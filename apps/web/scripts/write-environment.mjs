import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const environmentPath = resolve(scriptDirectory, '../src/environments/environment.ts');
const source = await readFile(environmentPath, 'utf8');

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl && !publishableKey) {
  console.log('Using the local Angular Supabase environment fallback.');
  process.exit(0);
}

if (!supabaseUrl || !publishableKey) {
  throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be provided together.');
}

const escapedUrl = JSON.stringify(supabaseUrl);
const escapedKey = JSON.stringify(publishableKey);
const generated = `export const environment = {\n  production: true,\n  supabaseUrl: ${escapedUrl},\n  supabasePublishableKey: ${escapedKey}\n};\n`;

await writeFile(environmentPath, generated, 'utf8');
console.log('Generated Angular production environment from deployment variables.');
