import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import LoginScreen from "../../app/auth/login";
import { logCaseStep, setupDefaultCaseMocks } from "./helpers/caseTestUtils";

describe("TC-59", () => {
  beforeEach(() => {
    setupDefaultCaseMocks();
  });

  it("shows login validation errors for empty fields", () => {
    logCaseStep("TC-59", "START", {
      scenario: "empty email and password validation",
    });

    const { getByTestId, getByText } = render(<LoginScreen />);

    fireEvent(getByTestId("emailInput"), "blur");
    fireEvent(getByTestId("passwordInput"), "blur");
    logCaseStep("TC-59", "Triggered blur validation on both inputs");

    expect(getByText("Email is required")).toBeTruthy();
    expect(getByText("Password is required")).toBeTruthy();

    logCaseStep("TC-59", "PASS", {
      assertions: ["Email is required visible", "Password is required visible"],
    });
  });
});
