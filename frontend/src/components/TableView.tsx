import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DataEditor, GridCell, GridCellKind, Item } from '@glideapps/glide-data-grid';
import { useTables } from '../hooks/useTables';
import { useRows } from '../hooks/useRows';
import { useEnrichment } from '../hooks/useEnrichment';
import { Column } from '../types';
import '@glideapps/glide-data-grid/dist/index.css';
import './TableView.css';

const WS_URL = import.meta.env.VITE_WS_URL || '/ws';

interface EnrichmentConfigForm {
  url: string;
  method: 'GET' | 'POST';
  headers: string;
  requestTemplate: string;
  responseMapping: string;
  outputColumns: string;
  maxConcurrency: number;
}

const defaultEnrichmentConfig: EnrichmentConfigForm = {
  url: '',
  method: 'POST',
  headers: '{}',
  requestTemplate: '{}',
  responseMapping: '{}',
  outputColumns: '[]',
  maxConcurrency: 3,
};

export const TableView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { fetchTables, getTable, addColumn, deleteTable } = useTables();
  const { rows, total, error, fetchRows, updateRow, deleteRow, importCsv } = useRows();
  const { currentRun, startEnrichment, updateRunProgress } = useEnrichment();

  const [table, setTable] = useState<any>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [colName, setColName] = useState('');
  const [colType, setColType] = useState<string>('string');
  const [enrichConfig, setEnrichConfig] = useState<EnrichmentConfigForm>(defaultEnrichmentConfig);
  const [contextMenu, setContextMenu] = useState<{ row: number; col: number; x: number; y: number } | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const tables = useTables((s) => s.tables);

  const loadTable = useCallback(async (tableId: string) => {
    const freshTable = await getTable(tableId);
    setTable(freshTable);
    await fetchRows(tableId);
  }, [getTable, fetchRows]);

  // Load table
  useEffect(() => {
    if (!id) return;
    fetchTables();
    loadTable(id).catch(() => undefined);
  }, [id, fetchTables, loadTable]);

  useEffect(() => {
    if (id && tables.length > 0) {
      const found = tables.find((t) => t.id === id);
      if (found) {
        setTable(found);
      }
    }
  }, [id, tables]);

  // WebSocket for real-time enrichment updates
  useEffect(() => {
    if (!id) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', tableId: id }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'enrichment:progress' || msg.type === 'enrichment:completed' || msg.type === 'enrichment:failed') {
          updateRunProgress(msg.runId, msg.completedRows, msg.totalRows, msg.failedRows);
          if (refreshTimerRef.current !== null) {
            window.clearTimeout(refreshTimerRef.current);
          }
          // Coalesce bursty progress events into a single rows refresh.
          refreshTimerRef.current = window.setTimeout(() => {
            fetchRows(id);
            refreshTimerRef.current = null;
          }, 200);
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      // WebSocket unavailable, enrichment will still work (just no real-time updates)
    };

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      ws.close();
      wsRef.current = null;
    };
  }, [id, fetchRows, updateRunProgress]);

  const columns: Column[] = useMemo(() => table?.columnsMetadata ?? [], [table]);
  const visibleTables = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return tables;
    return tables.filter((t) => t.name.toLowerCase().includes(needle));
  }, [tables, searchQuery]);

  const gridColumns = useMemo(
    () =>
      columns.map((col) => ({
        title: col.name,
        id: col.name,
        width: col.type === 'enrichment' ? 180 : 150,
        hasMenu: false,
        themeOverride: col.type === 'enrichment'
          ? { bgCell: '#f0f7ff' }
          : col.type === 'formula'
          ? { bgCell: '#f5f0ff' }
          : undefined,
      })),
    [columns]
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      if (row >= rows.length) {
        return { kind: GridCellKind.Text, data: '', allowOverlay: true, displayData: '' };
      }
      const colName = columns[col]?.name;
      if (!colName) {
        return { kind: GridCellKind.Text, data: '', allowOverlay: true, displayData: '' };
      }
      const value = rows[row].data[colName];
      const display = value === null || value === undefined ? '' : String(value);
      return {
        kind: GridCellKind.Text,
        data: display,
        allowOverlay: true,
        displayData: display,
        readonly: columns[col]?.type === 'enrichment' || columns[col]?.type === 'formula',
      };
    },
    [rows, columns]
  );

  const onCellEdited = useCallback(
    (cell: Item, newValue: GridCell) => {
      const [col, row] = cell;
      if (newValue.kind !== GridCellKind.Text || row >= rows.length) return;
      const colName = columns[col]?.name;
      if (!colName || !id) return;
      const rowId = rows[row].id;
      updateRow(id, rowId, { [colName]: newValue.data });
    },
    [columns, rows, id, updateRow]
  );

  const handleAddColumn = async () => {
    if (!id || !colName.trim()) return;
    try {
      const payload: any = { name: colName.trim(), type: colType };

      if (colType === 'enrichment') {
        payload.enrichment = {
          url: enrichConfig.url,
          method: enrichConfig.method,
          mapping: JSON.parse(enrichConfig.responseMapping),
          concurrency: enrichConfig.maxConcurrency,
          delay: 0,
          retryCount: 3,
        };
      }

      if (colType === 'formula') {
        payload.formula = enrichConfig.requestTemplate; // reuse field for formula expr
      }

      const updated = await addColumn(id, payload);
      setTable(updated);
      setColName('');
      setEnrichConfig(defaultEnrichmentConfig);
      setShowAddColumn(false);
    } catch (err: any) {
      setEnrichError(err?.message || 'Failed to add column');
    }
  };

  const handleEnrich = async (columnName: string) => {
    if (!id) return;
    setEnrichError(null);
    try {
      await startEnrichment(id, columnName);
    } catch (err: any) {
      setEnrichError(err?.message || 'Enrichment failed');
    }
  };

  const handleDeleteRow = async () => {
    if (!contextMenu || !id) return;
    const row = rows[contextMenu.row];
    if (row) {
      await deleteRow(id, row.id);
    }
    setContextMenu(null);
  };

  const runImport = async (csvText: string) => {
    if (!id || !csvText.trim()) return;
    setIsImporting(true);
    setImportStatus(null);
    setEnrichError(null);
    try {
      const result = await importCsv(id, csvText);
      setImportText('');
      setShowImport(false);
      await loadTable(id);
      setImportStatus(`Imported ${result.imported} rows and ${result.columns.length} columns`);
    } catch (err: any) {
      setImportStatus(null);
      setEnrichError(err?.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImport = async () => runImport(importText);

  if (!table) {
    return <div className="table-view"><p className="loading">Loading table...</p></div>;
  }

  // Find enrichment columns for the enrich button
  const enrichmentColumns = columns.filter((c) => c.type === 'enrichment');

  return (
    <div className="table-view-layout">
      <aside className="table-sidebar">
        <div className="sidebar-head">
          <button className="btn-back" onClick={() => navigate('/')} aria-label="Back to dashboard">←</button>
          <div>
            <strong>Workspace</strong>
            <p>{tables.length} tabelle</p>
          </div>
        </div>
        <div className="sidebar-list">
          {visibleTables.map((t) => (
            <button
              key={t.id}
              className={`sidebar-item ${t.id === table.id ? 'active' : ''}`}
              onClick={() => navigate(`/tables/${t.id}`)}
            >
              <span>{t.name}</span>
              <small>{t.columnsMetadata.length} col</small>
            </button>
          ))}
        </div>
      </aside>

      <div className="table-view">
      <div className="table-toolbar">
        <button className="btn-back" onClick={() => navigate('/')} aria-label="Back to dashboard">←</button>
        <div className="table-title">
          <h2>{table.name}</h2>
          {table.description && <span className="table-desc">{table.description}</span>}
        </div>
        <div className="toolbar-actions">
          <span className="row-count">{total} rows</span>
          <input
            className="toolbar-search"
            placeholder="Search tabelle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="btn-secondary" onClick={() => setShowAddColumn(!showAddColumn)}>
            + Column
          </button>
          <button className="btn-secondary" onClick={() => setShowImport(!showImport)}>
            Import CSV
          </button>
          <button
            className="btn-danger"
            onClick={() => { if (confirm('Delete entire table?')) { deleteTable(table.id); navigate('/'); } }}
          >
            Delete
          </button>
        </div>
      </div>

      {showAddColumn && (
        <div className="inline-form column-form">
          <input
            type="text"
            placeholder="Column name"
            value={colName}
            onChange={(e) => setColName(e.target.value)}
            autoFocus
          />
          <select value={colType} onChange={(e) => setColType(e.target.value)}>
            <option value="string">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="boolean">Boolean</option>
            <option value="enrichment">Enrichment</option>
            <option value="formula">Formula</option>
          </select>

          {colType === 'enrichment' && (
            <div className="enrichment-config">
              <input
                type="url"
                placeholder="API URL (e.g. https://api.example.com/enrich)"
                value={enrichConfig.url}
                onChange={(e) => setEnrichConfig({ ...enrichConfig, url: e.target.value })}
              />
              <select
                value={enrichConfig.method}
                onChange={(e) => setEnrichConfig({ ...enrichConfig, method: e.target.value as 'GET' | 'POST' })}
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
              <input
                type="text"
                placeholder='Response mapping: { "field": "$.data.field" }'
                value={enrichConfig.responseMapping}
                onChange={(e) => setEnrichConfig({ ...enrichConfig, responseMapping: e.target.value })}
              />
              <input
                type="number"
                placeholder="Max concurrency"
                value={enrichConfig.maxConcurrency}
                onChange={(e) => setEnrichConfig({ ...enrichConfig, maxConcurrency: parseInt(e.target.value) || 3 })}
                min={1}
                max={20}
              />
            </div>
          )}

          {colType === 'formula' && (
            <div className="enrichment-config">
              <input
                type="text"
                placeholder="Formula expression (e.g. UPPER({Name}))"
                value={enrichConfig.requestTemplate}
                onChange={(e) => setEnrichConfig({ ...enrichConfig, requestTemplate: e.target.value })}
              />
            </div>
          )}

          <button className="btn-primary" onClick={handleAddColumn}>Add</button>
          <button className="btn-secondary" onClick={() => setShowAddColumn(false)}>Cancel</button>
        </div>
      )}

      {showImport && (
        <div className="inline-form import-form">
          <div className="import-header">
            <label className="file-picker">
              Scegli file CSV
              <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (ev) => {
                    const text = ev.target?.result as string || '';
                    await runImport(text);
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
            <span>oppure incolla il CSV qui sotto</span>
          </div>
          <textarea
            placeholder="name,email,company&#10;Ada Lovelace,ada@example.com,Analytical Engines"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
          />
          <div className="form-actions">
            <button className="btn-primary" onClick={handleImport} disabled={isImporting || !importText.trim()}>
              {isImporting ? 'Importing...' : 'Import'}
            </button>
            <button className="btn-secondary" onClick={() => setShowImport(false)}>Cancel</button>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
      {enrichError && <div className="error">{enrichError}</div>}
      {importStatus && <div className="success">{importStatus}</div>}

      {/* Enrichment progress bar */}
      {currentRun && currentRun.status === 'running' && (
        <div className="enrich-progress">
          <div className="enrich-progress-label">
            Enriching... {currentRun.completedRows}/{currentRun.totalRows} rows
            {currentRun.failedRows > 0 && ` (${currentRun.failedRows} failed)`}
          </div>
          <div className="enrich-progress-bar">
            <div
              className="enrich-progress-fill"
              style={{
                width: `${currentRun.totalRows > 0
                  ? Math.round(((currentRun.completedRows + currentRun.failedRows) / currentRun.totalRows) * 100)
                  : 0}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Enrichment column buttons */}
      {enrichmentColumns.length > 0 && (
        <div className="enrich-actions">
          {enrichmentColumns.map((col) => (
            <button
              key={col.name}
              className="btn-enrich"
              onClick={() => handleEnrich(col.name)}
              disabled={currentRun?.status === 'running'}
            >
              ⚡ Enrich: {col.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid-container">
        {gridColumns.length === 0 ? (
          <div className="empty-grid">
            <button className="btn-primary" onClick={() => setShowImport(true)}>Import CSV</button>
            <button className="btn-secondary" onClick={() => setShowAddColumn(true)}>Add column</button>
          </div>
        ) : (
          <DataEditor
            getCellContent={getCellContent}
            onCellEdited={onCellEdited}
            onCellContextMenu={(cell, event) => {
              event.preventDefault();
              const [col, row] = cell;
              if (row >= rows.length) return;
              setContextMenu({
                row,
                col,
                x: event.bounds.x + event.localEventX,
                y: event.bounds.y + event.localEventY,
              });
            }}
            columns={gridColumns}
            rows={Math.max(rows.length, 1)}
            rowMarkers="both"
            smoothScrollX
            smoothScrollY
            width="100%"
            height="100%"
          />
        )}
      </div>

      {contextMenu && (
        <>
          <div className="context-menu-overlay" onClick={() => setContextMenu(null)} />
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button onClick={handleDeleteRow}>Delete Row</button>
          </div>
        </>
      )}
      </div>
    </div>
  );
};
