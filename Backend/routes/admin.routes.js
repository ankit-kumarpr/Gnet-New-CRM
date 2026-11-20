const express = require("express");
const router = express.Router();

const { createEmployee, getEmployees, getEmployeeById, updateEmployee, changeEmployeeStatus, deleteEmployee, updateUserPermissions, parseEmployeePayload } = require("../controllers/admin.controller");
const {
    createDepartment,
    getDepartments,
    getDepartmentById,
    updateDepartment,
    changeDepartmentStatus,
    deleteDepartment
} = require("../controllers/department.controller");
const {
    createDesignation,
    getDesignations,
    getDesignationById,
    getDesignationsByDepartment,
    updateDesignation,
    changeDesignationStatus,
    deleteDesignation
} = require("../controllers/designation.controller");
const {
    createEmployeeType,
    getEmployeeTypes,
    getEmployeeTypeById,
    updateEmployeeType,
    changeEmployeeTypeStatus,
    deleteEmployeeType
} = require("../controllers/employeeType.controller");
const {
    createWorkMode,
    getWorkModes,
    getWorkModeById,
    updateWorkMode,
    changeWorkModeStatus,
    deleteWorkMode
} = require("../controllers/workMode.controller");
const {
    createLeaveType,
    getLeaveTypes,
    getLeaveTypeById,
    updateLeaveType,
    changeLeaveTypeStatus,
    deleteLeaveType
} = require("../controllers/leaveType.controller");
const {
    createLeaveAssignment,
    saveLeaveAssignments,
    getLeaveAssignments,
    getLeaveAssignmentById,
    updateLeaveAssignment,
    deleteLeaveAssignment
} = require("../controllers/leaveAssignment.controller");
const {
    createService,
    getServices,
    getServiceById,
    updateService,
    deleteService
} = require("../controllers/service.controller");
const {
    createClient,
    getClients,
    getClientById,
    updateClient,
    deleteClient,
    updateClientPermissions,
    markClientPaymentPaid,
    exportClientPayments,
    downloadClientSample,
    importClients,
} = require("../controllers/client.controller");
const {
    getPlanDefaults,
    getPlanEmployees,
    listClientPlans,
    listProjectPlans,
    getPlanById,
    createPlan,
    updatePlan,
    updateProgress,
    updateSlot,
    deletePlan,
    getDailyPlanBoard,
    getDailyPlanAlerts,
    exportDailyPlanBoard,
} = require("../controllers/clientWorkPlan.controller");
const {
    createLead,
    getLeads,
    getLeadById,
    updateLead,
    deleteLead,
    getLeadAssignees,
    assignLead
} = require("../controllers/lead.controller");
const {
    createFollowUp,
    getLeadFollowUps,
    getDueFollowUps
} = require("../controllers/followUp.controller");
const { listSales, listPayments, listRevenue } = require("../controllers/sale.controller");
const { downloadLeadSample, importLeads, exportLeads } = require("../controllers/leadSheet.controller");
const { getReportCatalog, getReport, getReportOptions } = require("../controllers/report.controller");
const { getDashboard } = require("../controllers/dashboard.controller");
const { getAttendance, punchAttendance, attendanceEmployees } = require("../controllers/attendance.controller");
const rateLimit = require("express-rate-limit");
const { registerValidator } = require("../validators/auth.validator");
const validate = require("../middlewares/validate.middleware");
const { receiveEmployeeDocuments, receiveLeaveDocument, receiveTicketFile, receiveResume, receiveLogo, receiveOfferBannerImage, receiveLeadSheet, receiveAttendancePhoto, receiveRingtone, receiveMailAttachments } = require("../config/cloudinary");
const {
    listOfferBanners,
    getOfferBannerById,
    createOfferBanner,
    updateOfferBanner,
    changeOfferBannerStatus,
    deleteOfferBanner,
} = require("../controllers/offerBanner.controller");
const {
    listEmailTemplates,
    getEmailTemplateById,
    createEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
    listMailRecipients,
    sendClientMails,
} = require("../controllers/emailTemplate.controller");
const punchLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `punch:${req.user._id}`,
    message: { success: false, message: "Too many punch attempts. Try again in a few minutes." },
});
const { getSettings, updateSettings, clearSettingField, uploadDefaultRingtone } = require("../controllers/settings.controller");
const {
    getOfferLetter,
    generateOfferLetter,
    downloadOfferLetter,
    sendOfferLetterMail
} = require("../controllers/offerLetter.controller");
const {
    createUrgentWork,
    getUrgentWorks,
    getUrgentWorkOptions,
    getUrgentWorkById,
    updateUrgentWork,
    updateUrgentWorkStatus,
    deleteUrgentWork
} = require("../controllers/urgentWork.controller");
const {
    createDailyTask,
    getDailyTasks,
    getDailyTaskOptions,
    getDailyTaskAlerts,
    getDailyTaskById,
    updateDailyTask,
    updateDailyTaskStatus,
    exportDailyTasks,
    deleteDailyTask
} = require("../controllers/dailyTask.controller");
const {
    getNotificationFeed,
    markNotificationRead,
    markAllNotificationsRead,
} = require("../controllers/notification.controller");
const {
    createTicket,
    getTickets,
    getTicketById,
    replyToTicket,
    updateTicketStatus,
    deleteTicket
} = require("../controllers/ticket.controller");
const {
    listEveningReports,
    listTodayApproved,
    listReportClients,
    createEveningReport,
    getEveningReport,
    updateEveningReport,
    lockEveningReport,
    approveEveningReport,
    unlockEveningReport,
    addEveningFeedback,
    generateNow,
} = require("../controllers/eveningReport.controller");
const {
    listStaffMeetings,
    getMeeting,
    createStaffMeeting,
    approveMeeting,
    rejectMeeting,
    cancelMeeting,
} = require("../controllers/meetRequest.controller");
const {
    createProject,
    getProjects,
    getProjectEmployees,
    getProjectClients,
    getProjectById,
    updateProject,
    updateProjectStatus,
    deleteProject
} = require("../controllers/project.controller");
const {
    createInterview,
    getInterviews,
    getInterviewers,
    getInterviewById,
    updateInterview,
    deleteInterview
} = require("../controllers/interview.controller");
const {
    createLeaveRequest,
    listMine,
    myBalance,
    listQueue,
    updateLeaveRequest,
    deleteLeaveRequest,
    reviewLeaveRequest
} = require("../controllers/leaveRequest.controller");
const { authenticate, authorize, checkPermission } = require("../middlewares/auth.middleware");

