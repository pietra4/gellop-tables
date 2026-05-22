import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as tableService from './service.js';
import { extractUserId } from '../../middleware/auth.js';
import {
  CreateTableSchema,
  UpdateTableSchema,
  AddColumnSchema,
} from '../../core/validation.js';
import { ValidationError } from '../../utils/errors.js';

function parse<T>(schema: { parse: (v: unknown) => T }, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid input: ' + error.errors[0].message);
    }
    throw error;
  }
}

export async function createTableHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const input = parse(CreateTableSchema, request.body);
  const table = await tableService.createTable(userId, input);
  reply.status(201).send(table);
}

export async function listTablesHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const tables = await tableService.listTables(userId);
  reply.send(tables);
}

export async function getTableHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id } = request.params as { id: string };
  const table = await tableService.getTable(id, userId);
  reply.send(table);
}

export async function updateTableHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id } = request.params as { id: string };
  const input = parse(UpdateTableSchema, request.body);
  const table = await tableService.updateTable(id, userId, input);
  reply.send(table);
}

export async function deleteTableHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id } = request.params as { id: string };
  await tableService.deleteTable(id, userId);
  reply.status(204).send();
}

export async function addColumnHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id } = request.params as { id: string };
  const input = parse(AddColumnSchema, request.body);
  const table = await tableService.addColumn(id, userId, input);
  reply.status(201).send(table);
}

export async function deleteColumnHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id, name } = request.params as { id: string; name: string };
  const table = await tableService.deleteColumn(id, userId, decodeURIComponent(name));
  reply.send(table);
}
