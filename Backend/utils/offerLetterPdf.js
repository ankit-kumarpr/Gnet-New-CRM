const http = require("http");
const https = require("https");
const PDFDocument = require("pdfkit");

const fetchBuffer = (url, hops = 0) => new Promise((resolve, reject) => {
    if (!url || hops > 3) return resolve(null);
    const lib = String(url).startsWith("https") ? https : http;
    const request = lib.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return resolve(fetchBuffer(res.headers.location, hops + 1));
        }
        if (res.statusCode !== 200) {
            res.resume();
            return resolve(null);
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", () => resolve(null));
    });
    request.on("error", () => resolve(null));
    request.setTimeout(8000, () => {
        request.destroy();
        resolve(null);
    });
});

const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${date.getFullYear()}`;
};

const addressLine = (address) => {
    if (!address) return "—";
    const line = [address.street, address.locality, address.landmark, address.city, address.state, address.pincode]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(", ");
    return line || "—";
};

const money = (value) => {
    if (value === 0 || value) return `Rs. ${Number(value).toLocaleString("en-IN")}`;
    return "—";
};

const show = (value) => {
    const text = String(value || "").trim();
    return text || "—";
};

const buildOfferLetterPdf = async ({ employee, setting, letter }) => {
    const logo = await fetchBuffer(setting.logoUrl);
    const company = show(setting.companyName) === "—" ? "Company" : setting.companyName.trim();
    const designation = employee.designation?.name || "Employee";
    const joining = formatDate(employee.joiningDate);
    const rows = [
        ["Employee Name", employee.name],
        ["Employee Address", addressLine(employee.address)],
        ["Contact Number", employee.phone],
        ["Email Address", employee.email],
        ["Designation", designation],
        ["Department", employee.department?.name],
        ["Date of Joining", joining],
        ["Employment Type", employee.employeeType?.name],
        ["Work Location", employee.workMode?.name],
        ["Reporting Manager", employee.reportingManager?.name],
        ["Monthly Salary", money(employee.salary)],
        ["Probation Period", setting.probationPeriod || "As per company policy"],
        ["Working Hours", setting.workingHours || "As per company policy"],
    ];
    const terms = [
        ["Employment", "Your duties and responsibilities will be assigned according to your designation and organizational requirements."],
        ["Confidentiality", "You must maintain strict confidentiality regarding company data, client information, business processes, and intellectual property."],
        ["Attendance & Leave", "Working hours, attendance, holidays, and leave shall be governed by company policies and applicable law."],
        ["Performance", "Your performance will be reviewed periodically based on your responsibilities, targets, and professional conduct."],
        ["Notice Period", "Resignation or termination will be governed by your appointment terms and applicable law."],
        ["Company Property", "All company equipment, documents, credentials, and confidential materials must be returned upon separation."],
    ];

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margins: { top: 36, bottom: 24, left: 46, right: 46 } });
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const left = 46;
        const width = 503;
        const pageBottom = 790;
        let y = 36;
        let pages = 1;
        const nextPage = () => {
            if (pages >= 2) return false;
            doc.addPage();
            pages += 1;
            y = 40;
            return true;
        };

        if (logo) {
            try {
                doc.image(logo, left, y, { fit: [52, 52] });
            } catch {
                // A bad image should not stop the letter.
            }
        }
        doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(14).text(company, left + 64, y + 4, { width: width - 64 });
        const contact = [setting.companyAddress, setting.companyEmail, setting.companyPhone, setting.companyWebsite]
            .map((part) => String(part || "").trim())
            .filter(Boolean)
            .join("  |  ");
        if (contact) {
            doc.font("Helvetica").fontSize(8).fillColor("#475569").text(contact, left + 64, y + 26, { width: width - 64 });
        }
        y = 100;
        doc.moveTo(left, y).lineTo(left + width, y).strokeColor("#0f172a").lineWidth(1).stroke();
        y += 12;

        doc.font("Helvetica").fontSize(10).fillColor("#0f172a");
        doc.text(`Ref: ${letter.refNumber}`, left, y, { width: 280 });
        doc.text(`Date: ${formatDate(letter.createdAt)}`, left + 280, y, { width: width - 280, align: "right" });
        y += 20;

        doc.font("Helvetica-Bold").fontSize(12).text("EMPLOYEE JOINING LETTER", left, y, { width, align: "center" });
        y += 20;

        doc.font("Helvetica").fontSize(10);
        doc.text("To,", left, y);
        y += 14;
        doc.font("Helvetica-Bold").text(employee.name, left, y);
        y += 14;
        doc.font("Helvetica").text(addressLine(employee.address), left, y, { width });
        y = doc.y + 2;
        doc.text(`Contact: ${show(employee.phone)}    Email: ${show(employee.email)}`, left, y, { width });
        y = doc.y + 12;

        doc.font("Helvetica-Bold").text(`Subject: Confirmation of Joining — ${designation}`, left, y, { width });
        y = doc.y + 10;
        doc.font("Helvetica").text(`Dear ${employee.name},`, left, y);
        y = doc.y + 8;
        doc.text(
            `We are pleased to welcome you to ${company}. This letter confirms your joining and the terms of your appointment.`,
            left,
            y,
            { width, align: "justify" }
        );
        y = doc.y + 12;

        doc.font("Helvetica-Bold").fontSize(11).text("Employment Details", left, y);
        y = doc.y + 8;
        doc.font("Helvetica").fontSize(8);
        rows.forEach(([label, value]) => {
            const text = show(value);
            const height = Math.min(32, Math.max(16, doc.heightOfString(text, { width: 310 }) + 6));
            if (y + height > pageBottom) nextPage();
            doc.rect(left, y, 160, height).fillAndStroke("#f8fafc", "#cbd5e1");
            doc.rect(left + 160, y, width - 160, height).strokeColor("#cbd5e1").stroke();
            doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8).text(label, left + 6, y + 4, { width: 148, height: height - 6 });
            doc.font("Helvetica").text(text, left + 168, y + 4, { width: 310, height: height - 6 });
            y += height;
        });

        y += 12;
        if (y > 560) nextPage();
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text("Terms & Conditions", left, y);
        y = doc.y + 8;
        terms.forEach(([title, body], index) => {
            const prefix = `${index + 1}. ${title}: `;
            doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a");
            doc.text(prefix, left, y, { continued: true, width });
            doc.font("Helvetica").text(body, { width, align: "justify" });
            y = doc.y + 4;
        });

        y += 6;
        doc.font("Helvetica").fontSize(10).text("We look forward to a successful and rewarding professional association.", left, y, { width });
        y = doc.y + 14;
        doc.text(`For ${company}`, left, y);
        y = doc.y + 28;
        doc.moveTo(left, y).lineTo(left + 170, y).strokeColor("#0f172a").stroke();
        y += 4;
        doc.font("Helvetica-Bold").fontSize(10).text(show(setting.signatoryName) === "—" ? "Authorised Signatory" : setting.signatoryName, left, y);
        y = doc.y + 2;
        doc.font("Helvetica").fontSize(9).text(setting.signatoryTitle || "Authorised Signatory", left, y);
        y = doc.y + 14;

        doc.font("Helvetica-Bold").fontSize(11).text("Employee Acknowledgement", left, y);
        y = doc.y + 6;
        doc.font("Helvetica").fontSize(9).text(
            `I, ${employee.name}, confirm my joining on ${joining} and acknowledge the employment details and company policies.`,
            left,
            y,
            { width }
        );
        y = doc.y + 16;
        doc.fontSize(10).text("Employee signature: ____________________", left, y, { continued: false });
        doc.text("Date: ____________________", left + 280, y);
        y = doc.y + 14;
        doc.text("HR signature: ____________________", left, y);

        const footer = [company, setting.companyAddress, setting.companyEmail, setting.companyWebsite].filter(Boolean).join("  ·  ");
        doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(footer, left, 800, { width, align: "center", lineBreak: false });

        doc.end();
    });
};

module.exports = { buildOfferLetterPdf };
