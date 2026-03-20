import React, { createContext, useContext, useMemo } from 'react'
import { CoordEngine } from '../engine/CoordEngine'

interface EditorContextValue {
  engine: CoordEngine
  aiProxyUrl: string
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function EditorProvider({
  children,
  aiProxyUrl,
}: {
  children: React.ReactNode
  aiProxyUrl: string
}) {
  // Engine is created once per editor instance and never recreated
  const engine = useMemo(() => new CoordEngine(), [])

  return (
    <EditorContext.Provider value={{ engine, aiProxyUrl }}>
      {children}
    </EditorContext.Provider>
  )
}

export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditorContext must be used inside <EditorProvider>')
  return ctx
}
