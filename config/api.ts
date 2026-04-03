export const API_BASE_URL = "http://192.168.1.65:8000";

export const API_ENDPOINTS = {
  REGISTER: `${API_BASE_URL}/api/users/register`,
  VERIFY_OTP: `${API_BASE_URL}/api/users/verify-otp`,
  RESEND_OTP: `${API_BASE_URL}/api/users/resend-otp`,
  LOGIN: `${API_BASE_URL}/api/users/login`,
  FORGOT_PASSWORD: `${API_BASE_URL}/api/users/forgot-password`,
  RESET_PASSWORD: `${API_BASE_URL}/api/users/reset-password`,
  PROFILE: `${API_BASE_URL}/api/users/profile`,
  ELIGIBILITY_CHECK: `${API_BASE_URL}/api/users/eligibility-check`,
  DONOR_AVAILABILITY: `${API_BASE_URL}/api/donors/availability`,
  ADD_INVENTORY: `${API_BASE_URL}/api/organizations/add-inventory`,
  GET_INVENTORY: `${API_BASE_URL}/api/organizations/get-inventory`,
  GET_ORGANIZATIONS: `${API_BASE_URL}/api/organizations/getOrganizations`,
  CHECK_BLOOD_TYPE: (bloodType: string) =>
    `${API_BASE_URL}/api/organizations/check-blood-type/${bloodType}`,
  DELETE_INVENTORY: (bloodType: string) =>
    `${API_BASE_URL}/api/organizations/delete-inventory/${bloodType}`,
  UPDATE_INVENTORY: `${API_BASE_URL}/api/organizations/update-inventory-units`,
  GET_INVENTORY_HISTORY: `${API_BASE_URL}/api/organizations/get-inventory-history`,
  BOOK_BLOOD: `${API_BASE_URL}/api/requests/create`,
  CANCEL_BOOKING: `${API_BASE_URL}/api/requests/cancel`,
  GET_USER_BOOKINGS: (userId: string | number) =>
    `${API_BASE_URL}/api/requests/user/${userId}`,
  CREATE_BOOKING: `${API_BASE_URL}/api/bookings/create`,
  APPROVE_BOOKING: (requestId: number) =>
    `${API_BASE_URL}/api/bookings/approve/${requestId}`,
  REJECT_BOOKING: (requestId: number) =>
    `${API_BASE_URL}/api/bookings/reject/${requestId}`,
  CREATE_DONATION: `${API_BASE_URL}/api/donations/create`,
  GET_DONATIONS: `${API_BASE_URL}/api/donations/all`,
  GET_DONOR_SCHEDULE: `${API_BASE_URL}/api/donations/donor/schedule`,
  GET_ORG_REQUESTS: `${API_BASE_URL}/api/donations/organization/requests`,
  GET_ORG_CONFIRMED: `${API_BASE_URL}/api/donations/organization/confirmed`,
  GET_DONOR_HISTORY: `${API_BASE_URL}/api/donations/donor/history`,
  UPDATE_DONATION_STATUS: (offerId: number) =>
    `${API_BASE_URL}/api/donations/update-status/${offerId}`,
  GET_NOTIFICATIONS: `${API_BASE_URL}/api/notifications/all`,
  MARK_NOTIFICATION_READ: (id: number) =>
    `${API_BASE_URL}/api/notifications/mark-read/${id}`,
  DELETE_NOTIFICATION: (id: number) =>
    `${API_BASE_URL}/api/notifications/${id}`,
  CREATE_CAMPAIGN: `${API_BASE_URL}/api/campaigns/create`,
  GET_MY_CAMPAIGNS: `${API_BASE_URL}/api/campaigns/my-campaigns`,
  GET_ALL_CAMPAIGNS: `${API_BASE_URL}/api/campaigns/all`,
  INVITE_CAMPAIGN_COLLABORATORS: (campaignId: string | number) =>
    `${API_BASE_URL}/api/campaigns/${campaignId}/invite-organizations`,
  GET_CAMPAIGN_INVITATIONS: `${API_BASE_URL}/api/campaigns/invitations`,
  RESPOND_CAMPAIGN_INVITATION: (invitationId: string | number) =>
    `${API_BASE_URL}/api/campaigns/invitations/${invitationId}/respond`,
  GET_CAMPAIGN_REPORT: (campaignId: string | number) =>
    `${API_BASE_URL}/api/campaigns/${campaignId}/report`,
  UPDATE_CAMPAIGN: (id: string | number) =>
    `${API_BASE_URL}/api/campaigns/${id}`,
  DELETE_CAMPAIGN: (id: string | number) =>
    `${API_BASE_URL}/api/campaigns/${id}`,
  CREATE_EMERGENCY: `${API_BASE_URL}/api/emergency/create`,
  ACCEPT_EMERGENCY: (requestId: number) =>
    `${API_BASE_URL}/api/emergency/accept/${requestId}`,
  CANCEL_EMERGENCY: (requestId: number) =>
    `${API_BASE_URL}/api/emergency/cancel/${requestId}`,
  STOP_EMERGENCY: (requestId: number) =>
    `${API_BASE_URL}/api/emergency/stop/${requestId}`,
  UPDATE_EMERGENCY_LOCATION: (requestId: number) =>
    `${API_BASE_URL}/api/emergency/location/${requestId}`,
  GET_EMERGENCY_LOCATION: (requestId: number) =>
    `${API_BASE_URL}/api/emergency/location/${requestId}`,
  INITIATE_KHALTI: `${API_BASE_URL}/api/payments/initiate-khalti`,
  VERIFY_KHALTI: `${API_BASE_URL}/api/payments/verify-khalti`,
  INITIATE_ESEWA: `${API_BASE_URL}/api/payments/initiate-esewa`,
  VERIFY_ESEWA: `${API_BASE_URL}/api/payments/verify-esewa`,
  GET_PAYMENT_HISTORY: `${API_BASE_URL}/api/payments/history`,
  GET_DONORS: `${API_BASE_URL}/api/donors/getDonors`,
  GET_PROFILE: (userId: string) =>
    `${API_BASE_URL}/api/users/profile/${userId}`,
  RECORD_ATTENDANCE: `${API_BASE_URL}/api/campaigns/record-attendance`,
  GET_ATTENDEES: (id: string | number) =>
    `${API_BASE_URL}/api/campaigns/attendees/${id}`,
  GET_LEADERBOARD: `${API_BASE_URL}/api/donors/leaderboard`,
  INSTAGRAM_AUTH: `${API_BASE_URL}/api/users/instagram-auth`,
};
