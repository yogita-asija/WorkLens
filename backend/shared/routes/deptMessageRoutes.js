const express          = require("express")
const router           = express.Router()
const requireDeptMember = require("../middleware/requireDeptMember")
const { rateLimit }    = requireDeptMember
const ctrl             = require("../controller/deptMessageController")

// HOD <-> Faculty messaging. Every route needs a logged-in HOD or faculty (x-user-id header);
// pair / department authorisation happens inside the controller.
router.use(requireDeptMember)

const sendLimit = rateLimit({ windowMs: 60_000, max: 40 })
const annLimit = rateLimit({ windowMs: 60_000, max: 6 })

// fixed paths first, then the ones with params
router.get("/contacts",      ctrl.getContacts)      // GET    /api/dept-messages/contacts
router.get("/stats",         ctrl.getStats)         // GET    /api/dept-messages/stats
router.get("/unread-count",  ctrl.getUnreadCount)   // GET    /api/dept-messages/unread-count
router.patch("/read-all",    ctrl.markAllRead)      // PATCH  /api/dept-messages/read-all

// announcements (HOD notice board, separate from the chats)
router.get("/announcements",                 ctrl.getAnnouncements)          // HOD: sent ones, faculty: received ones
router.post("/announcements",                annLimit, ctrl.createAnnouncement) // HOD only
router.patch("/announcements/read-all",      ctrl.markAllAnnouncementsRead)  // faculty
router.patch("/announcements/:id/read",      ctrl.markAnnouncementRead)      // faculty
router.delete("/announcements/:id",          ctrl.deleteAnnouncement)        // HOD, own

router.get("/conversations/:contactId/messages",   ctrl.getThread)                // history (paged)
router.post("/conversations/:contactId/messages",  sendLimit, ctrl.sendMessage)   // send
router.patch("/conversations/:contactId/read",     ctrl.markThreadRead)           // mark thread read

router.patch("/messages/:id",  ctrl.editMessage)    // edit own message (15 min)
router.delete("/messages/:id", ctrl.deleteMessage)  // delete own message for everyone

module.exports = router
