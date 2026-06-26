require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');

async function test() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase.from('api_settings').select('*');
  console.log("Supabase API Settings:", data);
  
  const groqKey = data.find(d => d.provider === 'groq')?.api_key;
  if (!groqKey) {
    console.log("No Groq API Key found in DB!");
    return;
  }
  
  try {
    const groq = new Groq({ apiKey: groqKey });
    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Test' }],
      model: "llama3-8b-8192",
    });
    console.log("Groq Success:", response.choices[0].message.content);
  } catch (err) {
    console.error("Groq Error:", err.message);
  }
}

test();
