// tests/initial-load.spec.js
import { test, expect } from "@playwright/test";

// test.describe is a way to group related tests together.
test.describe("Initial Application Load", () => {
  // This block runs before each test in this file.
  // It's a great place for repetitive setup, like navigating to the page.
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display the main header and title", async ({ page }) => {
    // Check that the browser tab's title is correct.
    await expect(page).toHaveTitle("UmaMusume Race Planner");

    // Find the main <h1> element on the page.
    const mainHeader = page.getByRole("heading", {
      name: "UmaMusume Race Planner",
    });

    // Assert that the header is visible to the user.
    await expect(mainHeader).toBeVisible();
  });

  test("should display the initial state of key components", async ({
    page,
  }) => {
    // Find the character search input by its placeholder text.
    const searchInput = page.getByPlaceholder("Search...");
    await expect(searchInput).toBeVisible();

    // The "View Checklist" button should be visible but disabled initially.
    const checklistButton = page.getByRole("button", {
      name: /View Checklist/,
    });
    await expect(checklistButton).toBeVisible();
    await expect(checklistButton).toBeDisabled();
  });
});
