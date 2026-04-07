import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import EditProfileScreen from "../../app/edit-profile";
import { API_ENDPOINTS } from "../../config/api";
import {
    logCaseStep,
    makeJsonResponse,
    mockedAsyncStorageGetItem,
    mockedJwtDecode,
    setupDefaultCaseMocks,
} from "./helpers/caseTestUtils";

describe("TC-62", () => {
  beforeEach(() => {
    setupDefaultCaseMocks();
  });

  it("updates profile successfully with valid inputs", async () => {
    logCaseStep("TC-62", "START", {
      scenario: "organization profile successful update",
      payload: { fullName: "Himanshu Kumar Sharma", phone: "9804089581" },
    });

    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

    mockedAsyncStorageGetItem.mockImplementation(async (key: string) => {
      if (key === "authToken") return "token-123";
      if (key === "userData") return null;
      return null;
    });

    mockedJwtDecode.mockReturnValue({
      user: {
        id: "22",
        fullName: "Old Name",
        email: "org@bloodbuddy.com",
        role: "organization",
        phone: "9800000000",
        organization: {
          organizationName: "Red Cross",
          contact: "9804089580",
          location: "Kathmandu",
        },
      },
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeJsonResponse(true, {
        user: {
          id: "22",
          fullName: "Himanshu Kumar Sharma",
          email: "org@bloodbuddy.com",
          role: "organization",
          phone: "9804089581",
          organization: {
            organizationName: "Red Cross",
            contact: "9804089581",
            location: "Kathmandu",
          },
        },
      }),
    );

    const { getByTestId } = render(<EditProfileScreen />);

    await waitFor(() => {
      expect(getByTestId("editProfileNameInput")).toBeTruthy();
    });

    fireEvent.changeText(
      getByTestId("editProfileNameInput"),
      "Himanshu Kumar Sharma",
    );
    fireEvent.changeText(getByTestId("editProfilePhoneInput"), "9804089581");
    fireEvent.changeText(getByTestId("editProfileContactInput"), "9804089581");
    fireEvent.press(getByTestId("editProfileSaveButton"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        API_ENDPOINTS.PROFILE,
        expect.objectContaining({ method: "PUT" }),
      );
      expect(alertSpy).toHaveBeenCalledWith(
        "Success",
        "Profile updated successfully!",
        expect.any(Array),
      );
    });

    logCaseStep("TC-62", "PASS", {
      assertions: [
        "profile API called",
        "success alert shown",
        "save flow completed",
      ],
    });
  });
});
