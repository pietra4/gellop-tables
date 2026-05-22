import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTables } from '../hooks/useTables';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const { tables, loading, error, fetchTables, createTable, deleteTable } = useTables();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const table = await createTable({ name: newName.trim(), description: newDesc.trim() || undefined });
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      navigate(`/tables/${table.id}`);
    } catch {
      // error in store
    }
  };

  if (loading && tables.length === 0) {
    return <div className="dashboard"><p className="loading">Loading tables...</p></div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>My Tables</h2>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ New Table'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="create-form">
          <input
            type="text"
            placeholder="Table name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            autoFocus
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <button type="submit" className="btn-primary">Create</button>
        </form>
      )}

      {error && <div className="error">{error}</div>}

      {tables.length === 0 && !loading ? (
        <div className="empty-state">
          <p>No tables yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="table-grid">
          {tables.map((t) => (
            <div key={t.id} className="table-card" onClick={() => navigate(`/tables/${t.id}`)}>
              <div className="table-card-header">
                <h3>{t.name}</h3>
                <button
                  className="btn-delete"
                  onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${t.name}"?`)) deleteTable(t.id); }}
                  title="Delete table"
                >
                  ×
                </button>
              </div>
              {t.description && <p className="table-desc">{t.description}</p>}
              <div className="table-meta">
                <span>{t.columnsMetadata.length} columns</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
