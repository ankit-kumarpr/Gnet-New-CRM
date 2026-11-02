const nodemailer = require("nodemailer");

const escapeHtml = (value) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const crmLink = () => (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

const smtpUser = () => String(process.env.SMTP_USER || "").trim();
const smtpPass = () => String(process.env.SMTP_PASS || "").replace(/\s/g, "");

const missingSmtp = () => {
    const missing = [];
    if (!String(process.env.SMTP_HOST || "").trim()) missing.push("SMTP_HOST");
    if (!smtpUser()) missing.push("SMTP_USER");
    if (!smtpPass()) missing.push("SMTP_PASS");
    return missing;
};

const createTransport = () => {
    const port = Number(process.env.SMTP_PORT) || 587;
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: {
            user: smtpUser(),
            pass: smtpPass(),
        },
    });
};

const sendEmployeeWelcome = async ({
    name,
    email,
    password,
    employeeId,
    companyName,
    designationName,
}) => {
    const missing = missingSmtp();
    if (missing.length) {
        return { sent: false, reason: `SMTP is not configured (${missing.join(", ")} missing). Restart the server after saving .env` };
    }
    if (!email) {
        return { sent: false, reason: "Employee email is missing" };
    }

    const company = companyName || "our company";
    const link = crmLink();
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePassword = escapeHtml(password);
    const safeId = escapeHtml(employeeId || "");
    const safeLink = escapeHtml(link);
    const safeCompany = escapeHtml(company);
    const safeRole = escapeHtml(designationName || "Employee");

    try {
        const transporter = createTransport();
        await transporter.sendMail({
            from: process.env.MAIL_FROM || smtpUser(),
            to: email,
            subject: `Welcome to ${company} — your login details`,
            text: [
                `Hi ${name},`,
                "",
                `Welcome to ${company}. Your employee account is ready.`,
                ...(designationName ? [`Role: ${designationName}`, ""] : [""]),
                `Employee ID: ${employeeId || "—"}`,
                `Login email: ${email}`,
                `Password: ${password}`,
                "",
                `Open the CRM: ${link}`,
                "",
                "Sign in with your email and password. Keep these details private.",
                "",
                "Warm regards,",
                company,
            ].join("\n"),
            html: `
                <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:640px;margin:0 auto;">
                  <p>Hi ${safeName},</p>
                  <p>Welcome to <strong>${safeCompany}</strong>. Your employee account is ready${designationName ? ` as <strong>${safeRole}</strong>` : ""}.</p>
                  <p style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px 16px;">
                    <strong>Employee ID:</strong> ${safeId || "—"}<br/>
                    <strong>Login email:</strong> ${safeEmail}<br/>
                    <strong>Password:</strong> ${safePassword}
                  </p>
                  <p><a href="${safeLink}" style="display:inline-block;background:#047857;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Open CRM login</a></p>
                  <p>Or copy this link: <a href="${safeLink}">${safeLink}</a></p>
                  <p>Sign in with your <strong>email</strong> and the password above. Keep these details private.</p>
                  <p style="margin-top:24px;">Warm regards,<br/><strong>${safeCompany}</strong></p>
                </div>
            `,
        });
        return { sent: true };
    } catch (error) {
        return { sent: false, reason: error.message || "Failed to send welcome mail" };
    }
};

const sendOfferLetter = async ({ name, email, companyName, refNumber, pdf }) => {
    const missing = missingSmtp();
    if (missing.length) {
        return { sent: false, reason: `SMTP is not configured (${missing.join(", ")} missing). Restart the server after saving .env` };
    }

    const company = companyName || "CRM";
    const safeName = escapeHtml(name);
    const safeCompany = escapeHtml(company);
    const safeRef = escapeHtml(refNumber);
    const filename = `Joining-Letter-${String(refNumber).replace(/\//g, "-")}.pdf`;

    const transporter = createTransport();
    await transporter.sendMail({
        from: process.env.MAIL_FROM || smtpUser(),
        to: email,
        subject: `Joining letter ${refNumber} — ${company}`,
        text: [
            `Hi ${name},`,
            "",
            `Please find your joining letter from ${company} attached.`,
            `Reference: ${refNumber}`,
            "",
            "Open the PDF for the appointment details.",
        ].join("\n"),
        html: `
            <p>Hi ${safeName},</p>
            <p>Please find your joining letter from <strong>${safeCompany}</strong> attached.</p>
            <p>Reference: ${safeRef}</p>
            <p>Open the PDF for the appointment details.</p>
        `,
        attachments: [{
            filename,
            content: pdf,
            contentType: "application/pdf",
        }],
    });

    return { sent: true };
};

