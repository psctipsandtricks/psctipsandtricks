import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lgxulhrppihkzwudvmpu.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxneHVsaHJwcGloa3p3dWR2bXB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzIwODAsImV4cCI6MjEwMTI0ODA4MH0.KSNAGNa-sUW9aMoESMpEVTKBJGV0oItEuf6uHt17GyE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
