import { Router, type IRouter } from "express";
import { eq, ilike, and, or, count, desc, sql, gte } from "drizzle-orm";
import { db, customersTable, ledgerEntriesTable, walletTransactionsTable } from "@workspace/db";
import { sendCustomerAlert } from "../lib/mailer";

const router: IRouter = Router();

function mapCustomer(c: typeof customersTable.$inferSelect) {
  return {
    ...c,
    ledgerBalance: parseFloat(String(c.ledgerBalance)),
    walletBalance: parseFloat(String(c.walletBalance ?? "0")),
    createdAt: c.createdAt.toISOString(),
    type: c.type ?? "individual",
    phone: (c as Record<string, unknown>).phone ?? null,
    cnic: c.cnic ?? null,
    vehicleNumber: c.vehicleNumber ?? null,
    email: c.email ?? null,
    address: c.address ?? null,
    city: c.city ?? null,
    country: (c as Record<string, unknown>).country ?? "Pakistan",
    notes: c.notes ?? null,
  };
}

router.get("/customers", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "50"), 10);
  const offset = (page - 1) * limit;
  const search = String(req.query.search ?? "");
  const city = String(req.query.city ?? "");
  const active = req.query.active;

  const conditions = [];
  if (search) conditions.push(or(
    ilike(customersTable.name, `%${search}%`),
    ilike(customersTable.mobile, `%${search}%`),
    ilike(customersTable.address, `%${search}%`),
  ));
  if (city) conditions.push(eq(customersTable.city, city));
  if (active === "true") conditions.push(eq(customersTable.active, true));
  if (active === "false") conditions.push(eq(customersTable.active, false));

  const where = conditions.length ? and(...conditions) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(customersTable).where(where);
  const customers = await db.select().from(customersTable).where(where).limit(limit).offset(offset).orderBy(customersTable.name);

  res.json({ customers: customers.map(mapCustomer), total, page, limit });
});

router.post("/customers", async (req, res): Promise<void> => {
  const { name, mobile, phone, cnic, vehicleNumber, type, email, address, city, country, notes } = req.body;
  if (!name || !mobile) { res.status(400).json({ error: "Name and mobile required" }); return; }
  const [customer] = await db.insert(customersTable).values({
    name, mobile, phone, cnic, vehicleNumber, email, address, city, country, notes,
    type: type ?? "individual",
  }).returning();
  res.status(201).json(mapCustomer(customer));
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!customer) { res.status(404).json({ error: "Not found" }); return; }
  res.json(mapCustomer(customer));
});

router.patch("/customers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["name", "mobile", "phone", "cnic", "vehicleNumber", "type", "email", "address", "city", "country", "notes", "active"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [customer] = await db.update(customersTable).set(updates).where(eq(customersTable.id, id)).returning();
  if (!customer) { res.status(404).json({ error: "Not found" }); return; }
  res.json(mapCustomer(customer));
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.sendStatus(204);
});

// ── Wallet overview (all customers) ─────────────────────────────────────────

