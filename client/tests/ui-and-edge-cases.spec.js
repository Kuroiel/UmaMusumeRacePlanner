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
    const searchInput = page.getByPlaceholder("Search...");
    await searchInput.fill("Oguri Cap (Original)");
    await searchInput.press("Enter");
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

  test("should trigger and use the Undo action", async ({ page }) => {
    // Increase test timeout because this test explicitly waits for multiple
    // 3-second toast notifications to disappear, which exceeds the default/strict timeout.
    test.setTimeout(15000);

    // 1. Go to the website, clear storage, and reload for a clean state
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    // 2. Find and select a character
    const searchInput = page.getByPlaceholder("Search...");
    await searchInput.fill("El Condor Pasa (Original)");
    await searchInput.press("Enter");

    // 3. Verify the character is selected and the initial state is correct
    await expect(searchInput).toHaveValue("El Condor Pasa (Original)");
    const checklistButton = page.getByRole("button", {
      name: /View Checklist/,
    });
    // El Condor Pasa's career has 7 races.
    await expect(checklistButton).toContainText("View Checklist (7)");

    // 4. Use the epithet helper to add races (an undoable action)
    const epithetPanel = page.locator(".panel-section", {
      hasText: "Epithet Helper",
    });
    const tripleCrownItem = epithetPanel.locator(".epithet-item", {
      hasText: "Classic Triple Crown",
    });
    await tripleCrownItem.getByRole("button", { name: /Add Missing/ }).click();

    // 5. Assert the toast element appears in the DOM.
    const addedToastLocator = page.locator('div[role="status"]', {
      hasText: /Added 2 race\(s\)/,
    });
    await expect(addedToastLocator).toHaveCount(1);

    // Verify checklist count updated
    await expect(checklistButton).toContainText("View Checklist (9)");

    // 6. Assert the toast element is REMOVED from the DOM.
    // This reliably waits for the exit animation and DOM removal to complete.
    // Increased assertion timeout to 10s to account for 3s toast duration + animation + lag.
    await expect(addedToastLocator).toHaveCount(0, { timeout: 10000 });

    // 7. Navigate to the checklist view and click Undo
    await checklistButton.click();
    await expect(
      page.getByRole("heading", { name: "Active Checklist" })
    ).toBeVisible();

    const progressHelper = page.locator(".progress-helper");
    const undoButton = progressHelper.getByRole("button", { name: "Undo" });
    await expect(undoButton).toHaveAttribute("title", "Undo: Added 2 race(s).");
    await undoButton.click();

    // 8. Use the same robust count-based assertion for the "undone" toast.
    const undoneToastLocator = page.locator('div[role="status"]', {
      hasText: "Action undone!",
    });
    await expect(undoneToastLocator).toHaveCount(1);

    // 9. Assert the "undone" toast is also removed from the DOM.
    // Increased assertion timeout to 10s.
    await expect(undoneToastLocator).toHaveCount(0, { timeout: 10000 });

    // Navigate back to the planner and verify the state has reverted
    await page.getByRole("button", { name: /Back to Planner/ }).click();
    await expect(
      page.getByRole("heading", { name: /Available Races/ })
    ).toBeVisible();

    await expect(checklistButton).toContainText("View Checklist (7)");
  });

  test("should handle 'No Career Mode' toggle", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.getByPlaceholder("Search...");
    await searchInput.fill("Oguri Cap (Original)");
    await searchInput.press("Enter");
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (5)"
    );

    // Enable "No Career Mode"
    // We use click() instead of check() because check() asserts the state changes immediately,
    // but the app waits for user confirmation in a toast before changing state.
    await page.getByLabel("No career objectives").click();

    // A confirmation toast (not a generic dialog) should appear
    const confirmationToast = page.locator(".confirmation-toast");
    await expect(confirmationToast).toContainText(
      "This will clear your current checklist. Continue?"
    );
    await confirmationToast.getByRole("button", { name: "Confirm" }).click();

    // The checklist should be cleared
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (0)"
    );

    // Disable "Hide Unsuitable Races" to ensure Arima Kinen is visible.
    // Oguri Cap has Long Aptitude 'B', but the default filter hides anything below 'A'.
    // Once it's no longer a career race, it gets hidden unless we uncheck this filter.
    await page.getByLabel("Hide Unsuitable Races").uncheck();

    // Verify a previous career race is no longer checked or disabled
    const arimaRow = page.locator("tr").filter({ hasText: "Arima Kinen" });
    await expect(arimaRow.first()).toBeVisible();

    const checkbox = arimaRow.first().getByRole("checkbox");
    await expect(checkbox).not.toBeChecked();
    await expect(checkbox).toBeEnabled();
  });

  test("should update estimated total fans when fan bonus is changed", async ({
    page,
  }) => {
    await page.goto("/");
    // Select a character to get a baseline fan count
    const searchInput = page.getByPlaceholder("Search...");
    await searchInput.fill("Oguri Cap (Original)");
    await searchInput.press("Enter");
    await expect(page.locator("tbody tr").first()).toBeVisible();

    const fanInputGroup = page.locator(".fan-input-group");
    const fanBonusInput = fanInputGroup.locator("#fanBonus");
    const baseFansDisplay = fanInputGroup.locator("span", {
      hasText: "Base:",
    });
    const estimatedFansDisplay = fanInputGroup.locator("span", {
      hasText: "Est. Total:",
    });

    await expect(baseFansDisplay).toContainText("96,500");
    await expect(estimatedFansDisplay).toContainText("96,500");
    await expect(fanBonusInput).toHaveValue("0");

    // Set fan bonus to 20%
    await fanBonusInput.fill("20");

    await expect(estimatedFansDisplay).toContainText("115,800");

    await page
      .locator("tr")
      .filter({ hasText: "Satsuki Sho" })
      .getByRole("checkbox")
      .check();

    await expect(baseFansDisplay).toContainText("107,500");
    await expect(estimatedFansDisplay).toContainText("129,000");
  });
});

test.describe("Data Persistence and Validation", () => {
  test("should autosave state and restore it on page reload", async ({
    page,
  }) => {
    await page.goto("/");
    const searchInput = page.getByPlaceholder("Search...");
    await searchInput.fill("Symboli Rudolf (Original)");
    await searchInput.press("Enter");
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
      "View Checklist (9)"
    );

    // Reload the page
    await page.reload();

    // Verify the state was restored from autosave
    await expect(page.getByPlaceholder("Search...")).toHaveValue(
      /Symboli Rudolf/
    );
    await expect(page.getByLabel("G2")).not.toBeChecked();
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (9)"
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

    // Use the modern locator syntax for file inputs
    const singleImportInput = page.locator("input[type=file]").nth(1);

    // Test with a completely invalid JSON file
    await singleImportInput.setInputFiles(invalidJsonPath);

    // Use .filter({ hasText: ... }) to pinpoint the specific toast, preventing "strict mode" errors
    // if multiple toasts are visible at once.
    await expect(
      page
        .locator('div[role="status"]')
        .filter({ hasText: "Error reading or parsing the file." })
    ).toBeVisible();

    // Test with a file that is valid JSON but not a valid checklist object
    await singleImportInput.setInputFiles(malformedChecklistPath);
    await expect(
      page.locator('div[role="status"]').filter({
        hasText: "Import failed: File data is not a valid checklist object.",
      })
    ).toBeVisible();
  });
});
