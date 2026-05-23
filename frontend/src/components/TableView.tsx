import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DataEditor, GridCell, GridCellKind, Item, Rectangle } from '@glideapps/glide-data-grid';
import { useTables } from '../hooks/useTables';
import { useRows } from '../hooks/useRows';
import { useEnrichment } from '../hooks/useEnrichment';
import { Column } from '../types';
import client from '../api/client';
import '@glideapps/glide-data-grid/dist/index.css';
import './TableView.css';

const WS_URL = import.meta.env.VITE_WS_URL || '/ws';

type TableViewSavedState = {
  filters: Record<string, string>;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
};

interface SavedView {
  id: string;
  name: string;
  state: TableViewSavedState;
}

interface EnrichmentConfigForm {
  url: string;
  method: 'GET' | 'POST';
  responseMapping: string;
  maxConcurrency: number;
  formula: string;
}

const defaultEnrichmentConfig: EnrichmentConfigForm = {
  url: '',
  method: 'POST',
  responseMapping: '{}',
  maxConcurrency: 3,
  formula: '',
};

function formulaHints(formula: string, columns: Column[]): { valid: boolean; message: string } {
  if (!formula.trim()) return { valid: false, message: 'Formula vuota' };
  const refs = formula.match(/\{([^}]+)\}/g) || [];
  if (refs.length === 0) {
    return { valid: true, message: 'Nessun riferimento colonna (ok se voluto)' };
  }
  const validCols = new Set(columns.map((c) => c.name));
  const invalid = refs
    .map((r) => r.slice(1, -1).trim())
    .filter((name) => !validCols.has(name));
  if (invalid.length > 0) {
    return { valid: false, message: `Colonne non trovate: ${invalid.join(', ')}` };
  }
  return { valid: true, message: `Riferimenti validi: ${refs.join(', ')}` };
}

