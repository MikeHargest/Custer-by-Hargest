import { Project, TaskItem } from '../../types'

export const findProjectRecursive = (projects: Project[], id: string | null): Project | undefined => {
  if (!id) return undefined
  for (const p of projects) {
    if (p.id === id) return p
    if (p.subprojects) {
      const found = findProjectRecursive(p.subprojects, id)
      if (found) return found
    }
  }
  return undefined
}

export const getTreeDepth = (task: TaskItem): number => {
  if (!task.subtasks || task.subtasks.length === 0) return 0
  return 1 + Math.max(...task.subtasks.map((s) => getTreeDepth(s)))
}

export const flattenTree = (task: TaskItem): TaskItem[] => {
  const result: TaskItem[] = [{ ...task, subtasks: [] }]
  if (task.subtasks) {
    for (const sub of task.subtasks) {
      result.push(...flattenTree(sub))
    }
  }
  return result
}

export const removeTaskFromTree = (
  tasks: TaskItem[],
  taskId: string
): { remaining: TaskItem[]; extracted: TaskItem | null } => {
  let extracted: TaskItem | null = null
  const remaining = tasks.reduce((acc: TaskItem[], t) => {
    if (t.id === taskId) {
      extracted = { ...t, subtasks: t.subtasks ? [...t.subtasks] : [] }
      return acc
    }
    if (t.subtasks && t.subtasks.length > 0) {
      const childResult = removeTaskFromTree(t.subtasks, taskId)
      if (childResult.extracted) extracted = childResult.extracted
      acc.push({ ...t, subtasks: childResult.remaining })
    } else {
      acc.push(t)
    }
    return acc
  }, [])
  return { remaining, extracted }
}

export const removeTaskFromProjects = (
  projs: Project[],
  taskId: string
): { projects: Project[]; extracted: TaskItem | null } => {
  let extracted: TaskItem | null = null
  const projects = projs.map((p) => {
    const activeResult = removeTaskFromTree(p.tasks || [], taskId)
    if (activeResult.extracted) extracted = activeResult.extracted

    const archivedResult = removeTaskFromTree(p.archivedTasks || [], taskId)
    if (archivedResult.extracted) extracted = archivedResult.extracted

    return {
      ...p,
      tasks: activeResult.remaining,
      archivedTasks: archivedResult.remaining,
      subprojects: (() => {
        if (!p.subprojects) return []
        const subResult = removeTaskFromProjects(p.subprojects, taskId)
        if (subResult.extracted) extracted = subResult.extracted
        return subResult.projects
      })()
    }
  })
  return { projects, extracted }
}

export const enforceDepthLimit = (task: TaskItem, availableDepth: number): TaskItem => {
  if (availableDepth <= 0) {
    return { ...task, subtasks: [] }
  }
  if (!task.subtasks || task.subtasks.length === 0) return task

  const treeDepth = getTreeDepth(task)
  if (treeDepth <= availableDepth) {
    return task
  }

  const allDescendants = flattenTree(task).slice(1)
  return { ...task, subtasks: allDescendants }
}

export const getDepthOfTaskInList = (
  tasks: TaskItem[],
  targetId: string,
  currentDepth: number
): number | null => {
  for (const t of tasks) {
    if (t.id === targetId) return currentDepth
    if (t.subtasks && t.subtasks.length > 0) {
      const d = getDepthOfTaskInList(t.subtasks, targetId, currentDepth + 1)
      if (d !== null) return d
    }
  }
  return null
}

export const removeProjectFromTree = (
  projs: Project[],
  projectId: string
): { projects: Project[]; extracted: Project | null } => {
  let extracted: Project | null = null
  const projects = projs.reduce((acc: Project[], p) => {
    if (p.id === projectId) {
      extracted = p
      return acc
    }
    if (p.subprojects && p.subprojects.length > 0) {
      const childResult = removeProjectFromTree(p.subprojects, projectId)
      if (childResult.extracted) extracted = childResult.extracted
      acc.push({ ...p, subprojects: childResult.projects })
    } else {
      acc.push(p)
    }
    return acc
  }, [])
  return { projects, extracted }
}

export const extractCompletedTasks = (
  tasks: TaskItem[]
): { remaining: TaskItem[]; extracted: TaskItem[] } => {
  const extracted: TaskItem[] = []
  const remaining = tasks.reduce((acc: TaskItem[], t) => {
    if (t.completed) {
      extracted.push(t)
      return acc
    }
    if (t.subtasks && t.subtasks.length > 0) {
      const result = extractCompletedTasks(t.subtasks)
      extracted.push(...result.extracted)
      acc.push({ ...t, subtasks: result.remaining })
    } else {
      acc.push(t)
    }
    return acc
  }, [])
  return { remaining, extracted }
}

export const migrateProjectTasks = (p: Project): Project => {
  const { remaining, extracted } = extractCompletedTasks(p.tasks || [])
  return {
    ...p,
    tasks: remaining,
    archivedTasks: [
      ...(p.archivedTasks || []).map((t) => ({ ...t, completed: true })),
      ...extracted.map((t) => ({ ...t, completed: true }))
    ],
    subprojects: (p.subprojects || []).map(migrateProjectTasks)
  }
}
