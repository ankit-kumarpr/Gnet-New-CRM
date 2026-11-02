import api from "./api";

const BASE_URL = "/admin";

const employeeService = {
  // Get all employees
  getEmployees: async (params = {}) => {
    const response = await api.get(`${BASE_URL}/employees/list`, { params });
    return response.data;
  },

  // Get employee by ID
  getEmployeeById: async (id) => {
    const response = await api.get(`${BASE_URL}/employees/details/${id}`);
    return response.data;
  },

  // Update employee profile
  updateEmployee: async (id, data) => {
    const response = await api.patch(`${BASE_URL}/employees/update/${id}`, data);
    return response.data;
  },

  // Update user permissions
  updateUserPermissions: async (id, permissions) => {
    const response = await api.put(`${BASE_URL}/users/${id}/permissions`, { permissions });
    return response.data;
  },

  updateClientPermissions: async (id, permissions) => {
    const response = await api.put(`${BASE_URL}/clients/${id}/permissions`, { permissions });
    return response.data;
  },
};

export default employeeService;