router.use(authenticate, authorize("ADMIN", "EMPLOYEE"));

router.post("/employees/create", checkPermission("CREATE_EMPLOYEES", "MANAGE_EMPLOYEES"), receiveEmployeeDocuments, parseEmployeePayload, registerValidator, validate, createEmployee);
router.get("/employees/list", checkPermission("VIEW_EMPLOYEES", "CREATE_EMPLOYEES", "EDIT_EMPLOYEES", "DELETE_EMPLOYEES", "MANAGE_EMPLOYEES"), getEmployees);
router.get("/employees/details/:id", checkPermission("VIEW_EMPLOYEES", "CREATE_EMPLOYEES", "EDIT_EMPLOYEES", "DELETE_EMPLOYEES", "MANAGE_EMPLOYEES"), getEmployeeById);
router.get("/employees/:id/offer-letter", checkPermission("VIEW_EMPLOYEES", "EDIT_EMPLOYEES", "MANAGE_EMPLOYEES"), getOfferLetter);
router.post("/employees/:id/offer-letter", checkPermission("EDIT_EMPLOYEES", "MANAGE_EMPLOYEES"), generateOfferLetter);
router.get("/employees/:id/offer-letter/pdf", checkPermission("VIEW_EMPLOYEES", "EDIT_EMPLOYEES", "MANAGE_EMPLOYEES"), downloadOfferLetter);
router.post("/employees/:id/offer-letter/send", checkPermission("EDIT_EMPLOYEES", "MANAGE_EMPLOYEES"), sendOfferLetterMail);
router.patch("/employees/update/:id", checkPermission("EDIT_EMPLOYEES", "MANAGE_EMPLOYEES"), receiveEmployeeDocuments, parseEmployeePayload, updateEmployee);
router.patch("/employees/status/:id", checkPermission("EDIT_EMPLOYEES", "MANAGE_EMPLOYEES"), changeEmployeeStatus);
router.delete("/employees/:id", checkPermission("DELETE_EMPLOYEES", "MANAGE_EMPLOYEES"), deleteEmployee);
router.put("/users/:id/permissions", checkPermission("MANAGE_PERMISSIONS"), updateUserPermissions);

router.post("/departments/create", checkPermission("CREATE_DEPARTMENTS", "MANAGE_DEPARTMENTS"), createDepartment);
router.get("/departments/list", checkPermission("VIEW_DEPARTMENTS", "CREATE_DEPARTMENTS", "EDIT_DEPARTMENTS", "DELETE_DEPARTMENTS", "MANAGE_DEPARTMENTS"), getDepartments);
router.get("/departments/details/:id", checkPermission("VIEW_DEPARTMENTS", "CREATE_DEPARTMENTS", "EDIT_DEPARTMENTS", "DELETE_DEPARTMENTS", "MANAGE_DEPARTMENTS"), getDepartmentById);
router.patch("/departments/update/:id", checkPermission("EDIT_DEPARTMENTS", "MANAGE_DEPARTMENTS"), updateDepartment);
router.patch("/departments/status/:id", checkPermission("EDIT_DEPARTMENTS", "MANAGE_DEPARTMENTS"), changeDepartmentStatus);
router.delete("/departments/:id", checkPermission("DELETE_DEPARTMENTS", "MANAGE_DEPARTMENTS"), deleteDepartment);