export const TableView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { fetchTables, getTable, addColumn, deleteColumn, deleteTable } = useTables();
  const {
    rows,
    total,
    error,
    fetchRows,
    updateRow,
    deleteRow,
    importCsv,
    filters,
    sortColumn,
    sortDirection,
    setFilters,
    setSort,
  } = useRows();
  const { currentRun, startEnrichment, updateRunProgress, setRunStatus } = useEnrichment();

  const [table, setTable] = useState<any>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [colName, setColName] = useState('');
  const [colType, setColType] = useState<string>('string');
  const [enrichConfig, setEnrichConfig] = useState<EnrichmentConfigForm>(defaultEnrichmentConfig);
  const [contextMenu, setContextMenu] = useState<{ row: number; col: number; x: number; y: number } | null>(null);
  const [columnMenu, setColumnMenu] = useState<{ col: number; x: number; y: number } | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isRunningFormula, setIsRunningFormula] = useState(false);
  const [viewName, setViewName] = useState('');
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const tables = useTables((s) => s.tables);

  const viewKey = useMemo(() => (id ? `gellop:view:${id}` : ''), [id]);

  const loadTable = useCallback(async (tableId: string) => {
    const freshTable = await getTable(tableId);
    setTable(freshTable);
    await fetchRows(tableId);
  }, [getTable, fetchRows]);

  useEffect(() => {
    if (!id) return;
    fetchTables();
    loadTable(id).catch(() => undefined);
  }, [id, fetchTables, loadTable]);

  useEffect(() => {
    if (id && tables.length > 0) {
      const found = tables.find((t) => t.id === id);
      if (found) setTable(found);
    }
  }, [id, tables]);

  useEffect(() => {
    if (!id || !viewKey) return;
    try {
      const raw = localStorage.getItem(viewKey);
      if (!raw) return;
      const views = JSON.parse(raw) as SavedView[];
      setSavedViews(Array.isArray(views) ? views : []);
    } catch {
      setSavedViews([]);
    }
  }, [id, viewKey]);

  const persistViews = useCallback((next: SavedView[]) => {
    setSavedViews(next);
    if (!viewKey) return;
    localStorage.setItem(viewKey, JSON.stringify(next));
  }, [viewKey]);

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
          if (msg.type === 'enrichment:completed') {
            setRunStatus(msg.runId, 'completed');
            setNotice(`Enrichment completato: ${msg.completedRows}/${msg.totalRows}`);
          }
          if (msg.type === 'enrichment:failed') {
            setRunStatus(msg.runId, 'failed');
            setEnrichError(`Enrichment fallito: ${msg.failedRows}/${msg.totalRows} errori`);
          }
          if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = window.setTimeout(() => {
            fetchRows(id);
            refreshTimerRef.current = null;
          }, 200);
        }
      } catch {
        // ignore malformed ws payload
      }
    };

    return () => {
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
      ws.close();
      wsRef.current = null;
    };
  }, [id, fetchRows, updateRunProgress, setRunStatus]);

  const columns: Column[] = useMemo(() => table?.columnsMetadata ?? [], [table]);
  const formulaCheck = useMemo(() => formulaHints(enrichConfig.formula, columns), [enrichConfig.formula, columns]);

  const gridColumns = useMemo(
    () =>
      columns.map((col) => ({
        title: col.name,
        id: col.name,
        width: col.type === 'enrichment' ? 220 : 180,
        hasMenu: true,
        themeOverride:
          col.type === 'enrichment'
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
      if (row >= rows.length) return { kind: GridCellKind.Text, data: '', allowOverlay: true, displayData: '' };
      const colName = columns[col]?.name;
      if (!colName) return { kind: GridCellKind.Text, data: '', allowOverlay: true, displayData: '' };
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
      updateRow(id, rows[row].id, { [colName]: newValue.data });
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
        payload.formula = enrichConfig.formula;
      }
      const updated = await addColumn(id, payload);
      setTable(updated);
      setColName('');
      setEnrichConfig(defaultEnrichmentConfig);
      setShowAddColumn(false);
      setNotice(`Colonna ${payload.name} creata`);
    } catch (err: any) {
      setEnrichError(err?.message || 'Failed to add column');
    }
  };

  const handleEnrich = async (columnName: string) => {
    if (!id) return;
    setEnrichError(null);
    setNotice(null);
    try {
      await startEnrichment(id, columnName);
      setNotice(`Enrichment avviato su ${columnName}`);
    } catch (err: any) {
      setEnrichError(err?.message || 'Enrichment failed');
    }
  };

  const handleRunFormula = async (columnName: string, formula: string) => {
    if (!id || !formula.trim()) return;
    setIsRunningFormula(true);
    setEnrichError(null);
    setNotice(null);

    try {
      const response = await client.post(`/tables/${id}/formula/run`, { columnName });
      const { updated, failed } = response.data as { updated: number; failed: number };
      await fetchRows(id);
      if (failed > 0) {
        setEnrichError(`Formula eseguita con errori: ${updated} ok, ${failed} fallite`);
      } else {
        setNotice(`Formula eseguita: ${updated} righe aggiornate`);
      }
    } catch (err: any) {
      setEnrichError(err?.response?.data?.error || err?.message || 'Run formula failed');
    } finally {
      setIsRunningFormula(false);
    }
  };

  const handleDeleteRow = async () => {
    if (!contextMenu || !id) return;
    const row = rows[contextMenu.row];
    if (row) await deleteRow(id, row.id);
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

  if (!table) return <div className="table-view"><p className="loading">Loading table...</p></div>;

  const selectedColumn = columnMenu ? columns[columnMenu.col] : null;
  const enrichmentColumns = columns.filter((c) => c.type === 'enrichment');

  const currentViewState: TableViewSavedState = { filters, sortColumn, sortDirection };

  return (
    <div className="table-view-full">
      <div className="table-toolbar">
        <button className="btn-back" onClick={() => navigate('/')} aria-label="Back to dashboard">←</button>
        <div className="table-title">
          <h2>{table.name}</h2>
          {table.description && <span className="table-desc">{table.description}</span>}
        </div>
        <div className="toolbar-actions">
          <span className="row-count">{total} rows</span>
          <button className="btn-secondary" onClick={() => setShowAddColumn(!showAddColumn)}>+ Column</button>
          <button className="btn-secondary" onClick={() => setShowImport(!showImport)}>Import CSV</button>
          <button className="btn-danger" onClick={() => { if (confirm('Delete entire table?')) { deleteTable(table.id); navigate('/'); } }}>Delete</button>
        </div>
      </div>

      <div className="view-toolbar">
        <select
          value=""
          onChange={(e) => {
            const view = savedViews.find((v) => v.id === e.target.value);
            if (!view || !id) return;
            setFilters(view.state.filters || {});
            setSort(view.state.sortColumn, view.state.sortDirection || 'asc');
            fetchRows(id);
          }}
        >
          <option value="">Carica vista salvata</option>
          {savedViews.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <input
          placeholder="Nome vista"
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
        />
        <button
          className="btn-secondary"
          onClick={() => {
            if (!viewName.trim()) return;
            const next: SavedView[] = [{ id: crypto.randomUUID(), name: viewName.trim(), state: currentViewState }, ...savedViews];
            persistViews(next);
            setViewName('');
            setNotice('Vista salvata');
          }}
        >
          Salva vista
        </button>
        <button className="btn-secondary" onClick={() => { setFilters({}); if (id) fetchRows(id); }}>Reset filtri</button>
      </div>

      <div className="filter-toolbar">
        {columns.map((c) => (
          <input
            key={c.name}
            className="toolbar-search"
            placeholder={`Filtra ${c.name}`}
            value={filters[c.name] || ''}
            onChange={(e) => {
              const next = { ...filters, [c.name]: e.target.value };
              setFilters(next);
            }}
            onBlur={() => { if (id) fetchRows(id); }}
          />
        ))}
      </div>

      {showAddColumn && (
        <div className="inline-form column-form">
          <input type="text" placeholder="Column name" value={colName} onChange={(e) => setColName(e.target.value)} autoFocus />
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
              <input type="url" placeholder="API URL" value={enrichConfig.url} onChange={(e) => setEnrichConfig({ ...enrichConfig, url: e.target.value })} />
              <select value={enrichConfig.method} onChange={(e) => setEnrichConfig({ ...enrichConfig, method: e.target.value as 'GET' | 'POST' })}>
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
              <input type="text" placeholder='Response mapping: { "field": "$.data.field" }' value={enrichConfig.responseMapping} onChange={(e) => setEnrichConfig({ ...enrichConfig, responseMapping: e.target.value })} />
              <input type="number" placeholder="Max concurrency" value={enrichConfig.maxConcurrency} onChange={(e) => setEnrichConfig({ ...enrichConfig, maxConcurrency: parseInt(e.target.value, 10) || 3 })} min={1} max={20} />
            </div>
          )}

          {colType === 'formula' && (
            <div className="enrichment-config">
              <input type="text" placeholder="Formula expression (e.g. {first_name} + ' ' + {last_name})" value={enrichConfig.formula} onChange={(e) => setEnrichConfig({ ...enrichConfig, formula: e.target.value })} />
              <span className={`formula-hint ${formulaCheck.valid ? 'ok' : 'bad'}`}>{formulaCheck.message}</span>
            </div>
          )}

          <button className="btn-primary" onClick={handleAddColumn} disabled={colType === 'formula' && !formulaCheck.valid}>Add</button>
          <button className="btn-secondary" onClick={() => setShowAddColumn(false)}>Cancel</button>
        </div>
      )}

      {showImport && (
        <div className="inline-form import-form">
          <textarea placeholder="name,email" value={importText} onChange={(e) => setImportText(e.target.value)} rows={6} />
          <div className="form-actions">
            <button className="btn-primary" onClick={() => runImport(importText)} disabled={isImporting || !importText.trim()}>
              {isImporting ? 'Importing...' : 'Import'}
            </button>
            <button className="btn-secondary" onClick={() => setShowImport(false)}>Cancel</button>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
      {enrichError && <div className="error">{enrichError}</div>}
      {notice && <div className="success">{notice}</div>}
      {importStatus && <div className="success">{importStatus}</div>}

      {currentRun && currentRun.status === 'running' && (
        <div className="enrich-progress">
          <div className="enrich-progress-label">
            Enriching {currentRun.columnId}... {currentRun.completedRows}/{currentRun.totalRows}
            {currentRun.failedRows > 0 && ` (${currentRun.failedRows} failed)`}
          </div>
          <div className="enrich-progress-bar">
            <div className="enrich-progress-fill" style={{ width: `${currentRun.totalRows > 0 ? Math.round(((currentRun.completedRows + currentRun.failedRows) / currentRun.totalRows) * 100) : 0}%` }} />
          </div>
        </div>
      )}

      {enrichmentColumns.length > 0 && (
        <div className="enrich-actions">
          {enrichmentColumns.map((col) => (
            <button key={col.name} className="btn-enrich" onClick={() => handleEnrich(col.name)} disabled={currentRun?.status === 'running'}>
              Run enrich: {col.name}
            </button>
          ))}
          {isRunningFormula && <span className="row-count">Formula in esecuzione...</span>}
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
              if (row < 0) {
                setColumnMenu({ col, x: event.bounds.x + event.localEventX, y: event.bounds.y + event.localEventY });
                return;
              }
              if (row >= rows.length) return;
              setContextMenu({ row, col, x: event.bounds.x + event.localEventX, y: event.bounds.y + event.localEventY });
            }}
            onHeaderMenuClick={(col: number, bounds: Rectangle) => {
              setColumnMenu({ col, x: bounds.x + 8, y: bounds.y + bounds.height + 8 });
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

      {columnMenu && selectedColumn && (
        <>
          <div className="context-menu-overlay" onClick={() => setColumnMenu(null)} />
          <div className="context-menu" style={{ left: columnMenu.x, top: columnMenu.y }}>
            <button onClick={() => { setSort(selectedColumn.name, 'asc'); if (id) fetchRows(id); setColumnMenu(null); }}>Sort asc</button>
            <button onClick={() => { setSort(selectedColumn.name, 'desc'); if (id) fetchRows(id); setColumnMenu(null); }}>Sort desc</button>
            {selectedColumn.type === 'enrichment' && (
              <button onClick={() => { handleEnrich(selectedColumn.name); setColumnMenu(null); }}>Run enrichment</button>
            )}
            {selectedColumn.type === 'formula' && selectedColumn.formula && (
              <button onClick={() => { handleRunFormula(selectedColumn.name, selectedColumn.formula as string); setColumnMenu(null); }}>
                Run formula
              </button>
            )}
            <button
              onClick={async () => {
                if (!id) return;
                try {
                  const updated = await deleteColumn(id, selectedColumn.name);
                  setTable(updated);
                  setNotice(`Colonna ${selectedColumn.name} eliminata`);
                } catch (err: any) {
                  setEnrichError(err?.message || 'Delete column failed');
                }
                setColumnMenu(null);
              }}
            >
              Delete column
            </button>
            <button className="context-placeholder" onClick={() => setColumnMenu(null)}>Rinomina (next)</button>
          </div>
        </>
      )}
    </div>
  );
};
