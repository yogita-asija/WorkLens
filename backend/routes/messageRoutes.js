const express     = require("express")
const router      = express.Router()
const requireAuth = require("../middleware/requireAuth")
const ctrl        = require("../controller/messageController")

// All routes require faculty auth (x-user-id header)
router.get("/",              requireAuth, ctrl.getMessages)     // GET    /api/messages
router.post("/",             requireAuth, ctrl.sendMessage)     // POST   /api/messages
router.post("/receive",      requireAuth, ctrl.receiveMessage)  // POST   /api/messages/receive  (simulate inbox)
router.patch("/read-all",    requireAuth, ctrl.markAllRead)     // PATCH  /api/messages/read-all
router.patch("/:id/read",    requireAuth, ctrl.markRead)        // PATCH  /api/messages/:id/read
router.delete("/:id",        requireAuth, ctrl.deleteMessage)   // DELETE /api/messages/:id

module.exports = router
