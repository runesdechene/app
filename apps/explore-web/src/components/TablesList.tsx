interface TablesListProps {
  tables: string[]
}

export function TablesList({ tables }: TablesListProps) {
  if (tables.length === 0) {
    return (
      <div className="info-card">
        <h3>Tables détectées</h3>
        <p>Aucune table détectée (base vide ou en attente d'import)</p>
      </div>
    )
  }

  return (
    <div className="info-card">
      <h3>Tables détectées ({tables.length})</h3>
      <ul>
        {tables.map(table => (
          <li key={table}>{table}</li>
        ))}
      </ul>
    </div>
  )
}
