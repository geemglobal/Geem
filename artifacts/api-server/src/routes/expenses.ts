import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte, ilike, sql, sum, getTableColumns } from "drizzle-orm";
import { db, expensesTable, expenseCategoriesTable, usersTable } from "@workspace/db";
import { logActivity } from "./activity";

const router: IRouter = Router();

function mapExpense(e: typeof expensesTable.$inferSelect & { categoryName?: string | null; createdByName?: string | null }) {
  return {
    ...e,
    amount: parseFloat(String(e.amount)),
    date: e.date instanceof Date ? e.date.toISOString() : e.date,
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
    categoryId: e.categoryId ?? null,
    reference: e.reference ?? null,
    vendor: e.vendor ?? null,
    notes: e.notes ?? null,
    categoryName: e.categoryName ?? null,
    createdByName: e.createdByName ?? null,
  };
}

// ── Categories ────────────────────────────────────────────────────────────────

router.get("/expense-categories", async (req, res): Promise<void> => {
  const cats = await db.select().from(expenseCategoriesTable).orderBy(expenseCategoriesTable.name);
  res.json(cats.map(c => ({ ...c, description: c.description ?? null, createdAt: c.createdAt.toISOString() })));
});

router.post("/expense-categories", async (req, res): Promise<void> => {
  const { name, description } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [cat] = await db.insert(expenseCategoriesTable).values({ name, description }).returning();
  res.status(201).json({ ...cat, description: cat.description ?? null, createdAt: cat.createdAt.toISOString() });
});

router.patch("/expense-categories/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { name, description } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  const [cat] = await db.update(expenseCategoriesTable).set(updates).where(eq(expenseCategoriesTable.id, id)).returning();
  if (!cat) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...cat, description: cat.description ?? null, createdAt: cat.createdAt.toISOString() });
});

router.delete("/expense-categories/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(expenseCategoriesTable).where(eq(expenseCategoriesTable.id, id));
  res.sendStatus(204);
});

// ── Expenses ──────────────────────────────────────────────────────────────────

router.get("/expenses", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10), 500);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);
  const search = String(req.query.search ?? "").trim();
  const categoryId = req.query.categoryId ? parseInt(String(req.query.categoryId), 10) : null;
  const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : null;
  const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : null;
  const paymentMethod = String(req.query.paymentMethod ?? "").trim();

  const conditions = [];
  if (search) conditions.push(ilike(expensesTable.description, `%${search}%`));
  if (categoryId) conditions.push(eq(expensesTable.categoryId, categoryId));
  if (dateFrom) conditions.push(gte(expensesTable.date, dateFrom));
  if (dateTo) conditions.push(lte(expensesTable.date, dateTo));
  if (paymentMethod) conditions.push(eq(expensesTable.paymentMethod, paymentMethod));

  const where = conditions.length ? and(...conditions) : undefined;

  const [totals] = await db
    .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
    .from(expensesTable)
    .where(where);

  const expenses = await db
    .select({
      ...getTableColumns(expensesTable),
      categoryName: expenseCategoriesTable.name,
      createdByName: usersTable.name,
    })
    .from(expensesTable)
    .leftJoin(expenseCategoriesTable, eq(expensesTable.categoryId, expenseCategoriesTable.id))
    .leftJoin(usersTable, eq(expensesTable.createdBy, usersTable.id))
    .where(where)
    .orderBy(desc(expensesTable.date))
    .limit(limit)
    .offset(offset);

  // Monthly summary
  const monthlyTotals = await db
    .select({
      month: sql<string>`TO_CHAR(date, 'YYYY-MM')`,
      total: sum(expensesTable.amount),
    })
    .from(expensesTable)
    .groupBy(sql`TO_CHAR(date, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(date, 'YYYY-MM') DESC`)
    .limit(12);

  res.json({
    expenses: expenses.map(e => mapExpense(e as Parameters<typeof mapExpense>[0])),
    total: parseFloat(String(totals.total ?? 0)),
    monthlyTotals,
  });
});

router.post("/expenses", async (req, res): Promise<void> => {
  const { date, categoryId, amount, description, reference, paymentMethod, vendor, notes } = req.body;
  if (!date || !amount || !description) {
    res.status(400).json({ error: "date, amount, description required" }); return;
  }
  const userId = res.locals.userId as number | undefined;
  const [expense] = await db.insert(expensesTable).values({
    date: new Date(String(date)),
    categoryId: categoryId ? parseInt(String(categoryId), 10) : null,
    amount: String(parseFloat(String(amount))),
    description, reference, paymentMethod: paymentMethod ?? "cash", vendor, notes,
    createdBy: userId ?? null,
  }).returning();

  void logActivity({ userId, action: "create", entity: "expense", entityId: expense.id, details: `${description} — Rs ${amount}` });
  res.status(201).json(mapExpense(expense as Parameters<typeof mapExpense>[0]));
});

router.get("/expenses/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const [expense] = await db
    .select({ ...getTableColumns(expensesTable), categoryName: expenseCategoriesTable.name, createdByName: usersTable.name })
    .from(expensesTable)
    .leftJoin(expenseCategoriesTable, eq(expensesTable.categoryId, expenseCategoriesTable.id))
    .leftJoin(usersTable, eq(expensesTable.createdBy, usersTable.id))
    .where(eq(expensesTable.id, id));
  if (!expense) { res.status(404).json({ error: "Not found" }); return; }
  res.json(mapExpense(expense as Parameters<typeof mapExpense>[0]));
});

router.patch("/expenses/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const fields = ["date", "categoryId", "amount", "description", "reference", "paymentMethod", "vendor", "notes"];
  const updates: Record<string, unknown> = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      if (f === "date") updates[f] = new Date(String(req.body[f]));
      else if (f === "amount") updates[f] = String(parseFloat(String(req.body[f])));
      else if (f === "categoryId") updates[f] = req.body[f] ? parseInt(String(req.body[f]), 10) : null;
      else updates[f] = req.body[f];
    }
  }
  const [expense] = await db.update(expensesTable).set(updates).where(eq(expensesTable.id, id)).returning();
  if (!expense) { res.status(404).json({ error: "Not found" }); return; }
  res.json(mapExpense(expense as Parameters<typeof mapExpense>[0]));
});

router.delete("/expenses/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(expensesTable).where(eq(expensesTable.id, id));
  res.sendStatus(204);
});

export default router;
