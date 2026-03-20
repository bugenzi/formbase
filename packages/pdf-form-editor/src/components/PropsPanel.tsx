import { useFieldStore } from '../store/useFieldStore'

export function PropsPanel() {
  const { fields, selectedId, selectedType, updateField } = useFieldStore()
  const field = selectedId && selectedType === 'field' ? fields[selectedId] : null

  if (!field) {
    return (
      <div className="props-panel props-panel--empty">
        <p>Select a field on the canvas to edit its properties.</p>
      </div>
    )
  }

  return (
    <div className="props-panel">
      <h3>Properties</h3>

      <label>
        Label
        <input
          value={field.label}
          onChange={e => updateField(field.id, { label: e.target.value }, { undoable: false })}
          onBlur={e => updateField(field.id, { label: e.target.value }, { undoable: true })}
        />
      </label>

      <label>
        Type
        <select
          value={field.type}
          onChange={e => updateField(field.id, { type: e.target.value as any }, { undoable: true })}
        >
          {(['text','signature','initials','date','checkbox','dropdown'] as const).map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>

      <label>
        Assignee
        <input
          value={field.assignee}
          placeholder="e.g. signer1, notary"
          onChange={e => updateField(field.id, { assignee: e.target.value }, { undoable: false })}
          onBlur={e => updateField(field.id, { assignee: e.target.value }, { undoable: true })}
        />
      </label>

      <label className="props-panel__checkbox">
        <input
          type="checkbox"
          checked={field.required}
          onChange={e => updateField(field.id, { required: e.target.checked }, { undoable: true })}
        />
        Required
      </label>

      <h4>Text</h4>

      <label>
        Placeholder
        <input
          value={field.placeholder ?? ''}
          placeholder="Enter placeholder text..."
          onChange={e => updateField(field.id, { placeholder: e.target.value }, { undoable: false })}
          onBlur={e => updateField(field.id, { placeholder: e.target.value }, { undoable: true })}
        />
      </label>

      <div className="props-panel__row">
        <label>
          Font size (pt)
          <input
            type="number"
            min={6}
            max={72}
            value={field.fontSize ?? 12}
            onChange={e => updateField(field.id, { fontSize: +e.target.value }, { undoable: false })}
            onBlur={e => updateField(field.id, { fontSize: +e.target.value }, { undoable: true })}
          />
        </label>
        <label>
          Color
          <div className="props-panel__color-row">
            <input
              type="color"
              value={field.fontColor ?? '#000000'}
              onChange={e => updateField(field.id, { fontColor: e.target.value }, { undoable: true })}
            />
            <input
              type="text"
              value={field.fontColor ?? '#000000'}
              onChange={e => updateField(field.id, { fontColor: e.target.value }, { undoable: false })}
              onBlur={e => updateField(field.id, { fontColor: e.target.value }, { undoable: true })}
              style={{ flex: 1 }}
            />
          </div>
        </label>
      </div>

      <h4>Position (pt)</h4>
      <div className="props-panel__coords">
        {(['ptX','ptY','ptW','ptH'] as const).map(key => (
          <label key={key}>
            {key.replace('pt','')}
            <input
              type="number"
              value={Math.round(field[key])}
              onChange={e => updateField(field.id, { [key]: +e.target.value }, { undoable: false })}
              onBlur={e => updateField(field.id, { [key]: +e.target.value }, { undoable: true })}
            />
          </label>
        ))}
      </div>

      <div className="props-panel__page-info">
        Page {field.pageIdx + 1}
      </div>
    </div>
  )
}