router.post("/designations/create", checkPermission("CREATE_DESIGNATIONS", "MANAGE_DESIGNATIONS"), createDesignation);
router.get("/designations/list", checkPermission("VIEW_DESIGNATIONS", "CREATE_DESIGNATIONS", "EDIT_DESIGNATIONS", "DELETE_DESIGNATIONS", "MANAGE_DESIGNATIONS"), getDesignations);
router.get("/designations/details/:id", checkPermission("VIEW_DESIGNATIONS", "CREATE_DESIGNATIONS", "EDIT_DESIGNATIONS", "DELETE_DESIGNATIONS", "MANAGE_DESIGNATIONS"), getDesignationById);
router.get("/designations/list/department/:departmentId", checkPermission("VIEW_DESIGNATIONS", "CREATE_DESIGNATIONS", "EDIT_DESIGNATIONS", "DELETE_DESIGNATIONS", "MANAGE_DESIGNATIONS", "VIEW_EMPLOYEES", "CREATE_EMPLOYEES", "EDIT_EMPLOYEES", "MANAGE_EMPLOYEES"), getDesignationsByDepartment);
router.patch("/designations/update/:id", checkPermission("EDIT_DESIGNATIONS", "MANAGE_DESIGNATIONS"), updateDesignation);
router.patch("/designations/status/:id", checkPermission("EDIT_DESIGNATIONS", "MANAGE_DESIGNATIONS"), changeDesignationStatus);
router.delete("/designations/:id", checkPermission("DELETE_DESIGNATIONS", "MANAGE_DESIGNATIONS"), deleteDesignation);

router.post("/employee-types/create", checkPermission("CREATE_EMPLOYEE_TYPES", "MANAGE_EMPLOYEE_TYPES"), createEmployeeType);
router.get("/employee-types/list", checkPermission("VIEW_EMPLOYEE_TYPES", "CREATE_EMPLOYEE_TYPES", "EDIT_EMPLOYEE_TYPES", "DELETE_EMPLOYEE_TYPES", "MANAGE_EMPLOYEE_TYPES"), getEmployeeTypes);
router.get("/employee-types/details/:id", checkPermission("VIEW_EMPLOYEE_TYPES", "CREATE_EMPLOYEE_TYPES", "EDIT_EMPLOYEE_TYPES", "DELETE_EMPLOYEE_TYPES", "MANAGE_EMPLOYEE_TYPES"), getEmployeeTypeById);
router.patch("/employee-types/update/:id", checkPermission("EDIT_EMPLOYEE_TYPES", "MANAGE_EMPLOYEE_TYPES"), updateEmployeeType);
router.patch("/employee-types/status/:id", checkPermission("EDIT_EMPLOYEE_TYPES", "MANAGE_EMPLOYEE_TYPES"), changeEmployeeTypeStatus);
router.delete("/employee-types/:id", checkPermission("DELETE_EMPLOYEE_TYPES", "MANAGE_EMPLOYEE_TYPES"), deleteEmployeeType);

router.post("/work-modes/create", checkPermission("CREATE_WORK_MODES", "MANAGE_WORK_MODES"), createWorkMode);
router.get("/work-modes/list", checkPermission("VIEW_WORK_MODES", "CREATE_WORK_MODES", "EDIT_WORK_MODES", "DELETE_WORK_MODES", "MANAGE_WORK_MODES"), getWorkModes);
router.get("/work-modes/details/:id", checkPermission("VIEW_WORK_MODES", "CREATE_WORK_MODES", "EDIT_WORK_MODES", "DELETE_WORK_MODES", "MANAGE_WORK_MODES"), getWorkModeById);
router.patch("/work-modes/update/:id", checkPermission("EDIT_WORK_MODES", "MANAGE_WORK_MODES"), updateWorkMode);
router.patch("/work-modes/status/:id", checkPermission("EDIT_WORK_MODES", "MANAGE_WORK_MODES"), changeWorkModeStatus);
router.delete("/work-modes/:id", checkPermission("DELETE_WORK_MODES", "MANAGE_WORK_MODES"), deleteWorkMode);

router.post("/leave-types/create", checkPermission("CREATE_LEAVE_TYPES", "MANAGE_LEAVE_TYPES"), createLeaveType);
router.get("/leave-types/list", checkPermission("VIEW_LEAVE_TYPES", "CREATE_LEAVE_TYPES", "EDIT_LEAVE_TYPES", "DELETE_LEAVE_TYPES", "MANAGE_LEAVE_TYPES", "VIEW_LEAVE", "CREATE_LEAVE"), getLeaveTypes);
router.get("/leave-types/details/:id", checkPermission("VIEW_LEAVE_TYPES", "CREATE_LEAVE_TYPES", "EDIT_LEAVE_TYPES", "DELETE_LEAVE_TYPES", "MANAGE_LEAVE_TYPES"), getLeaveTypeById);
router.patch("/leave-types/update/:id", checkPermission("EDIT_LEAVE_TYPES", "MANAGE_LEAVE_TYPES"), updateLeaveType);
router.patch("/leave-types/status/:id", checkPermission("EDIT_LEAVE_TYPES", "MANAGE_LEAVE_TYPES"), changeLeaveTypeStatus);
router.delete("/leave-types/:id", checkPermission("DELETE_LEAVE_TYPES", "MANAGE_LEAVE_TYPES"), deleteLeaveType);

