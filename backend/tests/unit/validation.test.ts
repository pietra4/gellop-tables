import {
  RegisterSchema,
  LoginSchema,
  AddColumnSchema,
  CreateTableSchema,
} from '../../src/core/validation.js';

describe('RegisterSchema', () => {
  it('accepts a valid registration', () => {
    const result = RegisterSchema.safeParse({
      username: 'pietro',
      email: 'pietro@example.com',
      password: 'SecurePass123!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a password shorter than 12 chars', () => {
    const result = RegisterSchema.safeParse({
      username: 'pietro',
      email: 'pietro@example.com',
      password: 'Short1!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a password without special characters', () => {
    const result = RegisterSchema.safeParse({
      username: 'pietro',
      email: 'pietro@example.com',
      password: 'NoSpecialChars123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = RegisterSchema.safeParse({
      username: 'pietro',
      email: 'not-an-email',
      password: 'SecurePass123!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a username shorter than 3 chars', () => {
    const result = RegisterSchema.safeParse({
      username: 'pi',
      email: 'pietro@example.com',
      password: 'SecurePass123!',
    });
    expect(result.success).toBe(false);
  });
});

describe('LoginSchema', () => {
  it('accepts username and password', () => {
    const result = LoginSchema.safeParse({ username: 'pietro', password: 'whatever' });
    expect(result.success).toBe(true);
  });

  it('rejects missing password', () => {
    const result = LoginSchema.safeParse({ username: 'pietro' });
    expect(result.success).toBe(false);
  });
});

describe('CreateTableSchema', () => {
  it('accepts a table with a name', () => {
    const result = CreateTableSchema.safeParse({ name: 'My Leads' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = CreateTableSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

describe('AddColumnSchema', () => {
  it('accepts a simple string column', () => {
    const result = AddColumnSchema.safeParse({ name: 'company', type: 'string' });
    expect(result.success).toBe(true);
  });

  it('applies enrichment defaults (concurrency, delay, retry)', () => {
    const result = AddColumnSchema.safeParse({
      name: 'enriched',
      type: 'enrichment',
      enrichment: {
        url: 'https://api.example.com/lookup',
        mapping: { email: 'response.email' },
      },
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.enrichment) {
      expect(result.data.enrichment.concurrency).toBe(3);
      expect(result.data.enrichment.delay).toBe(0);
      expect(result.data.enrichment.retryCount).toBe(3);
      expect(result.data.enrichment.method).toBe('POST');
    }
  });

  it('rejects an invalid enrichment URL', () => {
    const result = AddColumnSchema.safeParse({
      name: 'enriched',
      type: 'enrichment',
      enrichment: { url: 'not-a-url', mapping: {} },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown column type', () => {
    const result = AddColumnSchema.safeParse({ name: 'x', type: 'banana' });
    expect(result.success).toBe(false);
  });
});