router.get("/wallet/overview", async (req, res): Promise<void> => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [{ total }] = await db
    .select({ total: sql<string>`coalesce(sum(wallet_balance),0)` })
    .from(customersTable);

  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(customersTable)
    .where(sql`wallet_balance > 0`);

  const [{ creditTotal }] = await db
    .select({ creditTotal: sql<string>`coalesce(sum(amount),0)` })
    .from(walletTransactionsTable)
    .where(and(eq(walletTransactionsTable.type, "credit"), gte(walletTransactionsTable.createdAt, startOfMonth)));

  const [{ debitTotal }] = await db
    .select({ debitTotal: sql<string>`coalesce(sum(amount),0)` })
    .from(walletTransactionsTable)
    .where(and(eq(walletTransactionsTable.type, "debit"), gte(walletTransactionsTable.createdAt, startOfMonth)));

  const customers = await db
    .select({ id: customersTable.id, name: customersTable.name, mobile: customersTable.mobile, walletBalance: customersTable.walletBalance })
    .from(customersTable)
    .where(sql`wallet_balance > 0`)
    .orderBy(desc(customersTable.walletBalance));

  const recentTxs = await db
    .select({
      id: walletTransactionsTable.id,
      customerId: walletTransactionsTable.customerId,
      customerName: customersTable.name,
      type: walletTransactionsTable.type,
      amount: walletTransactionsTable.amount,
      balanceAfter: walletTransactionsTable.balanceAfter,
      description: walletTransactionsTable.description,
      reference: walletTransactionsTable.reference,
      createdAt: walletTransactionsTable.createdAt,
    })
    .from(walletTransactionsTable)
    .innerJoin(customersTable, eq(walletTransactionsTable.customerId, customersTable.id))
    .orderBy(desc(walletTransactionsTable.createdAt))
    .limit(200);

  res.json({
    totalLiability: parseFloat(String(total)),
    customersWithBalance: cnt,
    creditThisMonth: parseFloat(String(creditTotal)),
    debitThisMonth: parseFloat(String(debitTotal)),
    customers: customers.map(c => ({ ...c, walletBalance: parseFloat(String(c.walletBalance)) })),
    recentTransactions: recentTxs.map(t => ({
      ...t,
      amount: parseFloat(String(t.amount)),
      balanceAfter: parseFloat(String(t.balanceAfter)),
      createdAt: t.createdAt.toISOString(),
    })),
  });
});

// ── Wallet (per customer) ────────────────────────────────────────────────────

router.get("/customers/:id/wallet", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [customer] = await db.select({ walletBalance: customersTable.walletBalance })
    .from(customersTable).where(eq(customersTable.id, id));
  if (!customer) { res.status(404).json({ error: "Not found" }); return; }

  const transactions = await db.select().from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.customerId, id))
    .orderBy(desc(walletTransactionsTable.createdAt))
    .limit(100);

  res.json({
    balance: parseFloat(String(customer.walletBalance ?? "0")),
    transactions: transactions.map(t => ({
      ...t,
      amount: parseFloat(String(t.amount)),
      balanceAfter: parseFloat(String(t.balanceAfter)),
      createdAt: t.createdAt.toISOString(),
    })),
  });
});

router.post("/customers/:id/wallet/credit", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { amount, description, reference } = req.body;
  const amt = parseFloat(String(amount ?? 0));
  if (!amt || amt <= 0) { res.status(400).json({ error: "Amount must be positive" }); return; }
  if (!description) { res.status(400).json({ error: "Description required" }); return; }

  const [customer] = await db.select({ walletBalance: customersTable.walletBalance })
    .from(customersTable).where(eq(customersTable.id, id));
  if (!customer) { res.status(404).json({ error: "Not found" }); return; }

  const prev = parseFloat(String(customer.walletBalance ?? "0"));
  const newBalance = prev + amt;

  await db.update(customersTable)
    .set({ walletBalance: String(newBalance) })
    .where(eq(customersTable.id, id));

  const [tx] = await db.insert(walletTransactionsTable).values({
    customerId: id,
    type: "credit",
    amount: String(amt),
    balanceAfter: String(newBalance),
    description,
    reference: reference ?? null,
  }).returning();

  res.status(201).json({
    ...tx,
    amount: parseFloat(String(tx.amount)),
    balanceAfter: parseFloat(String(tx.balanceAfter)),
    createdAt: tx.createdAt.toISOString(),
    walletBalance: newBalance,
  });
});

