const axios = require('axios');
require('dotenv').config();

async function test() {
  try {
    const res = await axios.post('http://localhost:8080/v1/chat/completions', {
      model: "auto",
      messages: [
        { role: "assistant", content: "Halo! Saya adalah asisten AI Fajar." },
        { role: "user", content: "siapa kamu ?" }
      ],
      temperature: 0.7
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer portofolio-fajar'
      }
    });
    console.log("✅ Success:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.log("❌ Error:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}
test();
