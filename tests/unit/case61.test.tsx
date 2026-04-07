import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import ForgotPasswordScreen from "../../app/auth/forgot-password";
import {
    logCaseStep,
    makeTextResponse,
    setupDefaultCaseMocks,
} from "./helpers/caseTestUtils";

describe("TC-61", () => {
  beforeEach(() => {
    setupDefaultCaseMocks();
  });

  it("rejects forgot-password OTP request for unregistered email", async () => {
    logCaseStep("TC-61", "START", {
      scenario: "unregistered email OTP request should fail",
      email: "unregistered@example.com",
    });

    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeTextResponse(false, {
        message: "User with this email does not exist.",
      }),
    );

    const { getByTestId } = render(<ForgotPasswordScreen />);

    fireEvent.changeText(
      getByTestId("forgotPasswordEmailInput"),
      "unregistered@example.com",
    );
    fireEvent.press(getByTestId("forgotPasswordSubmitButton"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Request failed",
        "User with this email does not exist.",
      );
    });

    logCaseStep("TC-61", "PASS", {
      assertions: ["error alert shown", "correct backend message surfaced"],
    });
  });
});
