// Kept so existing `require("../middleware/requireAuth")` imports keep working.
// Authentication is now JWT-based – see middleware/auth.js
const { authenticate } = require("./auth")
module.exports = authenticate