router.post("/leave-assignments/create", checkPermission("CREATE_LEAVE_ASSIGN", "MANAGE_LEAVE_ASSIGN"), createLeaveAssignment);
router.post("/leave-assignments/save", checkPermission("CREATE_LEAVE_ASSIGN", "EDIT_LEAVE_ASSIGN", "MANAGE_LEAVE_ASSIGN"), saveLeaveAssignments);
router.get("/leave-assignments/list", checkPermission("VIEW_LEAVE_ASSIGN", "CREATE_LEAVE_ASSIGN", "EDIT_LEAVE_ASSIGN", "DELETE_LEAVE_ASSIGN", "MANAGE_LEAVE_ASSIGN"), getLeaveAssignments);
router.get("/leave-assignments/details/:id", checkPermission("VIEW_LEAVE_ASSIGN", "CREATE_LEAVE_ASSIGN", "EDIT_LEAVE_ASSIGN", "DELETE_LEAVE_ASSIGN", "MANAGE_LEAVE_ASSIGN"), getLeaveAssignmentById);
router.patch("/leave-assignments/update/:id", checkPermission("EDIT_LEAVE_ASSIGN", "MANAGE_LEAVE_ASSIGN"), updateLeaveAssignment);
router.delete("/leave-assignments/:id", checkPermission("DELETE_LEAVE_ASSIGN", "MANAGE_LEAVE_ASSIGN"), deleteLeaveAssignment);

router.post("/services/create", checkPermission("CREATE_SERVICES", "MANAGE_SERVICES"), createService);
router.get("/services/list", checkPermission("VIEW_SERVICES", "CREATE_SERVICES", "EDIT_SERVICES", "DELETE_SERVICES", "MANAGE_SERVICES", "VIEW_CLIENTS", "CREATE_CLIENTS", "EDIT_CLIENTS", "MANAGE_CLIENTS", "VIEW_LEADS", "CREATE_LEADS", "MANAGE_LEADS"), getServices);
router.get("/services/details/:id", checkPermission("VIEW_SERVICES", "CREATE_SERVICES", "EDIT_SERVICES", "DELETE_SERVICES", "MANAGE_SERVICES"), getServiceById);
router.patch("/services/update/:id", checkPermission("EDIT_SERVICES", "MANAGE_SERVICES"), updateService);
router.delete("/services/:id", checkPermission("DELETE_SERVICES", "MANAGE_SERVICES"), deleteService);

router.post("/clients/create", checkPermission("CREATE_CLIENTS", "MANAGE_CLIENTS"), createClient);
router.get("/clients/sample", checkPermission("CREATE_CLIENTS", "MANAGE_CLIENTS"), downloadClientSample);
router.post("/clients/import", checkPermission("CREATE_CLIENTS", "MANAGE_CLIENTS"), receiveLeadSheet, importClients);
router.get("/clients/list", checkPermission("VIEW_CLIENTS", "CREATE_CLIENTS", "EDIT_CLIENTS", "DELETE_CLIENTS", "MANAGE_CLIENTS"), getClients);
router.get("/clients/payments/export", checkPermission("VIEW_CLIENTS", "EDIT_CLIENTS", "MANAGE_CLIENTS"), exportClientPayments);
router.get("/clients/details/:id", checkPermission("VIEW_CLIENTS", "CREATE_CLIENTS", "EDIT_CLIENTS", "DELETE_CLIENTS", "MANAGE_CLIENTS"), getClientById);
router.patch("/clients/update/:id", checkPermission("EDIT_CLIENTS", "MANAGE_CLIENTS"), updateClient);
router.patch("/clients/:id/payments/:paymentId/paid", checkPermission("EDIT_CLIENTS", "MANAGE_CLIENTS"), markClientPaymentPaid);
router.put("/clients/:id/permissions", checkPermission("MANAGE_PERMISSIONS"), updateClientPermissions);
router.delete("/clients/:id", checkPermission("DELETE_CLIENTS", "MANAGE_CLIENTS"), deleteClient);

