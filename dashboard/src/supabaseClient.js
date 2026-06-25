import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase URL and Anon Key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pommiyqbrpuboehojryu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbW1peXFicnB1Ym9laG9qcnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMzk1MDEsImV4cCI6MjA5NzYxNTUwMX0.n94mlpNBTHpvSpED40YL6OZNlNURMOuoMI46ns50Ia0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
