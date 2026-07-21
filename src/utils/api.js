export const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:7736";

/** Resolve relative media paths (logos, profile pictures) against the API host. */
export const getMediaUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
};

/**
 * Unified API calling utility
 * @param {string} endpoint - The API endpoint or full URL
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {Object|null} body - Request payload
 * @param {string|number|null} companyId - Optional Company ID for the 'company' header
 * @param {Object} requestOverrides - Optional request overrides
 * @returns {Promise<Response>} - The fetch response object
 */
export const apiCall = async (endpoint, method = 'GET', body = null, companyId = null, requestOverrides = {}) => {
  const token = requestOverrides.token ?? localStorage.getItem('token');

  const headers = {};

  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (companyId) {
    headers['company'] = companyId.toString();
  }

  const options = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.body = JSON.stringify(body);
    }
  }

  // Handle absolute vs relative URLs
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, options);

    // Global 401 Unauthorized handler
    if (response.status === 401 && !requestOverrides.skipUnauthorizedRedirect) {
      localStorage.removeItem('token');
      localStorage.removeItem('company');

      // Redirect to login page if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return response;
  } catch (error) {
    console.error(`API Call Error (${url}):`, error);
    throw error;
  }
};

/**
 * Common file upload utility
 * @param {File} file - The file to upload
 * @returns {Promise<string>} - The URL of the uploaded file
 */
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const uploadUrl = process.env.REACT_APP_UPLOAD_URL || "https://upload.onesaas.in/api/upload";
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'key': 'onedevelopers'
    },
    body: formData
  });

  const result = await response.json();
  if (result.success && result.url) {
    return result.url;
  }
  throw new Error(result.message || 'Upload failed');
};

export default apiCall;

