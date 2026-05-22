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

  it('fills missing trailing cells with empty strings', () => {
    const { records } = parseCsv('a,b,c\n1,2');
    expect(records[0]).toEqual({ a: '1', b: '2', c: '' });
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
