import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import EditProfileScreen from "../../app/edit-profile";
import {
    logCaseStep,
    mockedAsyncStorageGetItem,
    mockedJwtDecode,
    setupDefaultCaseMocks,
} from "./helpers/caseTestUtils";

describe("TC-63", () => {
  beforeEach(() => {
    setupDefaultCaseMocks();
  });

  it("rejects profile update for invalid contact number", async () => {
    logCaseStep("TC-63", "START", {
      scenario: "organization profile update invalid contact",
      invalidContact: "123",
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
        fullName: "Org User",
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

    const { getByTestId, findByText } = render(<EditProfileScreen />);

    await waitFor(() => {
      expect(getByTestId("editProfileContactInput")).toBeTruthy();
    });

    fireEvent.changeText(getByTestId("editProfileContactInput"), "123");
    fireEvent.press(getByTestId("editProfileSaveButton"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Invalid input",
        "Please fix the errors in the form",
      );
    });

    expect(await findByText("Enter a valid contact number")).toBeTruthy();

    logCaseStep("TC-63", "PASS", {
      assertions: [
        "invalid input alert shown",
        "contact validation message visible",
      ],
    });
  });
});
