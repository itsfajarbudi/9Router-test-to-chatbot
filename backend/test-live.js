const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('https://9-router-test-to-chatbot.vercel.app/v1/chat/completions', {
      model: "gemini-2.5-flash",
      messages: [
        { role: "assistant", content: "Halo! Saya adalah asisten AI Fajar." },
        { role: "user", content: "siapa kamu ?" }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://itsfajarbudi.github.io'
      }
    });
    console.log("✅ Success:", JSON.stringify(res.data));
  } catch (err) {
    console.log("❌ Error Status:", err.response ? err.response.status : 'No Status');
    console.log("❌ Error Data:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}
test();
