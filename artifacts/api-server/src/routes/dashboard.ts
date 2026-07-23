import { Router, type IRouter } from "express";
import { db, invoicesTable, inventoryItemsTable, customersTable, webOrdersTable, chatSessionsTable, brandsTable, deviceModelsTable } from "@workspace/db";
import { count, sum, eq, and, gte, sql, lte, or, inArray } from "drizzle-orm";
import { sendLowStockAlert } from "../lib/mailer";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const [stockCount] = await db
    .select({ count: count() })
    .from(inventoryItemsTable)
    .where(eq(inventoryItemsTable.status, "in_stock"));

  const [customerCount] = await db.select({ count: count() }).from(customersTable);

  const [pendingOrders] = await db
    .select({ count: count() })
    .from(webOrdersTable)
    .where(eq(webOrdersTable.status, "new"));

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
  const todaySalesResult = await db
    .select({ total: sum(invoicesTable.total) })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.status, "paid"), sql`date(${invoicesTable.date}) = ${today}`));

  // Overdue = explicitly marked 'overdue' OR past due date and not yet settled
  const [overdueResult] = await db
    .select({ total: count() })
    .from(invoicesTable)
    .where(
      or(
        eq(invoicesTable.status, "overdue"),
        and(
          sql`${invoicesTable.dueDate} IS NOT NULL`,
          sql`${invoicesTable.dueDate}::date < CURRENT_DATE`,
          inArray(invoicesTable.status, ["pending", "partial", "unpaid"]),
        ),
      ),
    );

  const [ptaCount] = await db
    .select({ count: count() })
    .from(inventoryItemsTable)
    .where(eq(inventoryItemsTable.ptaStatus, "pending"));

  const [chatCount] = await db
    .select({ count: count() })
    .from(chatSessionsTable)
    .where(eq(chatSessionsTable.status, "open"));

  res.json({
    totalProductsInStock: stockCount.count,
    totalSalesToday: parseFloat(String(todaySalesResult[0]?.total ?? "0")),
    totalOrdersPending: pendingOrders.count,
    totalOverdueInvoices: overdueResult?.total ?? 0,
    totalCustomers: customerCount.count,
    lowStockCount: 0,
    ptaPendingCount: ptaCount.count,
    unreadChats: chatCount.count,
    totalInvoicesOutstanding: 0,
    totalInvoicesOverdue: overdueResult?.total ?? 0,
  });
});

router.get("/dashboard/revenue", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${invoicesTable.date}::date), 'Mon')`,
      revenue: sum(invoicesTable.total),
      orders: count(),
    })
    .from(invoicesTable)
    .where(sql`${invoicesTable.date}::date >= now() - interval '6 months'`)
    .groupBy(sql`date_trunc('month', ${invoicesTable.date}::date)`)
    .orderBy(sql`date_trunc('month', ${invoicesTable.date}::date)`);

  res.json(rows.map(r => ({
    label: r.month,
    revenue: parseFloat(String(r.revenue ?? "0")),
    orders: r.orders,
  })));
});

router.get("/dashboard/recent-sales", async (req, res): Promise<void> => {
  const invoices = await db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      amount: invoicesTable.total,
      status: invoicesTable.status,
      date: invoicesTable.date,
      customerId: invoicesTable.customerId,
    })
    .from(invoicesTable)
    .orderBy(sql`${invoicesTable.createdAt} desc`)
    .limit(10);

  const { customersTable: ct } = await import("@workspace/db");
  const results = await Promise.all(
    invoices.map(async (inv) => {
      const [cust] = await db
        .select({ name: ct.name })
        .from(ct)
        .where(eq(ct.id, inv.customerId));
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: cust?.name ?? "Unknown",
        amount: parseFloat(String(inv.amount)),
        status: inv.status,
        date: String(inv.date),
      };
    })
  );

  res.json(results);
});

/**
 * POST /dashboard/alerts/low-stock
 * Email admin a low-stock report. Threshold defaults to 2 units.
 */
router.post("/dashboard/alerts/low-stock", async (req, res): Promise<void> => {
  const threshold = parseInt(String(req.body?.threshold ?? "2"), 10);

  const rows = await db
    .select({
      brandName: brandsTable.name,
      modelName: deviceModelsTable.name,
      inStock: count(),
    })
    .from(inventoryItemsTable)
    .leftJoin(brandsTable, eq(inventoryItemsTable.brandId, brandsTable.id))
    .leftJoin(deviceModelsTable, eq(inventoryItemsTable.modelId, deviceModelsTable.id))
    .where(eq(inventoryItemsTable.status, "in_stock"))
    .groupBy(brandsTable.name, deviceModelsTable.name)
    .having(lte(count(), threshold));

  if (rows.length === 0) {
    res.json({ ok: true, message: "No low-stock items found — nothing to send", count: 0 });
    return;
  }

  const items = rows.map(r => ({
    brand: r.brandName ?? "Unknown",
    model: r.modelName ?? "Unknown",
    inStockCount: r.inStock,
  }));

  const sent = await sendLowStockAlert(items);
  if (sent) {
    res.json({ ok: true, count: items.length, message: `Low-stock alert sent for ${items.length} item(s)` });
  } else {
    res.status(500).json({ error: "Failed to send email — check email integration in Settings" });
  }
});

export default router;
