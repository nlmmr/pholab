import React, { useMemo, useState } from 'react';
import { IPHO_2024_E2_CONFIG } from '../../experiments/ipho-2024-e2/config';
import { Measurement } from '../../experiments/ipho-2024-e2/state';

interface NotebookProps {
  open: boolean;
  measurements: Measurement[];
  onClose: () => void;
  onAdd: (measurement: Measurement) => void;
  onUpdate: (measurement: Measurement) => void;
  onDelete: (id: string) => void;
}

export const Notebook: React.FC<NotebookProps> = ({ open, measurements, onClose, onAdd, onUpdate, onDelete }) => {
  const [fringeIndex, setFringeIndex] = useState('');
  const [angleDeg, setAngleDeg] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const progress = Math.min(100, (measurements.length / IPHO_2024_E2_CONFIG.minimumMeasurements) * 100);
  const sorted = useMemo(() => [...measurements].sort((a, b) => a.fringeIndex - b.fringeIndex), [measurements]);

  if (!open) return null;

  const clearForm = () => {
    setFringeIndex('');
    setAngleDeg('');
    setEditingId(null);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const m = Number(fringeIndex);
    const theta = Number(angleDeg);
    if (!Number.isFinite(m) || !Number.isFinite(theta) || m < 0 || theta < 0 || theta > 90) return;
    const measurement: Measurement = { id: editingId ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`, fringeIndex: m, angleDeg: theta };
    if (editingId) onUpdate(measurement);
    else onAdd(measurement);
    clearForm();
  };

  const edit = (row: Measurement) => {
    setEditingId(row.id);
    setFringeIndex(String(row.fringeIndex));
    setAngleDeg(String(row.angleDeg));
  };

  const exportCsv = () => {
    const csv = ['m,theta_deg', ...sorted.map((row) => `${row.fringeIndex},${row.angleDeg}`)].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ipho-2024-e2-part-a.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="notebook-sheet" aria-label="Experimental notebook">
      <div className="sheet-handle" />
      <header className="sheet-header">
        <div>
          <span className="eyebrow">Part A · data collection</span>
          <h2>Experimental notebook</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close notebook">×</button>
      </header>

      <div className="measurement-progress">
        <div><span>{measurements.length}</span> / {IPHO_2024_E2_CONFIG.minimumMeasurements} measurements</div>
        <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
      </div>

      <form className="measurement-form" onSubmit={submit}>
        <label>
          Fringe index <i>m</i>
          <input inputMode="numeric" value={fringeIndex} onChange={(e) => setFringeIndex(e.target.value)} placeholder="e.g. 12" aria-label="Fringe index m" />
        </label>
        <label>
          Your angle <i>θ</i>
          <div className="angle-field"><input inputMode="decimal" value={angleDeg} onChange={(e) => setAngleDeg(e.target.value)} placeholder="e.g. 28.5" aria-label="Angle read from protractor" /><span>°</span></div>
        </label>
        <button className="primary-button" type="submit">{editingId ? 'Save change' : 'Add measurement'}</button>
        {editingId && <button className="quiet-button" type="button" onClick={clearForm}>Cancel</button>}
      </form>

      <div className="notebook-table-wrap">
        <table className="notebook-table">
          <thead><tr><th>m</th><th>θ</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr className="empty-row"><td colSpan={3}>Read the physical scale, then enter the value yourself.</td></tr>
            ) : sorted.map((row) => (
              <tr key={row.id}>
                <td>{row.fringeIndex}</td><td>{row.angleDeg}°</td>
                <td><button onClick={() => edit(row)}>Edit</button><button onClick={() => onDelete(row.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="export-button" onClick={exportCsv} disabled={!measurements.length}>Export CSV</button>
      <p className="notebook-note">Angles are never read or corrected automatically in IPhO Original mode.</p>
    </aside>
  );
};