router.post("/customers/:id/wallet/debit", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { amount, description, reference } = req.body;
  const amt = parseFloat(String(amount ?? 0));
  if (!amt || amt <= 0) { res.status(400).json({ error: "Amount must be positive" }); return; }
  if (!description) { res.status(400).json({ error: "Description required" }); return; }

  const [customer] = await db.select({ walletBalance: customersTable.walletBalance })
    .from(customersTable).where(eq(customersTable.id, id));
  if (!customer) { res.status(404).json({ error: "Not found" }); return; }

  const prev = parseFloat(String(customer.walletBalance ?? "0"));
  if (amt > prev) { res.status(400).json({ error: "Insufficient wallet balance" }); return; }

  const newBalance = prev - amt;

  await db.update(customersTable)
    .set({ walletBalance: String(newBalance) })
    .where(eq(customersTable.id, id));

  const [tx] = await db.insert(walletTransactionsTable).values({
    customerId: id,
    type: "debit",
    amount: String(amt),
    balanceAfter: String(newBalance),
    description,
    reference: reference ?? null,
  }).returning();

  res.status(201).json({
    ...tx,
    amount: parseFloat(String(tx.amount)),
    balanceAfter: parseFloat(String(tx.balanceAfter)),
    createdAt: tx.createdAt.toISOString(),
    walletBalance: newBalance,
  });
});

// ── Ledger ──────────────────────────────────────────────────────────────────

router.get("/customers/:id/ledger", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const entries = await db.select().from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.customerId, id))
    .orderBy(ledgerEntriesTable.date);
  const mapped = entries.map(e => ({
    ...e,
    date: e.date.toISOString(),
    debit: parseFloat(String(e.debit)),
    credit: parseFloat(String(e.credit)),
    balance: parseFloat(String(e.balance)),
    reference: e.reference ?? null,
    createdAt: e.createdAt.toISOString(),
  }));
  const totalDebit  = mapped.reduce((s, e) => s + e.debit, 0);
  const totalCredit = mapped.reduce((s, e) => s + e.credit, 0);
  res.json({ entries: mapped, totalDebit, totalCredit, balance: totalDebit - totalCredit });
});

router.post("/customers/:id/ledger", async (req, res): Promise<void> => {
  const customerId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { date, type, description, reference, debit, credit } = req.body;
  if (!description || !type) { res.status(400).json({ error: "type and description required" }); return; }

  const lastEntries = await db.select({ balance: ledgerEntriesTable.balance })
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.customerId, customerId))
    .orderBy(ledgerEntriesTable.date)
    .limit(1000);
  const prevBalance = lastEntries.length
    ? parseFloat(String(lastEntries[lastEntries.length - 1].balance))
    : 0;

  const dr = parseFloat(String(debit ?? 0));
  const cr = parseFloat(String(credit ?? 0));
  const newBalance = prevBalance + dr - cr;

  const [entry] = await db.insert(ledgerEntriesTable).values({
    customerId,
    date: date ? new Date(date) : new Date(),
    type,
    description,
    reference: reference ?? null,
    debit: String(dr),
    credit: String(cr),
    balance: String(newBalance),
  }).returning();

  await db.update(customersTable)
    .set({ ledgerBalance: String(newBalance) })
    .where(eq(customersTable.id, customerId));

  res.status(201).json({
    ...entry,
    date: entry.date.toISOString(),
    debit: dr, credit: cr, balance: newBalance,
    reference: entry.reference ?? null,
    createdAt: entry.createdAt.toISOString(),
  });
});

/**
 * POST /customers/:id/email
 * Send a custom alert/message to a customer by email.
 */
router.post("/customers/:id/email", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { subject, message } = req.body;
  if (!subject || !message) { res.status(400).json({ error: "subject and message are required" }); return; }
  const [cust] = await db.select({ name: customersTable.name, email: customersTable.email }).from(customersTable).where(eq(customersTable.id, id));
  if (!cust) { res.status(404).json({ error: "Customer not found" }); return; }
  if (!cust.email) { res.status(400).json({ error: "Customer has no email address on file" }); return; }
  const sent = await sendCustomerAlert({ customerName: cust.name, customerEmail: cust.email, subject, message });
  if (sent) {
    res.json({ ok: true, sentTo: cust.email });
  } else {
    res.status(500).json({ error: "Failed to send email — check email integration in Settings" });
  }
});

export default router;
