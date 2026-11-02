const Client = require("../models/Client");
const { notify } = require("./notify");

const startOfDay = (value = new Date()) => {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
};

const endOfDay = (value = new Date()) => {
    const d = new Date(value);
    d.setHours(23, 59, 59, 999);
    return d;
};

const moneyLabel = (amount) => {
    if (amount === null || amount === undefined) return "amount TBD";
    const n = Number(amount);
    if (!Number.isFinite(n)) return "amount TBD";
    return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const dateLabel = (value) => {
    try {
        return new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }).format(new Date(value));
    } catch {
        return "";
    }
};

/**
 * Unpaid renewal rows whose date is within the next 5 days (inclusive) or already overdue.
 * i.e. notify from (renewalDate - 5 days) until marked paid.
 */
const isInReminderWindow = (paymentDate, today = startOfDay()) => {
    if (!paymentDate) return false;
    const due = startOfDay(paymentDate);
    if (Number.isNaN(due.getTime())) return false;
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + 5);
    windowEnd.setHours(23, 59, 59, 999);
    return due.getTime() <= windowEnd.getTime();
};

const sameDay = (a, b) => {
    if (!a || !b) return false;
    const x = startOfDay(a);
    const y = startOfDay(b);
    return x.getTime() === y.getTime();
};

/**
 * Create one stored notification per unpaid due payment per calendar day.
 * Safe to call often — skips rows already reminded today.
 */
const runClientPaymentReminders = async () => {
    const today = startOfDay();
    const windowEnd = endOfDay(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000));

    const clients = await Client.find({
        payments: {
            $elemMatch: {
                paid: { $ne: true },
                date: { $lte: windowEnd },
            },
        },
    })
        .select("name clientId email phone payments reportingManager")
        .lean();

    let created = 0;
    for (const client of clients) {
        const unpaid = (client.payments || []).filter(
            (row) => !row.paid && isInReminderWindow(row.date, today),
        );
        for (const row of unpaid) {
            if (sameDay(row.lastRemindedOn, today)) continue;

            const daysLeft = Math.ceil((startOfDay(row.date) - today) / (24 * 60 * 60 * 1000));
            const when =
                daysLeft < 0
                    ? `overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"}`
                    : daysLeft === 0
                        ? "due today"
                        : `due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;

            await notify({
                type: "CLIENT_PAYMENT_DUE",
                title: `Renewal payment ${when}: ${client.name}`,
                body: `${dateLabel(row.date)} · ${moneyLabel(row.amount)}${row.note ? ` · ${row.note}` : ""}`,
                href: `/dashboard/clients/${client._id}`,
                extraUserIds: client.reportingManager ? [client.reportingManager] : [],
                meta: {
                    clientId: String(client._id),
                    paymentId: String(row._id),
                    dueDate: row.date,
                },
            });

            await Client.updateOne(
                { _id: client._id, "payments._id": row._id },
                { $set: { "payments.$.lastRemindedOn": today } },
            );
            created += 1;
        }
    }

    return { created, checked: clients.length };
};

/**
 * Schedule daily reminders without node-cron:
 * run shortly after boot, then every hour (only creates once per day per payment).
 */
const startClientPaymentReminderJob = () => {
    const tick = async () => {
        try {
            const result = await runClientPaymentReminders();
            if (result.created > 0) {
                console.log(`[payment-reminders] created ${result.created} notification(s)`);
            }
        } catch (error) {
            console.error("[payment-reminders] failed:", error.message);
        }
    };

    setTimeout(tick, 20_000).unref?.();
    setInterval(tick, 60 * 60 * 1000).unref?.();
};

module.exports = {
    runClientPaymentReminders,
    startClientPaymentReminderJob,
    isInReminderWindow,
    startOfDay,
    endOfDay,
};