router.get("/work-plans/defaults", checkPermission("VIEW_DAILY_TASKS", "CREATE_DAILY_TASKS", "EDIT_DAILY_TASKS", "MANAGE_DAILY_TASKS", "VIEW_PROJECTS", "MANAGE_PROJECTS"), getPlanDefaults);
router.get("/work-plans/employees", checkPermission("VIEW_DAILY_TASKS", "CREATE_DAILY_TASKS", "EDIT_DAILY_TASKS", "MANAGE_DAILY_TASKS", "VIEW_PROJECTS", "MANAGE_PROJECTS"), getPlanEmployees);
router.get("/work-plans/daily", checkPermission("VIEW_DAILY_TASKS", "CREATE_DAILY_TASKS", "EDIT_DAILY_TASKS", "MANAGE_DAILY_TASKS", "VIEW_PROJECTS", "MANAGE_PROJECTS"), getDailyPlanBoard);
router.get("/work-plans/daily/export", checkPermission("VIEW_DAILY_TASKS", "MANAGE_DAILY_TASKS", "VIEW_PROJECTS", "MANAGE_PROJECTS"), exportDailyPlanBoard);
router.get("/work-plans/client/:clientId", checkPermission("VIEW_DAILY_TASKS", "CREATE_DAILY_TASKS", "EDIT_DAILY_TASKS", "MANAGE_DAILY_TASKS", "VIEW_PROJECTS", "MANAGE_PROJECTS", "VIEW_CLIENTS", "MANAGE_CLIENTS"), listClientPlans);
router.get("/work-plans/project/:projectId", checkPermission("VIEW_DAILY_TASKS", "CREATE_DAILY_TASKS", "EDIT_DAILY_TASKS", "MANAGE_DAILY_TASKS", "VIEW_PROJECTS", "MANAGE_PROJECTS"), listProjectPlans);
router.get("/work-plans/details/:id", checkPermission("VIEW_DAILY_TASKS", "CREATE_DAILY_TASKS", "EDIT_DAILY_TASKS", "MANAGE_DAILY_TASKS", "VIEW_PROJECTS", "MANAGE_PROJECTS"), getPlanById);
router.post("/work-plans/create", checkPermission("CREATE_DAILY_TASKS", "MANAGE_DAILY_TASKS", "CREATE_PROJECTS", "MANAGE_PROJECTS"), createPlan);
router.patch("/work-plans/update/:id", checkPermission("EDIT_DAILY_TASKS", "MANAGE_DAILY_TASKS", "EDIT_PROJECTS", "MANAGE_PROJECTS"), updatePlan);
router.patch("/work-plans/:id/progress", checkPermission("VIEW_DAILY_TASKS", "EDIT_DAILY_TASKS", "MANAGE_DAILY_TASKS", "VIEW_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS"), updateProgress);
router.patch("/work-plans/:id/slots/:slotId", checkPermission("EDIT_DAILY_TASKS", "MANAGE_DAILY_TASKS", "EDIT_PROJECTS", "MANAGE_PROJECTS"), updateSlot);
router.delete("/work-plans/:id", checkPermission("DELETE_DAILY_TASKS", "MANAGE_DAILY_TASKS", "DELETE_PROJECTS", "MANAGE_PROJECTS"), deletePlan);

router.post("/leads/create", checkPermission("CREATE_LEADS", "MANAGE_LEADS"), createLead);
router.get("/leads/sample", checkPermission("CREATE_LEADS", "MANAGE_LEADS"), downloadLeadSample);
router.get("/leads/export", checkPermission("VIEW_LEADS", "MANAGE_LEADS"), exportLeads);
router.post("/leads/import", checkPermission("CREATE_LEADS", "MANAGE_LEADS"), receiveLeadSheet, importLeads);
router.get("/leads/list", checkPermission("VIEW_LEADS", "CREATE_LEADS", "EDIT_LEADS", "DELETE_LEADS", "MANAGE_LEADS"), getLeads);
router.get("/leads/assignees", checkPermission("VIEW_LEADS", "CREATE_LEADS", "EDIT_LEADS", "MANAGE_LEADS"), getLeadAssignees);
router.get("/leads/details/:id", checkPermission("VIEW_LEADS", "CREATE_LEADS", "EDIT_LEADS", "DELETE_LEADS", "MANAGE_LEADS"), getLeadById);
router.patch("/leads/update/:id", checkPermission("EDIT_LEADS", "MANAGE_LEADS"), updateLead);
router.patch("/leads/:id/assign", checkPermission("EDIT_LEADS", "MANAGE_LEADS"), assignLead);
router.delete("/leads/:id", checkPermission("DELETE_LEADS", "MANAGE_LEADS"), deleteLead);
router.get("/leads/:id/follow-ups", checkPermission("VIEW_FOLLOW_UPS", "VIEW_LEADS", "MANAGE_FOLLOW_UPS", "MANAGE_LEADS"), getLeadFollowUps);
router.post("/leads/:id/follow-ups", checkPermission("CREATE_FOLLOW_UPS", "MANAGE_FOLLOW_UPS", "EDIT_LEADS", "MANAGE_LEADS"), createFollowUp);
router.get("/follow-ups/due", checkPermission("VIEW_FOLLOW_UPS", "CREATE_FOLLOW_UPS", "EDIT_FOLLOW_UPS", "MANAGE_FOLLOW_UPS", "VIEW_LEADS", "MANAGE_LEADS"), getDueFollowUps);
router.get("/sales/list", checkPermission("VIEW_SALES", "VIEW_LEADS", "MANAGE_LEADS"), listSales);
router.get("/payments/list", checkPermission("VIEW_PAYMENTS", "VIEW_LEADS", "MANAGE_LEADS"), listPayments);
router.get("/revenue/list", checkPermission("VIEW_REVENUE", "VIEW_LEADS", "MANAGE_LEADS"), listRevenue);
router.get("/dashboard/summary", checkPermission("VIEW_DASHBOARD"), getDashboard);
router.get("/reports/catalog", checkPermission("VIEW_REPORTS", "MANAGE_REPORTS"), getReportCatalog);
router.get("/reports/options", checkPermission("VIEW_REPORTS", "MANAGE_REPORTS"), getReportOptions);
router.get("/reports", checkPermission("VIEW_REPORTS", "MANAGE_REPORTS"), getReport);
router.get("/attendance/employees", checkPermission("VIEW_ATTENDANCE", "VIEW_TEAM_ATTENDANCE", "VIEW_ALL_ATTENDANCE", "VIEW_ATTENDANCE_REPORT", "MANAGE_ATTENDANCE"), attendanceEmployees);
router.get("/attendance", checkPermission("VIEW_ATTENDANCE", "VIEW_TEAM_ATTENDANCE", "VIEW_ALL_ATTENDANCE", "VIEW_ATTENDANCE_REPORT", "PUNCH_ATTENDANCE", "MANAGE_ATTENDANCE"), getAttendance);
router.post("/attendance/punch", checkPermission("PUNCH_ATTENDANCE", "MANAGE_ATTENDANCE"), punchLimiter, receiveAttendancePhoto, punchAttendance);

