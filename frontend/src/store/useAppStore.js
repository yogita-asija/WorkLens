import { create } from "zustand"

const useAppStore = create((set) => ({
  // ── Auth ──────────────────────────────────────────────────────────────
  user: (() => { try { return JSON.parse(localStorage.getItem("worklens_user")) } catch { return null } })(),
  setUser: (u) => { localStorage.setItem("worklens_user", JSON.stringify(u)); set({ user: u }) },
  logout: () => { localStorage.removeItem("worklens_user"); set({ user: null }) },

  // ── Profile sidebar ───────────────────────────────────────────────────
  profileOpen: false,
  openProfile:  () => set({ profileOpen: true }),
  closeProfile: () => set({ profileOpen: false }),

  // ── Notifications ─────────────────────────────────────────────────────
  notifications:  [],
  unreadCount:    0,
  notifOpen:      false,
  openNotif:      () => set({ notifOpen: true }),
  closeNotif:     () => set({ notifOpen: false }),
  setNotifications: (notes, count) => set({ notifications: notes, unreadCount: count }),
  markNotifRead:  (id) => set(s => ({
    notifications: s.notifications.map(n => n._id === id ? { ...n, read: true } : n),
    unreadCount:   Math.max(0, s.unreadCount - 1),
  })),
  markAllNotifRead: () => set(s => ({
    notifications: s.notifications.map(n => ({ ...n, read: true })),
    unreadCount: 0,
  })),

  // ── Courses (shared) ──────────────────────────────────────────────────
  courses:       [],
  coursesLoaded: false,
  setCourses:    (c) => set({ courses: c, coursesLoaded: true }),
  upsertCourse:  (c) => set(s => {
    const exists = s.courses.find(x => x._id === c._id)
    return { courses: exists ? s.courses.map(x => x._id === c._id ? c : x) : [c, ...s.courses] }
  }),
  removeCourse:  (id) => set(s => ({ courses: s.courses.filter(x => x._id !== id) })),

  // ── Assignments (shared) ──────────────────────────────────────────────
  assignments:       [],
  assignmentsLoaded: false,
  setAssignments:    (a) => set({ assignments: a, assignmentsLoaded: true }),
  upsertAssignment:  (a) => set(s => {
    const exists = s.assignments.find(x => x._id === a._id)
    return { assignments: exists ? s.assignments.map(x => x._id === a._id ? a : x) : [a, ...s.assignments] }
  }),
  removeAssignment:  (id) => set(s => ({ assignments: s.assignments.filter(x => x._id !== id) })),

  // ── Toast ─────────────────────────────────────────────────────────────
  toast: null,
  showToast: (msg, type = "success") => {
    set({ toast: { msg, type } })
    setTimeout(() => set({ toast: null }), 3000)
  },
}))

export default useAppStore