const sendInterviewRejection = async ({
    name,
    email,
    role,
    companyName,
}) => {
    const missing = missingSmtp();
    if (missing.length) {
        return { sent: false, reason: `SMTP is not configured (${missing.join(", ")} missing). Restart the server after saving .env` };
    }
    if (!email) {
        return { sent: false, reason: "Candidate email is missing" };
    }

    const company = companyName || "our company";
    const safeName = escapeHtml(name);
    const safeCompany = escapeHtml(company);
    const safeRole = escapeHtml(role || "the position");

    try {
        const transporter = createTransport();
        await transporter.sendMail({
            from: process.env.MAIL_FROM || smtpUser(),
            to: email,
            subject: `Update on your application for ${role || "the role"} — ${company}`,
            text: [
                `Dear ${name},`,
                "",
                `Thank you for taking the time to interview with ${company} for the ${role || "role"} position.`,
                "",
                "After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current requirements.",
                "",
                "This decision was not easy. We genuinely appreciate your interest in joining us and the effort you put into the interview process.",
                "",
                "We wish you every success in your career and hope our paths may cross again in the future.",
                "",
                "Warm regards,",
                "Talent Acquisition Team",
                company,
            ].join("\n"),
            html: `
                <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:640px;margin:0 auto;">
                  <p>Dear ${safeName},</p>
                  <p>Thank you for taking the time to interview with <strong>${safeCompany}</strong> for the <strong>${safeRole}</strong> position.</p>
                  <p>After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current requirements.</p>
                  <p>This decision was not easy. We genuinely appreciate your interest in joining us and the effort you put into the interview process.</p>
                  <p>We wish you every success in your career and hope our paths may cross again in the future.</p>
                  <p style="margin-top:24px;">Warm regards,<br/><strong>Talent Acquisition Team</strong><br/>${safeCompany}</p>
                </div>
            `,
        });
        return { sent: true };
    } catch (error) {
        return { sent: false, reason: error.message || "Failed to send rejection mail" };
    }
};

const sendClientWelcome = async ({
    name,
    email,
    clientId,
    password,
    companyName,
    reportingManagerName,
}) => {
    const missing = missingSmtp();
    if (missing.length) {
        return { sent: false, reason: `SMTP is not configured (${missing.join(", ")} missing). Restart the server after saving .env` };
    }
    if (!email) {
        return { sent: false, reason: "Client email is missing" };
    }

    const company = companyName || "our company";
    const link = crmLink();
    const safeName = escapeHtml(name);
    const safeCompany = escapeHtml(company);
    const safeId = escapeHtml(clientId);
    const safePass = escapeHtml(password);
    const safeLink = escapeHtml(link);
    const safeManager = escapeHtml(reportingManagerName || "your reporting manager");

    try {
        const transporter = createTransport();
        await transporter.sendMail({
            from: process.env.MAIL_FROM || smtpUser(),
            to: email,
            subject: `Welcome to ${company} — your client login`,
            text: [
                `Dear ${name},`,
                "",
                `Welcome to ${company}. Your client account is ready.`,
                "",
                `Client ID: ${clientId}`,
                `Password: ${password}`,
                "",
                `Login here (same portal as staff): ${link}`,
                "",
                "Enter your Client ID in the email field, and use the same Client ID as your password.",
                "",
                `Your reporting manager: ${reportingManagerName || "Assigned shortly"}`,
                "",
                "Warm regards,",
                company,
            ].join("\n"),
            html: `
                <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:640px;margin:0 auto;">
                  <p>Dear ${safeName},</p>
                  <p>Welcome to <strong>${safeCompany}</strong>. Your client account is ready.</p>
                  <p><strong>Client ID:</strong> ${safeId}<br/>
                  <strong>Password:</strong> ${safePass}</p>
                  <p>Use the same login page as staff. Enter your <strong>Client ID</strong> in the email field and the same Client ID as password.</p>
                  <p><a href="${safeLink}" style="display:inline-block;background:#047857;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Open login</a></p>
                  <p>Or copy this link: <a href="${safeLink}">${safeLink}</a></p>
                  <p><strong>Your reporting manager:</strong> ${safeManager}</p>
                  <p style="margin-top:24px;">Warm regards,<br/><strong>${safeCompany}</strong></p>
                </div>
            `,
        });
        return { sent: true };
    } catch (error) {
        return { sent: false, reason: error.message || "Failed to send welcome mail" };
    }
};

module.exports = { sendEmployeeWelcome, sendOfferLetter, sendInterviewRejection, sendClientWelcome };
