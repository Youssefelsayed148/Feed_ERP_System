require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '7d'
  },
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || 'https://api.whatsapp.business.com',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN
  },
  ai: {
    chatbotUrl: process.env.CHATBOT_URL || 'http://localhost:8000',
    leadScoringUrl: process.env.LEAD_SCORING_URL || 'http://localhost:8001'
  }
};