router.get("/leave-requests/mine", checkPermission("VIEW_LEAVE", "CREATE_LEAVE"), listMine);
router.get("/leave-requests/balance", checkPermission("VIEW_LEAVE", "CREATE_LEAVE"), myBalance);
router.get("/leave-requests/queue", checkPermission("VIEW_LEAVE_QUEUE", "APPROVE_LEAVE"), listQueue);
router.post("/leave-requests", checkPermission("CREATE_LEAVE"), receiveLeaveDocument, createLeaveRequest);
router.patch("/leave-requests/:id/review", checkPermission("APPROVE_LEAVE"), reviewLeaveRequest);
router.patch("/leave-requests/:id", checkPermission("CREATE_LEAVE", "VIEW_LEAVE"), receiveLeaveDocument, updateLeaveRequest);
router.delete("/leave-requests/:id", checkPermission("CREATE_LEAVE", "VIEW_LEAVE"), deleteLeaveRequest);

router.post("/urgent-works/create", checkPermission("CREATE_URGENT_WORK", "MANAGE_URGENT_WORK"), receiveTicketFile, createUrgentWork);
router.get("/urgent-works/list", checkPermission("VIEW_URGENT_WORK", "CREATE_URGENT_WORK", "EDIT_URGENT_WORK", "DELETE_URGENT_WORK", "MANAGE_URGENT_WORK"), getUrgentWorks);
router.get("/urgent-works/options", checkPermission("VIEW_URGENT_WORK", "CREATE_URGENT_WORK", "EDIT_URGENT_WORK", "MANAGE_URGENT_WORK"), getUrgentWorkOptions);
router.get("/urgent-works/details/:id", checkPermission("VIEW_URGENT_WORK", "CREATE_URGENT_WORK", "EDIT_URGENT_WORK", "DELETE_URGENT_WORK", "MANAGE_URGENT_WORK"), getUrgentWorkById);
router.patch("/urgent-works/update/:id", checkPermission("EDIT_URGENT_WORK", "MANAGE_URGENT_WORK"), receiveTicketFile, updateUrgentWork);
router.patch("/urgent-works/:id/status", checkPermission("EDIT_URGENT_WORK", "MANAGE_URGENT_WORK"), updateUrgentWorkStatus);
router.delete("/urgent-works/:id", checkPermission("DELETE_URGENT_WORK", "MANAGE_URGENT_WORK"), deleteUrgentWork);

