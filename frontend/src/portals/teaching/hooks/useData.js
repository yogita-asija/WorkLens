import { useEffect, useCallback } from "react"
import useAppStore from "../../../store/useAppStore"
import * as api from "../services/teachingApi"

// Load courses into global store (deduped)
export function useCourses() {
  const { courses, coursesLoaded, setCourses } = useAppStore()
  const reload = useCallback(async () => {
    const data = await api.getCourses()
    setCourses(Array.isArray(data) ? data : [])
  }, [setCourses])

  useEffect(() => {
    if (!coursesLoaded) reload()
  }, [coursesLoaded, reload])

  return { courses, reload }
}

// Load assignments into global store (deduped)
export function useAssignments() {
  const { assignments, assignmentsLoaded, setAssignments } = useAppStore()
  const reload = useCallback(async () => {
    const data = await api.getAssignments()
    setAssignments(Array.isArray(data) ? data : [])
  }, [setAssignments])

  useEffect(() => {
    if (!assignmentsLoaded) reload()
  }, [assignmentsLoaded, reload])

  return { assignments, reload }
}
