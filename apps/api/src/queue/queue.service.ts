import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PgmqMessage<T = unknown> {
  msgId: bigint;
  readCount: number;
  enqueuedAt: Date;
  message: T;
}

/**
 * Background job queue backed by the `pgmq` extension on the Supabase
 * Postgres database — no separate broker (Redis) needed.
 */
@Injectable()
export class SupabaseQueueService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseQueueService.name);
  private readonly ensuredQueues = new Set<string>();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.prisma.$executeRaw`create extension if not exists pgmq cascade;`;
    } catch (err) {
      this.logger.error(`Failed to enable pgmq extension — background jobs will not run: ${err}`);
    }
  }

  async ensureQueue(queueName: string): Promise<void> {
    if (this.ensuredQueues.has(queueName)) return;
    try {
      await this.prisma.$executeRaw`select pgmq.create(${queueName});`;
    } catch (err) {
      // pgmq.create() isn't idempotent when the pgmq extension was created
      // with CASCADE after the queue's table/sequence already existed —
      // Postgres reports the sequence as already owned by the extension even
      // though the queue itself is fully functional. Anything else is a real
      // failure and must still surface (e.g. so send() doesn't silently
      // enqueue against a queue that was never created).
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('already a member of extension')) throw err;
    }
    this.ensuredQueues.add(queueName);
  }

  async send(queueName: string, payload: Record<string, unknown>): Promise<bigint> {
    await this.ensureQueue(queueName);
    const rows = await this.prisma.$queryRaw<{ send: bigint }[]>`
      select * from pgmq.send(${queueName}, ${JSON.stringify(payload)}::jsonb);
    `;
    return rows[0].send;
  }

  async read<T = unknown>(
    queueName: string,
    visibilitySeconds: number,
    quantity: number,
  ): Promise<PgmqMessage<T>[]> {
    const rows = await this.prisma.$queryRaw<
      { msg_id: bigint; read_ct: number; enqueued_at: Date; message: T }[]
    >`
      select msg_id, read_ct, enqueued_at, message
      from pgmq.read(${queueName}, ${visibilitySeconds}::int, ${quantity}::int);
    `;
    return rows.map((r) => ({
      msgId: r.msg_id,
      readCount: r.read_ct,
      enqueuedAt: r.enqueued_at,
      message: r.message,
    }));
  }

  async delete(queueName: string, msgId: bigint): Promise<void> {
    await this.prisma.$executeRaw`select pgmq.delete(${queueName}, ${msgId}::bigint);`;
  }

  async archive(queueName: string, msgId: bigint): Promise<void> {
    await this.prisma.$executeRaw`select pgmq.archive(${queueName}, ${msgId}::bigint);`;
  }
}
