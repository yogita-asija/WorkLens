// Kept so existing `require("./requireAuth")` imports keep working.
// Authentication is now JWT-based – see shared/middleware/auth.js
const { authenticate } = require("./auth")
module.exports = authenticate
