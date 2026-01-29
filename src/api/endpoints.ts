import { apiClient } from './client';
import type {
    BeneficiarySearchRequest,
    AuthorizeMedicationRequest,
    AuthorizeMedicationResponse
} from '../types';

// Helper for polling monitor
const pollMonitor = async (location: string) => {
    if (!location) {
        console.warn('Received 202 but no Location header found');
        return null;
    }

    // Route through proxy to avoid CORS
    let fetchUrl = location;
    if (location.startsWith('http')) {
        try {
            const urlObj = new URL(location);
            // apiClient already has baseURL '/v1', so we must strip it if the location includes it
            let path = urlObj.pathname;
            if (path.startsWith('/v1')) {
                path = path.substring(3); // Remove '/v1'
            }
            fetchUrl = path + urlObj.search;
        } catch (e) {
            console.error('Error parsing location URL', e);
        }
    }

    // Fetch the actual data from the monitor
    let monitorResponse = await apiClient.get(fetchUrl);
    let attempts = 0;
    const maxAttempts = 10; // 10 attempts * 3s = 30 seconds max

    while ((monitorResponse.data?.status === 'INITIATED' || monitorResponse.data?.status === 'PENDING') && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        monitorResponse = await apiClient.get(fetchUrl);
        attempts++;
    }

    // Check if we timed out while still pending
    if ((monitorResponse.data?.status === 'INITIATED' || monitorResponse.data?.status === 'PENDING') && attempts >= maxAttempts) {
        throw new Error("El servicio ha fallado pues esta tardando mas de lo normal, contactar con el personal tecnico.");
    }

    // Check final status
    if (monitorResponse.data?.status === 'COMPLETED') {
        // Extract process_tracking_id from headers
        const trackingId = monitorResponse.headers['process-tracking-id'] || monitorResponse.headers['Process-Tracking-Id'] || monitorResponse.headers['process_tracking_id'];
        if (trackingId) {
            // Attach to data object non-invasively if possible, or just expect caller to know
            // User requested property rename to kebab-case
            return { ...monitorResponse.data, 'process-tracking-id': trackingId };
        }
        return monitorResponse.data;
    } else if (monitorResponse.data?.status) {
        if (monitorResponse.data.status !== 'COMPLETED') {
            if (monitorResponse.data.result && monitorResponse.data.error) {
                throw new Error(monitorResponse.data.error || 'Error en el monitor');
            }
        }
        return monitorResponse.data;
    }

    return monitorResponse.data;
};

export const beneficiariesApi = {
    search: async (data: BeneficiarySearchRequest) => {
        // Swagger: POST /beneficiaries/search
        // Params: query params (identification_number, identification_type)
        const response = await apiClient.post('/beneficiaries/search', null, {
            params: {
                identification_number: data.identification_number,
                identification_type: data.identification_type
            }
        });

        if (response.status === 202) {
            const location = response.headers['location'] || response.headers['Location'];
            // Reusing polling logic 
            return await pollMonitor(location);
        }

        return response.data;
    }
};

export const drugsApi = {
    claim: async (data: AuthorizeMedicationRequest, processTrackingId?: string) => {
        // Swagger: POST /drugs/claim
        // Body: AuthorizeMedicationRequest (English fields)
        const headers: Record<string, string> = {};
        if (processTrackingId) {
            headers['process-tracking-id'] = processTrackingId;
        }

        const response = await apiClient.post<AuthorizeMedicationResponse>('/drugs/claim', data, { headers });

        if (response.status === 202) {
            const location = response.headers['location'] || response.headers['Location'];
            return await pollMonitor(location);
        }

        return response.data;
    },

    validate: async (data: Omit<AuthorizeMedicationRequest, 'external_authorization'>, processTrackingId?: string) => {
        const headers: Record<string, string> = {};
        if (processTrackingId) {
            headers['process-tracking-id'] = processTrackingId;
        }
        const response = await apiClient.post('/drugs/validate', data, { headers });
        return response.data;
    },

    search: async (authorizationCode: string, externalAuthorization: string) => {
        const response = await apiClient.post('/drugs/claim/search', {}, {
            params: {
                authorization_code: authorizationCode,
                external_authorization: externalAuthorization
            }
        });

        if (response.status === 202) {
            const location = response.headers['location'] || response.headers['Location'];
            return await pollMonitor(location);
        }

        return response.data;
    },

    void: async (data: { authorization_code: string, pharmacy_code: string, reason: string }, processTrackingId?: string) => {
        const headers: Record<string, string> = {};
        if (processTrackingId) {
            headers['process-tracking-id'] = processTrackingId;
        }
        const response = await apiClient.post('/drugs/claim/void', data, { headers });

        if (response.status === 202) {
            const location = response.headers['location'] || response.headers['Location'];
            return await pollMonitor(location);
        }

        return response.data;
    }
};
