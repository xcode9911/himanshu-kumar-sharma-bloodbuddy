import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import OrganizationDetailScreen from "../../app/organization/[id]";
import { API_ENDPOINTS } from "../../config/api";
import {
    logCaseStep,
    makeJsonResponse,
    mockedAsyncStorageGetItem,
    mockedUseLocalSearchParams,
    setupDefaultCaseMocks,
} from "./helpers/caseTestUtils";

describe("TC-66", () => {
  beforeEach(() => {
    setupDefaultCaseMocks();
  });

  it("submits booking successfully when units are available", async () => {
    logCaseStep("TC-66", "START", {
      scenario: "gainer booking success",
      bloodType: "AB+",
      requestedUnits: 1,
      availableUnits: 5,
    });

    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

    mockedUseLocalSearchParams.mockReturnValue({
      id: "10",
      name: "Org One",
      address: "Kathmandu",
      phone: "9800000000",
      email: "org@example.com",
      logoUrl: "",
      bloodTypes: JSON.stringify(["AB+"]),
      inventory: JSON.stringify([{ bloodType: "AB+", units: 5 }]),
    });

    mockedAsyncStorageGetItem.mockImplementation(async (key: string) => {
      if (key === "userData") {
        return JSON.stringify({ role: "gainer", bloodType: "O+" });
      }
      if (key === "authToken") return "token-123";
      return null;
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeJsonResponse(true, {
        message: "Booking request submitted successfully!",
      }),
    );

    const { getByTestId } = render(<OrganizationDetailScreen />);

    await waitFor(() => {
      expect(getByTestId("bookButton_AB+")).toBeTruthy();
    });

    fireEvent.press(getByTestId("bookButton_AB+"));
    fireEvent.changeText(getByTestId("bookingUnitsInput"), "1");
    fireEvent.press(getByTestId("confirmBookingButton"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.CREATE_BOOKING,
        expect.objectContaining({ method: "POST" }),
      );
      expect(alertSpy).toHaveBeenCalledWith(
        "Success",
        "Booking request submitted successfully!",
      );
    });

    logCaseStep("TC-66", "PASS", {
      assertions: ["create booking API called", "success alert shown"],
    });
  });
});