router.post("/daily-tasks/create", checkPermission("CREATE_DAILY_TASKS", "MANAGE_DAILY_TASKS"), createDailyTask);
router.get("/daily-tasks/list", checkPermission("VIEW_DAILY_TASKS", "CREATE_DAILY_TASKS", "EDIT_DAILY_TASKS", "DELETE_DAILY_TASKS", "MANAGE_DAILY_TASKS"), getDailyTasks);
router.get("/daily-tasks/options", checkPermission("VIEW_DAILY_TASKS", "CREATE_DAILY_TASKS", "EDIT_DAILY_TASKS", "MANAGE_DAILY_TASKS"), getDailyTaskOptions);
router.get("/daily-tasks/alerts", checkPermission("VIEW_DAILY_TASKS", "CREATE_DAILY_TASKS", "EDIT_DAILY_TASKS", "MANAGE_DAILY_TASKS"), getDailyPlanAlerts);
router.get("/notifications", getNotificationFeed);
router.patch("/notifications/read-all", markAllNotificationsRead);
router.patch("/notifications/:id/read", markNotificationRead);
router.get("/daily-tasks/export", checkPermission("VIEW_DAILY_TASKS", "MANAGE_DAILY_TASKS"), exportDailyTasks);
router.get("/daily-tasks/details/:id", checkPermission("VIEW_DAILY_TASKS", "CREATE_DAILY_TASKS", "EDIT_DAILY_TASKS", "DELETE_DAILY_TASKS", "MANAGE_DAILY_TASKS"), getDailyTaskById);
router.patch("/daily-tasks/update/:id", checkPermission("EDIT_DAILY_TASKS", "MANAGE_DAILY_TASKS"), updateDailyTask);
router.patch("/daily-tasks/:id/status", checkPermission("EDIT_DAILY_TASKS", "MANAGE_DAILY_TASKS"), updateDailyTaskStatus);
router.delete("/daily-tasks/:id", checkPermission("DELETE_DAILY_TASKS", "MANAGE_DAILY_TASKS"), deleteDailyTask);

router.post("/tickets/create", checkPermission("CREATE_TICKETS", "MANAGE_TICKETS"), receiveTicketFile, createTicket);
router.get("/tickets/list", checkPermission("VIEW_TICKETS", "CREATE_TICKETS", "EDIT_TICKETS", "DELETE_TICKETS", "MANAGE_TICKETS"), getTickets);
router.get("/tickets/details/:id", checkPermission("VIEW_TICKETS", "CREATE_TICKETS", "EDIT_TICKETS", "DELETE_TICKETS", "MANAGE_TICKETS"), getTicketById);
router.post("/tickets/:id/replies", checkPermission("EDIT_TICKETS", "CREATE_TICKETS", "MANAGE_TICKETS"), replyToTicket);
router.patch("/tickets/:id/status", checkPermission("EDIT_TICKETS", "MANAGE_TICKETS"), updateTicketStatus);
router.delete("/tickets/:id", checkPermission("DELETE_TICKETS", "MANAGE_TICKETS"), deleteTicket);

router.post("/projects/create", checkPermission("CREATE_PROJECTS", "MANAGE_PROJECTS"), createProject);
router.get("/projects/list", checkPermission("VIEW_PROJECTS", "CREATE_PROJECTS", "EDIT_PROJECTS", "DELETE_PROJECTS", "MANAGE_PROJECTS"), getProjects);
router.get("/projects/employees", checkPermission("VIEW_PROJECTS", "CREATE_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS"), getProjectEmployees);
router.get("/projects/clients", checkPermission("VIEW_PROJECTS", "CREATE_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS", "VIEW_CLIENTS", "MANAGE_CLIENTS"), getProjectClients);
router.get("/projects/details/:id", checkPermission("VIEW_PROJECTS", "CREATE_PROJECTS", "EDIT_PROJECTS", "DELETE_PROJECTS", "MANAGE_PROJECTS"), getProjectById);
// VIEW_PROJECTS is enough for assigned employees (list/create/save/lock own reporting).
// Approve/unlock stay gated in the controller to RM/Admin.
router.get("/evening-reports", checkPermission("VIEW_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS"), listEveningReports);
router.get("/evening-reports/today", checkPermission("VIEW_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS"), listTodayApproved);
router.get("/evening-reports/meta/clients", checkPermission("VIEW_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS"), listReportClients);
router.post("/evening-reports/generate", checkPermission("VIEW_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS"), generateNow);
router.post("/evening-reports", checkPermission("VIEW_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS"), createEveningReport);
router.get("/evening-reports/:id", checkPermission("VIEW_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS"), getEveningReport);
router.patch("/evening-reports/:id", checkPermission("VIEW_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS"), updateEveningReport);
router.post("/evening-reports/:id/lock", checkPermission("VIEW_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS"), lockEveningReport);
router.post("/evening-reports/:id/approve", checkPermission("VIEW_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS"), approveEveningReport);
router.post("/evening-reports/:id/unlock", checkPermission("VIEW_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS"), unlockEveningReport);
router.post("/evening-reports/:id/feedback", checkPermission("VIEW_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS"), addEveningFeedback);

router.get("/meetings", checkPermission("VIEW_CLIENTS", "CREATE_CLIENTS", "EDIT_CLIENTS", "MANAGE_CLIENTS"), listStaffMeetings);
router.post("/meetings", checkPermission("CREATE_CLIENTS", "EDIT_CLIENTS", "MANAGE_CLIENTS"), createStaffMeeting);
router.get("/meetings/:id", checkPermission("VIEW_CLIENTS", "CREATE_CLIENTS", "EDIT_CLIENTS", "MANAGE_CLIENTS"), getMeeting);
router.post("/meetings/:id/approve", checkPermission("EDIT_CLIENTS", "MANAGE_CLIENTS"), approveMeeting);
router.post("/meetings/:id/reject", checkPermission("EDIT_CLIENTS", "MANAGE_CLIENTS"), rejectMeeting);
router.post("/meetings/:id/cancel", checkPermission("EDIT_CLIENTS", "MANAGE_CLIENTS"), cancelMeeting);
router.patch("/projects/update/:id", checkPermission("EDIT_PROJECTS", "MANAGE_PROJECTS"), updateProject);
router.patch("/projects/:id/status", checkPermission("EDIT_PROJECTS", "MANAGE_PROJECTS"), updateProjectStatus);
router.delete("/projects/:id", checkPermission("DELETE_PROJECTS", "MANAGE_PROJECTS"), deleteProject);

