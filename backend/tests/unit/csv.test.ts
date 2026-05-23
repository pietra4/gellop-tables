import { parseCsv } from '../../src/utils/csv.js';

describe('parseCsv', () => {
  it('parses a simple CSV into records keyed by header', () => {
    const { headers, records } = parseCsv('name,age\nAlice,30\nBob,25');
    expect(headers).toEqual(['name', 'age']);
    expect(records).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const { records } = parseCsv('name,note\n"Smith, John","hello, world"');
    expect(records[0]).toEqual({ name: 'Smith, John', note: 'hello, world' });
  });

  it('handles escaped quotes inside quoted fields', () => {
    const { records } = parseCsv('quote\n"She said ""hi"""');
    expect(records[0].quote).toBe('She said "hi"');
  });

  it('handles newlines inside quoted fields', () => {
    const { records } = parseCsv('text\n"line one\nline two"');
    expect(records[0].text).toBe('line one\nline two');
  });

  it('handles CRLF line endings', () => {
    const { headers, records } = parseCsv('a,b\r\n1,2\r\n3,4');
    expect(headers).toEqual(['a', 'b']);
    expect(records).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('throws if any data row has a different number of columns than the header', () => {
    expect(() => parseCsv('a,b,c\n1,2')).toThrow(/expected 3/i);
  });

  it('strips UTF-8 BOM from the first header', () => {
    const { headers, records } = parseCsv('\uFEFFname,age\nAlice,30');
    expect(headers).toEqual(['name', 'age']);
    expect(records[0]).toEqual({ name: 'Alice', age: '30' });
  });

  it('auto-detects semicolon delimiter', () => {
    const { headers, records } = parseCsv('name;age\nAlice;30\nBob;25');
    expect(headers).toEqual(['name', 'age']);
    expect(records).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ]);
  });

  it('trims header whitespace', () => {
    const { headers } = parseCsv(' name , age \nx,y');
    expect(headers).toEqual(['name', 'age']);
  });

  it('skips fully empty trailing lines', () => {
    const { records } = parseCsv('a\n1\n\n');
    expect(records).toEqual([{ a: '1' }]);
  });

  it('handles a file without a trailing newline', () => {
    const { records } = parseCsv('a,b\n1,2');
    expect(records).toEqual([{ a: '1', b: '2' }]);
  });

  it('returns empty result for empty input', () => {
    expect(parseCsv('')).toEqual({ headers: [], records: [] });
  });

  it('throws on duplicate header columns', () => {
    expect(() => parseCsv('a,a\n1,2')).toThrow(/duplicate/i);
  });

  it('throws on empty header column name', () => {
    expect(() => parseCsv('a,,b\n1,2,3')).toThrow(/empty/i);
  });
});
