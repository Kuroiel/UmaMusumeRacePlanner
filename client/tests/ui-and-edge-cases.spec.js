// tests/ui-and-edge-cases.spec.js
import { test, expect } from "@playwright/test";
import path from "path";

test.describe("UI Interactions and Edge Cases", () => {
  test("should toggle dark mode", async ({ page }) => {
    await page.goto("/");
    const body = page.locator("body");
    const themeToggle = page.locator(".theme-toggle");

    // Check initial state (usually light mode in test environments)
    await expect(body).not.toHaveClass(/dark-mode/);

    // Click to enable dark mode
    await themeToggle.click();
    await expect(body).toHaveClass(/dark-mode/);

    // Click again to disable dark mode
    await themeToggle.click();
    await expect(body).not.toHaveClass(/dark-mode/);
  });

  test("should navigate to Calendar view and display races", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByPlaceholder("Search...")
      .pressSequentially("Oguri Cap (Original)", { delay: 30 });
    await page.getByRole("listitem", { name: "Oguri Cap (Original)" }).click();
    await expect(page.locator("tbody tr").first()).toBeVisible();

    await page.getByRole("button", { name: "View Calendar" }).click();

    // Verify navigation to calendar page
    await expect(
      page.getByRole("heading", { name: "3-Year Race Calendar" })
    ).toBeVisible();

    // Verify a known career race is on the calendar
    const arimaKinenEntry = page.locator(".calendar-race-entry.career", {
      hasText: "Arima Kinen",
    });
    await expect(arimaKinenEntry.first()).toBeVisible();
    await expect(arimaKinenEntry.first()).toHaveAttribute(
      "title",
      "Arima Kinen (G1)"
    );

    // Go back to planner
    await page.getByRole("button", { name: /Back to Planner/ }).click();
    await expect(
      page.getByRole("heading", { name: "Available Races" })
    ).toBeVisible();
  });

  test("should trigger and use the Undo toast", async ({ page }) => {
    await page.goto("/");
    await page
      .getByPlaceholder("Search...")
      .pressSequentially("El Condor Pasa (Original)", { delay: 30 });
    await page
      .getByRole("listitem", { name: "El Condor Pasa (Original)" })
      .click();
    await expect(page.locator("tbody tr").first()).toBeVisible();

    const checklistButton = page.locator(".generate-button");
    await expect(checklistButton).toContainText("View Checklist (9)");

    // Perform an action that has an undo (Add epithet races)
    const epithetPanel = page.locator(".panel-section", {
      hasText: "Epithet Helper",
    });
    const tripleCrownItem = epithetPanel.locator(".epithet-item", {
      hasText: "Classic Triple Crown",
    });
    await tripleCrownItem.getByRole("button", { name: /Add Missing/ }).click();

    // Checklist count should update
    await expect(checklistButton).toContainText("View Checklist (12)");

    // Undo toast should appear
    const undoToast = page.locator(".confirmation-toast", {
      hasText: "Added 3 race(s).",
    });
    await expect(undoToast).toBeVisible();

    // Click Undo
    await undoToast.getByRole("button", { name: "Undo" }).click();

    // A success toast confirms the undo
    await expect(page.getByRole("status")).toContainText("Action undone!");

    // The checklist count should revert to its original state
    await expect(checklistButton).toContainText("View Checklist (9)");
  });

  test("should handle 'No Career Mode' toggle", async ({ page }) => {
    await page.goto("/");
    await page
      .getByPlaceholder("Search...")
      .pressSequentially("Oguri Cap (Original)", { delay: 30 });
    await page.getByRole("listitem", { name: "Oguri Cap (Original)" }).click();
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (9)"
    );

    // Enable "No Career Mode"
    await page.getByLabel("No career objectives").check();

    // A confirmation modal should appear because a checklist is active
    const modal = page.getByRole("dialog");
    await expect(modal).toContainText(
      "This will clear your current checklist. Continue?"
    );
    await modal.getByRole("button", { name: "Confirm" }).click();

    // The checklist should be cleared
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (0)"
    );

    // Verify a previous career race is no longer checked or disabled
    const arimaRow = page.locator("tr").filter({ hasText: "Arima Kinen" });
    const checkbox = arimaRow.first().getByRole("checkbox");
    await expect(checkbox).not.toBeChecked();
    await expect(checkbox).toBeEnabled();
  });
});

test.describe("Data Persistence and Validation", () => {
  test("should autosave state and restore it on page reload", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByPlaceholder("Search...")
      .pressSequentially("Symboli Rudolf (Original)", { delay: 30 });
    await page
      .getByRole("listitem", { name: "Symboli Rudolf (Original)" })
      .click();
    await expect(page.locator("tbody tr").first()).toBeVisible();

    // Change a filter
    await page.getByLabel("G2").uncheck();
    // Select an optional race
    await page
      .locator("tr")
      .filter({ hasText: "Takarazuka Kinen" })
      .first()
      .getByRole("checkbox")
      .check();
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (11)"
    );

    // Reload the page
    await page.reload();

    // Verify the state was restored from autosave
    await expect(page.getByPlaceholder("Search...")).toHaveValue(
      /Symboli Rudolf/
    );
    await expect(page.getByLabel("G2")).not.toBeChecked();
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (11)"
    );
    const takarazukaRow = page
      .locator("tr")
      .filter({ hasText: "Takarazuka Kinen" })
      .first();
    await expect(takarazukaRow.getByRole("checkbox")).toBeChecked();
  });

  test("should show an error toast for invalid import files", async ({
    page,
  }) => {
    await page.goto("/");
    const invalidJsonPath = path.join(__dirname, "test-data", "invalid.json");
    const malformedChecklistPath = path.join(
      __dirname,
      "test-data",
      "malformed.json"
    );

    // Test with a completely invalid JSON file
    await page.setInputFiles("input[type=file] >> nth=1", invalidJsonPath);
    await expect(page.getByRole("alert")).toContainText(
      "Error reading or parsing the file."
    );

    // Test with a file that is valid JSON but not a valid checklist object
    await page.setInputFiles(
      "input[type=file] >> nth=1",
      malformedChecklistPath
    );
    await expect(page.getByRole("alert")).toContainText(
      "Import failed: File data is not a valid checklist object."
    );
  });
});