router.post("/interviews/create", checkPermission("CREATE_INTERVIEWS", "MANAGE_INTERVIEWS"), receiveResume, createInterview);
router.get("/interviews/list", checkPermission("VIEW_INTERVIEWS", "CREATE_INTERVIEWS", "EDIT_INTERVIEWS", "DELETE_INTERVIEWS", "MANAGE_INTERVIEWS"), getInterviews);
router.get("/interviews/interviewers", checkPermission("VIEW_INTERVIEWS", "CREATE_INTERVIEWS", "EDIT_INTERVIEWS", "MANAGE_INTERVIEWS"), getInterviewers);
router.get("/interviews/details/:id", checkPermission("VIEW_INTERVIEWS", "CREATE_INTERVIEWS", "EDIT_INTERVIEWS", "DELETE_INTERVIEWS", "MANAGE_INTERVIEWS"), getInterviewById);
router.patch("/interviews/update/:id", checkPermission("EDIT_INTERVIEWS", "MANAGE_INTERVIEWS"), receiveResume, updateInterview);
router.delete("/interviews/:id", checkPermission("DELETE_INTERVIEWS", "MANAGE_INTERVIEWS"), deleteInterview);

router.get("/settings", checkPermission("MANAGE_SETTINGS"), getSettings);
router.patch("/settings", checkPermission("MANAGE_SETTINGS"), receiveLogo, updateSettings);
router.post("/settings/ringtone", checkPermission("MANAGE_SETTINGS"), receiveRingtone, uploadDefaultRingtone);
router.delete("/settings/field/:field", checkPermission("MANAGE_SETTINGS"), clearSettingField);

router.get("/offer-banners", checkPermission("MANAGE_OFFER_BANNERS", "MANAGE_SETTINGS", "VIEW_OFFER_BANNERS"), listOfferBanners);
router.post("/offer-banners", checkPermission("MANAGE_OFFER_BANNERS", "MANAGE_SETTINGS", "CREATE_OFFER_BANNERS"), receiveOfferBannerImage, createOfferBanner);
router.patch("/offer-banners/status/:id", checkPermission("MANAGE_OFFER_BANNERS", "MANAGE_SETTINGS", "EDIT_OFFER_BANNERS"), changeOfferBannerStatus);
router.get("/offer-banners/:id", checkPermission("MANAGE_OFFER_BANNERS", "MANAGE_SETTINGS", "VIEW_OFFER_BANNERS"), getOfferBannerById);
router.patch("/offer-banners/:id", checkPermission("MANAGE_OFFER_BANNERS", "MANAGE_SETTINGS", "EDIT_OFFER_BANNERS"), receiveOfferBannerImage, updateOfferBanner);
router.delete("/offer-banners/:id", checkPermission("MANAGE_OFFER_BANNERS", "MANAGE_SETTINGS", "DELETE_OFFER_BANNERS"), deleteOfferBanner);

router.get("/email-templates", checkPermission("VIEW_EMAIL_TEMPLATES", "MANAGE_EMAIL_TEMPLATES", "SEND_CLIENT_MAILS"), listEmailTemplates);
router.post("/email-templates", checkPermission("CREATE_EMAIL_TEMPLATES", "MANAGE_EMAIL_TEMPLATES"), createEmailTemplate);
router.get("/email-templates/recipients", checkPermission("SEND_CLIENT_MAILS", "MANAGE_EMAIL_TEMPLATES", "VIEW_EMAIL_TEMPLATES"), listMailRecipients);
router.post("/email-templates/send", checkPermission("SEND_CLIENT_MAILS", "MANAGE_EMAIL_TEMPLATES"), receiveMailAttachments, sendClientMails);
router.get("/email-templates/:id", checkPermission("VIEW_EMAIL_TEMPLATES", "MANAGE_EMAIL_TEMPLATES", "SEND_CLIENT_MAILS"), getEmailTemplateById);
router.patch("/email-templates/:id", checkPermission("EDIT_EMAIL_TEMPLATES", "MANAGE_EMAIL_TEMPLATES"), updateEmailTemplate);
router.delete("/email-templates/:id", checkPermission("DELETE_EMAIL_TEMPLATES", "MANAGE_EMAIL_TEMPLATES"), deleteEmailTemplate);

module.exports = router;
